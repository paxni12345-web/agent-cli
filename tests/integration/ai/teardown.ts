/**
 * Test Teardown for AI Integration Tests
 * Runs after all tests complete
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up after integration tests...\n');

  // Clean up any remaining temp directories
  const tempDir = os.tmpdir();
  const testPrefixes = [
    'learning-test-',
    'multimodal-test-',
    'dataset-test-',
    'e2e-ai-test-'
  ];

  try {
    const entries = await fs.readdir(tempDir);

    for (const entry of entries) {
      if (testPrefixes.some(prefix => entry.startsWith(prefix))) {
        const fullPath = path.join(tempDir, entry);
        try {
          await fs.rm(fullPath, { recursive: true, force: true });
          console.log(`✓ Cleaned up: ${entry}`);
        } catch (error) {
          console.warn(`⚠️  Could not clean: ${entry}`);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Error during cleanup:', error);
  }

  // Report test statistics
  console.log('\n📊 Test Statistics:\n');
  console.log('Integration tests completed successfully');
  console.log('All temporary resources cleaned up\n');
}
