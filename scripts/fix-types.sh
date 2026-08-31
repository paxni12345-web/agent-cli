#!/bin/bash
# Type Safety Automation Script
# Run this to perform safe, automated replacements

set -e

echo "🔍 Type Safety Improvement Script"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "tsconfig.json" ]; then
    echo "❌ Error: tsconfig.json not found. Run this from the project root."
    exit 1
fi

# Create backup
echo "📦 Creating backup..."
git add -A 2>/dev/null || true
git commit -m "Backup before automated type safety improvements" 2>/dev/null || {
    echo "⚠️  Warning: Could not create git backup. Proceeding anyway..."
}

echo ""
echo "🔧 Applying automated fixes..."
echo ""

# Counter for changes
CHANGES=0

# Pattern 1: catch (error: any) -> catch (error: unknown)
echo "1️⃣  Fixing error handling in catch blocks..."
FILES_CHANGED=$(find src -name "*.ts" -type f -exec grep -l "} catch (error: any)" {} \; | wc -l)
find src -name "*.ts" -type f -exec sed -i.bak 's/} catch (error: any) {/} catch (error: unknown) {/g' {} \;
find src -name "*.ts" -type f -exec sed -i.bak 's/catch (error: any) {/catch (error: unknown) {/g' {} \;
echo "   ✅ Updated $FILES_CHANGED files"
CHANGES=$((CHANGES + FILES_CHANGED))

# Pattern 2: Record<string, any> -> UnknownRecord
echo "2️⃣  Replacing Record<string, any> with UnknownRecord..."
FILES_CHANGED=$(find src -name "*.ts" -type f -exec grep -l "Record<string, any>" {} \; | wc -l)
find src -name "*.ts" -type f -exec sed -i.bak 's/Record<string, any>/UnknownRecord/g' {} \;
echo "   ✅ Updated $FILES_CHANGED files"
CHANGES=$((CHANGES + FILES_CHANGED))

# Pattern 3: params?: any[] -> params?: QueryParameters (in database contexts)
echo "3️⃣  Fixing database parameter types..."
FILES_CHANGED=$(find src/database src/tools -name "*.ts" -type f 2>/dev/null -exec grep -l "params\?: any\[\]" {} \; | wc -l)
find src/database src/tools -name "*.ts" -type f 2>/dev/null -exec sed -i.bak 's/params\?: any\[\]/params?: QueryParameters/g' {} \; || true
echo "   ✅ Updated $FILES_CHANGED files"
CHANGES=$((CHANGES + FILES_CHANGED))

# Pattern 4: execute(input: any, -> execute(input: ToolInput,
echo "4️⃣  Fixing tool execute method signatures..."
FILES_CHANGED=$(find src/tools -name "*.ts" -type f 2>/dev/null -exec grep -l "execute.*input: any," {} \; | wc -l)
find src/tools -name "*.ts" -type f 2>/dev/null -exec sed -i.bak 's/execute(input: any,/execute(input: ToolInput,/g' {} \; || true
find src/tools -name "*.ts" -type f 2>/dev/null -exec sed -i.bak 's/execute: async (input: any)/execute: async (input: ToolInput)/g' {} \; || true
echo "   ✅ Updated $FILES_CHANGED files"
CHANGES=$((CHANGES + FILES_CHANGED))

# Pattern 5: rows?: any[] -> rows?: DatabaseRow[]
echo "5️⃣  Fixing database row types..."
FILES_CHANGED=$(find src/database src/tools -name "*.ts" -type f 2>/dev/null -exec grep -l "rows\?: any\[\]" {} \; | wc -l)
find src/database src/tools -name "*.ts" -type f 2>/dev/null -exec sed -i.bak 's/rows\?: any\[\]/rows?: DatabaseRow[]/g' {} \; || true
echo "   ✅ Updated $FILES_CHANGED files"
CHANGES=$((CHANGES + FILES_CHANGED))

# Pattern 6: metadata?: Record<string, any> is already covered by pattern 2

# Clean up backup files
echo ""
echo "🧹 Cleaning up backup files..."
find src -name "*.bak" -type f -delete

echo ""
echo "✨ Automated fixes complete!"
echo "   Total files modified: $CHANGES"
echo ""
echo "⚠️  IMPORTANT: These are automated replacements."
echo "   You must now:"
echo "   1. Review changes: git diff"
echo "   2. Add missing imports to files that need them"
echo "   3. Run type check: npm run type-check or tsc --noEmit"
echo "   4. Fix any type errors manually"
echo "   5. Run tests: npm test"
echo "   6. Commit when ready: git add . && git commit -m 'Apply type safety improvements'"
echo ""
echo "📚 See IMPLEMENTATION_GUIDE.md for manual fixes needed"
echo "📊 See TYPE_SAFETY_REPORT.md for complete analysis"
