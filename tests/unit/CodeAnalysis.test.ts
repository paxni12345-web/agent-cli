import {
  astToSourceCode,
  detectDeadCode,
  detectDuplicateCode,
  diffASTStructure,
  extractDocComments,
  findCircularImports,
  findLargestFunctions,
  findTODOComments,
  findUnusedImports,
  flattenAST,
  getClassHierarchy,
  getExportedSymbols,
  getFileLOC,
  getFunctionComplexity,
  getFunctionSignatures,
  getImportGraph,
  getTypeDefinitions,
  mapSymbolToFile,
  parseToAST,
  renameSymbolAcrossFiles,
  validateSyntax,
} from '../../src/utils/CodeAnalysis.js';

const SAMPLE = `import { join } from 'path';
import { unusedHelper, usedHelper } from './helpers';

export interface Config {
  name: string;
}

/** Service that does things. */
export class Service {
  constructor(private config: Config) {}

  async run(flag: boolean): Promise<string> {
    if (flag) {
      return usedHelper(this.config.name);
    }
    for (let i = 0; i < 3; i++) {
      console.log(i);
    }
    return 'idle';
  }

  helper(): number {
    return 1;
  }
}

export function topLevel(a: number, b = 2): number {
  return usedHelper(String(a + b));
}

// TODO: handle retries here
export const arrow = async (x: string): Promise<string> => usedHelper(x);

function neverCalled(): string {
  return 'dead';
}

export type Alias = string | number;
`;

describe('parseToAST (41)', () => {
  it('builds a nested tree with classes, methods, functions and exports', () => {
    const tree = parseToAST(SAMPLE);
    const names = flattenAST(tree).map(n => `${n.kind}:${n.name}`);
    expect(names).toContain('class:Service');
    expect(names).toContain('function:topLevel');
    expect(names).toContain('type:Alias');
    const service = tree.find(n => n.name === 'Service');
    expect(service).toBeDefined();
    expect(service?.children.map(c => c.name)).toContain('run');
    for (const node of flattenAST(tree)) {
      expect(node.endLine).toBeGreaterThanOrEqual(node.line);
    }
  });

  it('parses python defs and classes', () => {
    const tree = parseToAST('class Foo:\n    def bar(self):\n        pass\n');
    const names = flattenAST(tree).map(n => `${n.kind}:${n.name}`);
    expect(names).toContain('py-class:Foo');
    expect(names).toContain('py-def:bar');
  });
});

describe('getFunctionSignatures (42)', () => {
  it('extracts names, params and line numbers', () => {
    const sigs = getFunctionSignatures(SAMPLE);
    const top = sigs.find(s => s.name === 'topLevel');
    expect(top).toBeDefined();
    expect(top?.params).toContain('a: number');
    expect(top?.line).toBeGreaterThan(0);
    const run = sigs.find(s => s.name === 'run');
    expect(run?.params).toContain('flag: boolean');
  });
});

describe('getExportedSymbols (43)', () => {
  it('lists exported symbols', () => {
    const names = getExportedSymbols(SAMPLE).map(s => s.name);
    expect(names).toContain('Service');
    expect(names).toContain('topLevel');
    expect(names).toContain('arrow');
    expect(names).toContain('Alias');
  });
});

describe('getImportGraph (44)', () => {
  it('parses named, default and namespace imports', () => {
    const edges = getImportGraph(SAMPLE);
    expect(edges.map(e => e.specifier)).toContain('path');
    expect(edges.map(e => e.specifier)).toContain('./helpers');
    const helpers = edges.find(e => e.specifier === './helpers');
    expect(helpers?.names).toContain('usedHelper');
    expect(helpers?.names).toContain('unusedHelper');
  });

  it('parses require and re-export forms', () => {
    const edges = getImportGraph(
      "const { a } = require('./a');\nexport * from './b';\nimport './side';\n",
    );
    expect(edges.map(e => e.specifier)).toEqual(
      expect.arrayContaining(['./a', './b', './side']),
    );
  });
});

describe('findUnusedImports (45)', () => {
  it('flags imported names never referenced in code', () => {
    // `join` is also unused in SAMPLE on purpose; `usedHelper` is referenced.
    expect(findUnusedImports(SAMPLE).sort()).toEqual(['join', 'unusedHelper']);
  });
});

describe('findCircularImports (46)', () => {
  it('detects an a -> b -> a cycle and ignores acyclic graphs', () => {
    const cyclic = findCircularImports({
      'a.ts': "import './b';\n",
      'b.ts': "import './a';\n",
    });
    expect(cyclic.length).toBeGreaterThan(0);
    expect(cyclic[0]).toEqual(expect.arrayContaining(['a.ts', 'b.ts']));
    expect(
      findCircularImports({ 'a.ts': "import './b';\n", 'b.ts': 'export const x = 1;\n' }),
    ).toEqual([]);
  });
});

describe('getFunctionComplexity (47)', () => {
  it('scores branching functions higher than straight-line ones', () => {
    const scores = getFunctionComplexity(SAMPLE);
    const run = scores.find(s => s.name === 'run');
    const helper = scores.find(s => s.name === 'helper');
    expect(run?.complexity).toBeGreaterThan(helper?.complexity ?? 1);
    expect(run?.complexity).toBeGreaterThanOrEqual(3);
  });

  it('ignores ?? and ?. operators', () => {
    const scores = getFunctionComplexity('function f(a?: string) {\n  return a ?? "x";\n}\n');
    expect(scores).toHaveLength(1);
    expect(scores[0].complexity).toBe(1);
  });
});

