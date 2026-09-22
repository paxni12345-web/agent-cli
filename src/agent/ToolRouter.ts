import { ToolSchema } from '../types/index.js';

/** Small keyword router that keeps irrelevant tools out of provider requests. */
export class ToolRouter {
  private readonly maxTools: number;

  constructor(maxTools = 12) {
    this.maxTools = Math.max(1, maxTools);
  }

  select(userMessage: string, schemas: ToolSchema[]): ToolSchema[] {
    if (schemas.length <= this.maxTools) return schemas;

    const query = userMessage.toLowerCase();
    const scored = schemas.map((schema, index) => {
      const text = `${schema.name} ${schema.description}`.toLowerCase();
      let score = 0;
      for (const token of query.split(/[^a-z0-9_]+/).filter(token => token.length > 2)) {
        if (text.includes(token)) score += 2;
      }
      if (/read|inspect|find|search|look|list|understand|review/.test(query) &&
          /read|list|search|status|diff|log|map/.test(schema.name)) score += 4;
      if (/write|edit|change|fix|create|delete|implement/.test(query) &&
          /write|edit|shell|git/.test(schema.name)) score += 4;
      if (/test|build|run|command|npm|yarn|pnpm/.test(query) && schema.name === 'shell') score += 8;
      return { schema, score, index };
    });

    const selected = scored
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, this.maxTools);

    // Never send an empty tool list when the query did not match a keyword.
    return selected.some(item => item.score > 0)
      ? selected.map(item => item.schema)
      : schemas.slice(0, this.maxTools);
  }
}
