# Type Safety Implementation Guide

## Quick Start

### 1. Import Common Types

```typescript
import {
  JsonValue,
  UnknownRecord,
  ToolInput,
  ToolResult,
  QueryParameters,
  DatabaseRow,
  HttpBody,
  TypedError,
} from './types/common';
```

### 2. Replace `any` Types

#### Pattern 1: Error Handling
```typescript
// ❌ BEFORE
catch (error: any) {
  return { success: false, error: error.message };
}

// ✅ AFTER
catch (error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  return { success: false, error: err.message };
}
```

#### Pattern 2: Tool Execute Methods
```typescript
// ❌ BEFORE
execute: async (input: any, context: ToolContext): Promise<ToolResult> => {

// ✅ AFTER
execute: async (input: ToolInput, context: ToolContext): Promise<ToolResult> => {
```

#### Pattern 3: Database Parameters
```typescript
// ❌ BEFORE
query(sql: string, params?: any[]): Promise<any>

// ✅ AFTER
query(sql: string, params?: QueryParameters): Promise<QueryResult>
```

#### Pattern 4: Generic Objects
```typescript
// ❌ BEFORE
metadata?: Record<string, any>

// ✅ AFTER
metadata?: UnknownRecord
```

#### Pattern 5: JSON Data
```typescript
// ❌ BEFORE
response: any

// ✅ AFTER
response: JsonValue
```

### 3. Add Type Guards

```typescript
// Check JSON validity
if (!isJsonValue(data)) {
  throw new Error('Invalid JSON data');
}

// Check error type
if (isTypedError(error)) {
  console.error(`[${error.code}] ${error.message}`);
}

// Check for null/undefined
if (isSome(value)) {
  // value is not null or undefined
  processValue(value);
}
```

## File-by-File Fix Examples

### Example 1: Fixing APIGateway.ts

```typescript
// BEFORE
export class APIGatewayError extends Error {
  public readonly context?: Record<string, any>;
  
  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'GATEWAY_ERROR',
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    // ...
  }
}

// AFTER
import { UnknownRecord } from '../types/common';

export class APIGatewayError extends Error {
  public readonly context?: UnknownRecord;
  
  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'GATEWAY_ERROR',
    isOperational: boolean = true,
    context?: UnknownRecord
  ) {
    // ...
  }
}
```

```typescript
// BEFORE
export class ValidationError extends APIGatewayError {
  public readonly errors: ValidationError[];

  constructor(message: string, errors: any[] = [], context?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', true, context);
    this.errors = errors;
  }
}

// AFTER
import { ValidationError as ValidErr, UnknownRecord } from '../types/common';

export class ValidationError extends APIGatewayError {
  public readonly errors: ValidErr[];

  constructor(message: string, errors: ValidErr[] = [], context?: UnknownRecord) {
    super(message, 400, 'VALIDATION_ERROR', true, context);
    this.errors = errors;
  }
}
```

### Example 2: Fixing DatabaseTools.ts

```typescript
// BEFORE
export interface QueryResult {
  rows?: any[];
  rowCount?: number;
  fields?: string[];
  executionTime?: number;
}

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: any[]): Promise<QueryResult>;
  isConnected(): boolean;
}

// AFTER
import { DatabaseRow, QueryParameters, QueryResult } from '../types/common';

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: QueryParameters): Promise<QueryResult<DatabaseRow>>;
  isConnected(): boolean;
}
```

```typescript
// BEFORE
function formatTable(rows: any[]): string {
  if (rows.length === 0) return 'No data';
  const keys = Object.keys(rows[0]);
  // ...
}

// AFTER
import { DatabaseRow } from '../types/common';

function formatTable(rows: DatabaseRow[]): string {
  if (rows.length === 0) return 'No data';
  const keys = Object.keys(rows[0]);
  // ...
}
```

### Example 3: Fixing Tool Files

```typescript
// BEFORE
export const GitStatusTool: Tool = {
  name: 'git_status',
  description: 'Get git repository status',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' }
    }
  },
  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await execCommand('git status', input.path);
      return { success: true, output: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// AFTER
import { ToolInput, ToolResult, ToolContext } from '../types/common';

interface GitStatusInput extends ToolInput {
  path: string;
}

export const GitStatusTool: Tool = {
  name: 'git_status',
  description: 'Get git repository status',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' }
    },
    required: ['path']
  },
  async execute(input: ToolInput, context: ToolContext): Promise<ToolResult> {
    const { path } = input as GitStatusInput;
    
    try {
      const result = await execCommand('git status', path);
      return { success: true, output: result };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return { 
        success: false, 
        error: err.message,
        metadata: { command: 'git status', path }
      };
    }
  }
};
```

## Common Patterns

### Pattern: Generic Repository

```typescript
// BEFORE
class Repository {
  async find(id: string): Promise<any> {
    const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return row[0];
  }
  
  async findAll(): Promise<any[]> {
    const rows = await this.db.query('SELECT * FROM users');
    return rows;
  }
}

// AFTER
import { DatabaseRow, QueryParameters, QueryResult } from './types/common';

interface User extends DatabaseRow {
  id: string;
  name: string;
  email: string;
  created_at: Date;
}

class Repository<T extends DatabaseRow> {
  constructor(
    private db: DatabaseConnection,
    private table: string
  ) {}
  
  async find(id: string): Promise<T | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.table} WHERE id = $1`,
      [id]
    );
    return result.rows[0] as T || null;
  }
  
  async findAll(): Promise<T[]> {
    const result = await this.db.query(`SELECT * FROM ${this.table}`);
    return result.rows as T[];
  }
}