describe('extractDocComments (48)', () => {
  it('attaches JSDoc blocks to the following symbol', () => {
    const docs = extractDocComments(SAMPLE);
    const service = docs.find(d => d.symbol === 'Service');
    expect(service?.comment).toContain('Service that does things');
  });

  it('reads python docstrings', () => {
    const docs = extractDocComments('def f():\n    """Do the thing."""\n    pass\n');
    expect(docs).toEqual([{ symbol: 'f', line: 1, comment: 'Do the thing.' }]);
  });
});

describe('renameSymbolAcrossFiles (49)', () => {
  it('renames on word boundaries and returns only changed files', () => {
    const changed = renameSymbolAcrossFiles(
      { 'a.ts': 'function foo() { return foo(); }\n', 'b.ts': 'const x = 1;\n' },
      'foo',
      'bar',
    );
    expect(Object.keys(changed)).toEqual(['a.ts']);
    expect(changed['a.ts']).toContain('function bar()');
    expect(changed['a.ts']).not.toMatch(/\bfoo\b/);
  });

  it('does not touch longer identifiers that share a prefix', () => {
    const changed = renameSymbolAcrossFiles({ 'a.ts': 'const foobar = foo;\n' }, 'foo', 'bar');
    expect(changed['a.ts']).toContain('foobar');
  });
});

describe('getClassHierarchy (50)', () => {
  it('reports extends and implements clauses', () => {
    const classes = getClassHierarchy(
      'class A {}\nclass B extends A implements X, Y {}\n',
    );
    expect(classes.find(c => c.name === 'A')).toBeDefined();
    expect(classes.find(c => c.name === 'B')).toMatchObject({
      extends: 'A',
      implements: ['X', 'Y'],
    });
  });
});

describe('findTODOComments (51)', () => {
  it('finds TODO/FIXME markers with line numbers', () => {
    const todos = findTODOComments(SAMPLE);
    expect(todos.length).toBeGreaterThan(0);
    expect(todos[0]).toMatchObject({ tag: 'TODO' });
  });
});

describe('detectDuplicateCode (52)', () => {
  it('reports repeated blocks with their start lines', () => {
    const dupes = detectDuplicateCode(
      'const a = 1;\nconst b = 2;\nconst c = 3;\nconst sep = 0;\nconst a = 1;\nconst b = 2;\nconst c = 3;\n',
      3,
    );
    expect(dupes.length).toBeGreaterThan(0);
    expect(dupes[0].occurrences).toBe(2);
  });

  it('returns nothing for unique code', () => {
    expect(detectDuplicateCode('const a = 1;\nconst b = 2;\nconst c = 3;\n', 3)).toEqual([]);
  });
});

describe('getTypeDefinitions (53)', () => {
  it('lists interfaces, aliases and enums', () => {
    const types = getTypeDefinitions(SAMPLE);
    expect(types.find(t => t.name === 'Config' && t.kind === 'interface')).toBeDefined();
    expect(types.find(t => t.name === 'Alias' && t.kind === 'type')).toBeDefined();
  });
});

describe('validateSyntax (54)', () => {
  it('accepts balanced code and rejects unbalanced brackets', () => {
    expect(validateSyntax('function f() { return [1, 2]; }\n').valid).toBe(true);
    const bad = validateSyntax('function f() { return [1, 2; }\n');
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('ignores brackets inside strings and comments', () => {
    expect(validateSyntax('const s = "{ not code }"; // }\n').valid).toBe(true);
  });
});

describe('astToSourceCode (55)', () => {
  it('renders a readable normalized outline', () => {
    const outline = astToSourceCode(parseToAST('export class A {\n  run() {\n  }\n}\n'));
    expect(outline).toContain('class A');
    expect(outline).toContain('run');
  });
});

describe('findLargestFunctions (56)', () => {
  it('orders functions by span descending', () => {
    const largest = findLargestFunctions(SAMPLE, 3);
    expect(largest.length).toBeGreaterThan(0);
    expect(largest.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < largest.length; i++) {
      expect(largest[i - 1].lines).toBeGreaterThanOrEqual(largest[i].lines);
    }
  });
});

describe('getFileLOC (57)', () => {
  it('splits code, comment and blank lines', () => {
    const loc = getFileLOC('// hi\nconst a = 1;\n\n');
    expect(loc).toEqual({ total: 3, code: 1, comment: 1, blank: 1 });
    expect(getFileLOC('')).toEqual({ total: 0, code: 0, comment: 0, blank: 0 });
  });
});

describe('detectDeadCode (58)', () => {
  it('flags local declarations never referenced', () => {
    const dead = detectDeadCode(SAMPLE);
    expect(dead.map(d => d.name)).toContain('neverCalled');
    expect(dead.map(d => d.name)).not.toContain('usedHelper');
  });
});

describe('mapSymbolToFile (59)', () => {
  it('locates declarations across files', () => {
    const hits = mapSymbolToFile('topLevel', {
      'a.ts': SAMPLE,
      'b.ts': 'const x = 1;\n',
    });
    expect(hits).toEqual([{ file: 'a.ts', line: expect.any(Number), kind: 'function' }]);
    expect(() => mapSymbolToFile('', { 'a.ts': '' })).toThrow(/required/);
  });
});

describe('diffASTStructure (60)', () => {
  it('reports added, removed and changed symbols', () => {
    const before = 'function a() {}\nfunction gone() {}\nfunction sig(x: number) {}\n';
    const after = 'function a() {}\nfunction fresh() {}\nfunction sig(x: string) {}\n';
    const diff = diffASTStructure(before, after);
    expect(diff.added).toContain('function:fresh');
    expect(diff.removed).toContain('function:gone');
    expect(diff.changed).toContain('function:sig');
  });
});
