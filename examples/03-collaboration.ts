/**
 * Real-time Collaboration Example
 *
 * This example demonstrates real-time collaboration features
 */

import { AgentCLI } from 'agent-cli';

async function main() {
  console.log('🚀 Starting Real-time Collaboration Example\n');

  const app = new AgentCLI({ environment: 'development' });

  // 1. Create collaborative session
  console.log('📄 Creating collaborative document...');
  const session = app.collaboration.createSession('proposal.md', 'alice@example.com');
  console.log(`✓ Session ID: ${session.id}`);
  console.log(`✓ Document: ${session.documentId}\n`);

  // 2. Register multiple connections
  console.log('👥 Registering participants...');

  app.collaboration.registerConnection({
    id: 'conn-alice',
    userId: 'alice@example.com',
    sessionId: session.id,
    state: 'connected',
    lastPing: Date.now(),
    lastPong: Date.now(),
    metadata: { name: 'Alice', color: '#ff6b6b' },
  });

  app.collaboration.registerConnection({
    id: 'conn-bob',
    userId: 'bob@example.com',
    sessionId: session.id,
    state: 'connected',
    lastPing: Date.now(),
    lastPong: Date.now(),
    metadata: { name: 'Bob', color: '#4ecdc4' },
  });

  console.log('✓ Alice connected');
  console.log('✓ Bob connected\n');

  // 3. Get statistics
  console.log('📊 Collaboration Statistics:');
  const stats = app.collaboration.getStats();
  console.log(`  - Total sessions: ${stats.sessions}`);
  console.log(`  - Active sessions: ${stats.activeSessions}`);
  console.log(`  - Total connections: ${stats.connections}`);
  console.log(`  - Total participants: ${stats.totalParticipants}\n`);

  // 4. Simulate collaboration
  console.log('✍️  Simulating collaboration...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Update connection status
  app.collaboration.registerConnection({
    id: 'conn-alice',
    userId: 'alice@example.com',
    sessionId: session.id,
    state: 'connected',
    lastPing: Date.now(),
    lastPong: Date.now(),
    metadata: { name: 'Alice', color: '#ff6b6b', isTyping: true },
  });

  console.log('✓ Alice is typing...\n');

  // 5. Cleanup
  console.log('🧹 Cleaning up...');
  app.collaboration.unregisterConnection('conn-alice');
  app.collaboration.unregisterConnection('conn-bob');
  app.collaboration.closeSession(session.id);

  console.log('✓ Session closed\n');
  console.log('🎉 Example completed!');

  // Final cleanup
  app.collaboration.close();
}

main().catch(console.error);
