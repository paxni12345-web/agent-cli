/**
 * Basic Example: Getting Started with Agent CLI
 *
 * This example demonstrates the basic usage of Agent CLI
 */

import { AgentCLI } from 'agent-cli';

async function main() {
  console.log('🚀 Starting Agent CLI Basic Example\n');

  // 1. Create instance
  const app = new AgentCLI({
    environment: 'development',
    debug: true,
    logLevel: 'info',
  });

  console.log('✓ Agent CLI initialized\n');

  // 2. Get system status
  const status = app.getStatus();
  console.log(`System Status: ${status.status}`);
  console.log(`Uptime: ${status.uptime}ms`);
  console.log(`Modules: ${status.modules.size}\n`);

  // 3. Use cache
  console.log('📦 Testing Cache...');
  await app.cache.set('greeting', 'Hello, World!');
  const greeting = await app.cache.get<string>('greeting');
  console.log(`✓ Cache value: ${greeting}\n`);

  // 4. Use configuration
  console.log('⚙️  Testing Configuration...');
  const config = app.configManager.createConfiguration('myapp', 'development');
  app.configManager.setValue(config.id, 'apiUrl', 'https://api.example.com');
  app.configManager.setValue(config.id, 'timeout', 5000);

  const apiUrl = app.configManager.getValue(config.id, 'apiUrl');
  const timeout = app.configManager.getValue(config.id, 'timeout');
  console.log(`✓ API URL: ${apiUrl}`);
  console.log(`✓ Timeout: ${timeout}ms\n`);

  // 5. Feature flags
  console.log('🚩 Testing Feature Flags...');
  app.configManager.setFeatureFlag(config.id, 'betaFeatures', true);
  const betaEnabled = app.configManager.isFeatureEnabled(config.id, 'betaFeatures');
  console.log(`✓ Beta features enabled: ${betaEnabled}\n`);

  // 6. Real-time collaboration
  console.log('👥 Testing Collaboration...');
  const session = app.collaboration.createSession('document-123', 'user-456');
  console.log(`✓ Session created: ${session.id}`);

  const collabStats = app.collaboration.getStats();
  console.log(`✓ Active sessions: ${collabStats.activeSessions}\n`);

  // 7. Cleanup
  console.log('🧹 Cleaning up...');
  await app.cache.clear();
  app.collaboration.closeSession(session.id);
  app.configManager.deleteConfiguration(config.id);

  console.log('✓ Cleanup complete\n');
  console.log('🎉 Example completed successfully!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