// Usage
const userRepo = new Repository<User>(db, 'users');
const user = await userRepo.find('123'); // Type: User | null
```

### Pattern: API Client with Generics

```typescript
// BEFORE
class ApiClient {
  async get(url: string): Promise<any> {
    const response = await fetch(url);
    return response.json();
  }
  
  async post(url: string, data: any): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }
}

// AFTER
import { JsonValue, HttpBody, ApiResponse } from './types/common';

class ApiClient {
  async get<T extends JsonValue>(url: string): Promise<ApiResponse<T>> {
    const response = await fetch(url);
    const data: unknown = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: {
          message: 'Request failed',
          code: 'HTTP_ERROR',
          timestamp: Date.now(),
          requestId: response.headers.get('x-request-id') || undefined
        }
      };
    }
    
    return {
      success: true,
      data: data as T
    };
  }
  
  async post<T extends JsonValue, B extends HttpBody>(
    url: string, 
    body: B
  ): Promise<ApiResponse<T>> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data: unknown = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: {
          message: 'Request failed',
          code: 'HTTP_ERROR',
          timestamp: Date.now()
        }
      };
    }
    
    return {
      success: true,
      data: data as T
    };
  }
}

// Usage
interface UserData extends JsonValue {
  id: string;
  name: string;
}

const client = new ApiClient();
const response = await client.get<UserData>('/api/user/123');

if (response.success) {
  console.log(response.data.name); // Type-safe access
} else {
  console.error(response.error.message);
}
```

### Pattern: Result Type for Error Handling

```typescript
// BEFORE
async function parseConfig(path: string): Promise<any> {
  try {
    const content = await readFile(path);
    return JSON.parse(content);
  } catch (error: any) {
    throw new Error(`Failed to parse config: ${error.message}`);
  }
}

// Usage (requires try-catch everywhere)
try {
  const config = await parseConfig('./config.json');
  processConfig(config);
} catch (error) {
  handleError(error);
}

// AFTER
import { Result, JsonObject } from './types/common';

async function parseConfig(path: string): Promise<Result<JsonObject>> {
  try {
    const content = await readFile(path, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        ok: false,
        error: new Error('Config must be an object')
      };
    }
    
    return {
      ok: true,
      value: parsed as JsonObject
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      ok: false,
      error: new Error(`Failed to parse config: ${err.message}`)
    };
  }
}

// Usage (no try-catch needed)
const result = await parseConfig('./config.json');

if (result.ok) {
  processConfig(result.value); // Type: JsonObject
} else {
  handleError(result.error); // Type: Error
}
```

## Automation Scripts

### Replace Common Patterns (Use with caution!)

```bash
#!/bin/bash

# Backup first
git add -A
git commit -m "Backup before type safety fixes"

# Replace error: any in catch blocks
find src -name "*.ts" -type f -exec sed -i 's/} catch (error: any) {/} catch (error: unknown) {/g' {} \;

# Replace Record<string, any>
find src -name "*.ts" -type f -exec sed -i 's/Record<string, any>/UnknownRecord/g' {} \;

# Replace execute method signatures
find src/tools -name "*.ts" -type f -exec sed -i 's/execute(input: any,/execute(input: ToolInput,/g' {} \;

# Add import statement (you'll need to adjust paths)
# This is more complex and should be done manually or with a more sophisticated script

echo "Pattern replacement complete. Review changes with: git diff"
```

## Testing Strategy

### 1. Type-Check After Each File

```bash
# Check specific file
npx tsc --noEmit src/network/APIGateway.ts

# Check all
npx tsc --noEmit
```

### 2. Run Linter

```bash
npm run lint
# or
npx eslint src/**/*.ts
```

### 3. Run Tests

```bash
# All tests
npm test

# Specific test
npm test -- src/network/APIGateway.test.ts
```

### 4. Runtime Validation

Add runtime checks in development:

```typescript
if (process.env.NODE_ENV === 'development') {
  // Validate at runtime in dev
  if (!isJsonValue(data)) {
    console.warn('Invalid JSON data detected:', data);
  }
}
```

## Troubleshooting

### Issue 1: "Type 'unknown' is not assignable to type 'X'"

```typescript
// Solution: Use type assertion with validation
const value: unknown = someFunction();

if (typeof value === 'string') {
  // Now TypeScript knows it's a string
  processString(value);
}

// Or use type guards
if (isJsonValue(value)) {
  processJson(value);
}
```

### Issue 2: "Cannot use before type assertion"

```typescript
// Problem
const input: ToolInput = getInput();
const path = input.path; // Error: path doesn't exist on ToolInput

// Solution: Create typed interface
interface MyToolInput extends ToolInput {
  path: string;
  options?: { verbose: boolean };
}

const typedInput = input as MyToolInput;
const path = typedInput.path; // OK
```

### Issue 3: "Generic type requires 1 type argument"

```typescript
// Problem
const result: QueryResult = await query(sql); // Error

// Solution: Provide type argument
const result: QueryResult<User> = await query<User>(sql);

// Or use default
const result = await query(sql); // Uses DatabaseRow as default
```

## Checklist for Each File

- [ ] Import common types from `./types/common`
- [ ] Replace all `any` with appropriate types
- [ ] Add type guards where needed
- [ ] Update function signatures with generics if beneficial
- [ ] Add interface definitions for complex inputs
- [ ] Update JSDoc comments
- [ ] Run `tsc --noEmit` to check
- [ ] Run tests
- [ ] Review and commit

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
