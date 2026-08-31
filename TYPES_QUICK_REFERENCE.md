# Type Safety Quick Reference

## Import Statement

```typescript
import {
  // JSON Types
  JsonValue, JsonObject, JsonArray, JsonPrimitive,
  
  // Generic Types
  UnknownRecord,
  
  // Tool Types
  ToolInput, ToolResult, ToolContext,
  
  // Database Types
  QueryParameters, DatabaseRow, QueryResult,
  
  // HTTP Types
  HttpBody, HttpResponse, ApiResponse,
  
  // Error Types
  TypedError, ValidationError, ValidationResult,
  
  // Result Types
  Result, Ok, Err, Option, Some,
  
  // Type Guards
  isJsonValue, isTypedError, isOk, isErr, isSome, isObject
} from './types/common';
```

## Common Replacements Cheat Sheet

| Old | New | When to Use |
|-----|-----|-------------|
| `any` | `unknown` | When type is truly unknown |
| `any` | `JsonValue` | For JSON data |
| `any` | `UnknownRecord` | For objects with unknown keys |
| `any[]` | `DatabaseRow[]` | For database query results |
| `any[]` | `JsonArray` | For JSON arrays |
| `Record<string, any>` | `UnknownRecord` | Generic object |
| `Record<string, any>` | `Record<string, JsonValue>` | JSON object |
| `error: any` | `error: unknown` | In catch blocks |
| `params?: any[]` | `params?: QueryParameters` | SQL parameters |
| `body?: any` | `body?: HttpBody` | HTTP body |
| `input: any` | `input: ToolInput` | Tool input |

## Most Common Patterns

### 1. Error Handling
```typescript
// ❌ DON'T
catch (error: any) {
  console.error(error.message);
}

// ✅ DO
catch (error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(err.message);
}
```

### 2. Tool Execute Method
```typescript
// ❌ DON'T
execute: async (input: any): Promise<ToolResult> => {

// ✅ DO
execute: async (input: ToolInput): Promise<ToolResult> => {
```

### 3. Database Query
```typescript
// ❌ DON'T
query(sql: string, params?: any[]): Promise<any>

// ✅ DO
query(sql: string, params?: QueryParameters): Promise<QueryResult>
```

### 4. API Response
```typescript
// ❌ DON'T
async fetchData(): Promise<any>

// ✅ DO
async fetchData<T extends JsonValue>(): Promise<ApiResponse<T>>
```

### 5. Generic Object
```typescript
// ❌ DON'T
metadata?: Record<string, any>

// ✅ DO
metadata?: UnknownRecord
```

## Type Guards Usage

```typescript
// Check if value is valid JSON
if (isJsonValue(data)) {
  // data is JsonValue
}

// Check if error has extra properties
if (isTypedError(error)) {
  console.log(error.code, error.statusCode);
}

// Check if Result is success
if (isOk(result)) {
  console.log(result.value);
} else {
  console.error(result.error);
}

// Check if value exists
if (isSome(value)) {
  // value is not null or undefined
}

// Check if value is object
if (isObject(value)) {
  // value is Record<string, unknown>
}
```

## File-Specific Quick Fixes

### APIGateway.ts
```typescript
// Line 25, 34, 52, etc.
context?: Record<string, any>  →  context?: UnknownRecord

// Line 52
errors: any[]  →  errors: ValidationError[]

// Line 173, 748
body?: any  →  body?: HttpBody

// Line 202, 217
error: any  →  error: Error | TypedError
```

### DatabaseTools.ts
```typescript
// Line 19
rows?: any[]  →  rows?: DatabaseRow[]

// Line 31, 68
params?: any[]  →  params?: QueryParameters

// Line 268-270
filter?: any; data?: any; options?: any
→
filter?: UnknownRecord; data?: UnknownRecord; options?: FindOptions

// Line 461
formatTable(rows: any[])  →  formatTable(rows: DatabaseRow[])
```

### All Tool Files
```typescript
// Execute method
async execute(input: any, context: ToolContext)
→
async execute(input: ToolInput, context: ToolContext)

// Catch blocks
catch (error: any) {}
→
catch (error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
}
```

## Commands

```bash
# Type check single file
tsc --noEmit src/network/APIGateway.ts

# Type check all
tsc --noEmit

# Run automated fixes
./scripts/fix-types.sh

# Check what changed
git diff

# Run tests
npm test
```

## Priority Order

1. **Security files first**
   - src/network/APIGateway.ts
   - src/api/ErrorHandling.ts
   
2. **Database layer**
   - src/database/MEGA_DatabaseAbstraction.ts
   - src/tools/DatabaseTools.ts
   
3. **Tool system**
   - All files in src/tools/
   
4. **Everything else**
   - Systematic replacement

## Need Help?

- **Examples**: See `IMPLEMENTATION_GUIDE.md`
- **Full Analysis**: See `TYPE_SAFETY_REPORT.md`
- **Summary**: See `TYPE_SAFETY_SUMMARY.md`
