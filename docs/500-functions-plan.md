# Plan: 500 Functions Implementation (1–500)

> ที่มา: `docs/500-functions.txt` (ไฟล์ต้นฉบับ 500 ไอเดีย แบ่ง 25 หมวด × 20 ฟังก์ชัน)
> วิธีทำ: ทีละหมวด ตาม TDD (RED → GREEN → REFACTOR) + typecheck/build/test/lint ผ่านก่อน commit/push ทุกหมวด
> ข้อตกลง: dependency-free (ไม่เพิ่ม lib หนัก), pure/testable functions ใน `src/utils/<Name>.ts` + เทสคู่ใน `tests/unit/<Name>.test.ts`

## สถานะปัจจุบัน: เสร็จ 120/500 (24%)

| หมวด | ฟังก์ชัน | ไฟล์ | สถานะ | commit |
|------|----------|------|--------|--------|
| A. Path & File | 1–20 | `src/utils/FileUtilities.ts` | ✅ push แล้ว | `02a69cd` |
| B. String & Text | 21–40 | `src/utils/TextUtilities.ts` | ✅ push แล้ว | `02a69cd` |
| C. AST & Code Analysis | 41–60 | `src/utils/CodeAnalysis.ts` | ✅ push แล้ว | `f9e4238` |
| D. Diff & Patch | 61–80 | `src/utils/DiffPatch.ts` | ✅ push แล้ว | `37a7850` |
| E. Git | 81–100 | `src/utils/GitUtilities.ts` | ✅ push แล้ว | `0d726b8` |
| F. Shell & Process | 101–120 | `src/utils/ShellUtilities.ts` | ✅ push แล้ว | `d5f9ece` |

## งานที่เหลือ: 380/500 (76%)

| หมวด | ฟังก์ชัน | ไฟล์เป้าหมาย | หมายเหตุ |
|------|----------|---------------|----------|
| G. Validation & Schema | 121–140 | `src/utils/ValidationUtilities.ts` | 🚧 เริ่มแล้ว (RED) — ต่อจากตรงนี้ |
| H. Security & Sanitization | 141–160 | `src/utils/SecurityUtilities.ts` | ต่อกับ `SecretScanner`, `ShellSafety` ที่มีอยู่ |
| I. Config Management | 161–180 | `src/utils/ConfigUtilities.ts` | ต่อกับ `ConfigLoader` ที่มีอยู่ |
| J. Logging & Telemetry | 181–200 | `src/utils/LoggingUtilities.ts` | — |
| K. Token & Context | 201–220 | `src/utils/ContextUtilities.ts` | ต่อกับ `ContextCompressor` ที่มีอยู่ |
| L. Caching | 221–240 | `src/utils/CacheUtilities.ts` | LRU + TTL, in-memory ก่อน |
| M. Concurrency & Queue | 241–260 | `src/utils/ConcurrencyUtilities.ts` | — |
| N. Error & Retry | 261–280 | `src/utils/RetryUtilities.ts` | ต่อกับ tool-retry ที่มีอยู่ |
| O. Testing | 281–300 | `src/utils/TestingUtilities.ts` | — |
| P. Dependency & Package | 301–320 | `src/utils/DependencyUtilities.ts` | อ่าน `package.json`/lockfile อย่างเดียว (ไม่แตะ engines ของ transitive deps) |
| Q. Network & HTTP | 321–340 | `src/utils/NetworkUtilities.ts` | มี SSRF guard ทุกตัว |
| R. Storage & Database | 341–360 | `src/utils/StorageUtilities.ts` | read-only default |
| S. UI / TUI | 361–380 | `src/utils/TuiUtilities.ts` | ต่อกับ Ink components ที่มีอยู่ |
| T. Embedding & Search | 381–400 | `src/utils/EmbeddingUtilities.ts` | chunking + cosine similarity (ยังไม่ผูก provider) |
| U. Model & Provider | 401–420 | `src/utils/ProviderUtilities.ts` | ต่อกับ `providers/` ที่มีอยู่ |
| V. Plan & Graph | 421–440 | `src/utils/GraphUtilities.ts` | topological sort, cycle detection |
| W. Cost & Usage | 441–460 | `src/utils/CostUtilities.ts` | — |
| X. Human-in-the-Loop | 461–480 | `src/utils/ReviewUtilities.ts` | ต่อกับ approval flow ที่มีอยู่ |
| Y. Misc / Cross-cutting | 481–500 | `src/utils/MiscUtilities.ts` | ปิดท้าย + verify รวม |

## 15 ตัวคุ้มสุด (ตาม NOTES ท้ายไฟล์ต้นฉบับ)

`resolveSafePath`, `execSafe`, `atomicWriteFile`, `validateToolInput`,
`detectSecretPattern`, `retryWithExponentialBackoff`, `promptCacheKeyGenerator`,
`dependencyGraphBuilder`, `topologicalSort`, `contextBudgetAllocator`,
`modelRouterByComplexity`, `runTestSuite`, `batchDiffGrouper`,
`costPerModuleCalculator`, `auditTrailWriter` — ครอบ security/cost/context/verify/review

## Definition of Done (ต่อหมวด)

1. `npm run typecheck` ผ่าน
2. เทสหมวดใหม่เขียวทั้งหมด
3. `npm test` เต็ม + `npm run lint` ผ่าน
4. commit แยกต่อหมวด + push `origin/main` + verify ตรง remote
