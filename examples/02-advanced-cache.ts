/**
 * Advanced Example: Cache with TTL and Tags
 *
 * This example demonstrates advanced caching features
 */

import { AgentCLI } from 'agent-cli';

async function main() {
  console.log('🚀 Starting Advanced Cache Example\n');

  const app = new AgentCLI({ environment: 'development' });

  // 1. Cache with TTL
  console.log('⏰ Testing TTL...');
  await app.cache.set('temp-data', 'This expires soon', {
    ttl: 2000, // 2 seconds
  });

  let value = await app.cache.get('temp-data');
  console.log(`✓ Initial value: ${value}`);

  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 2500));

  value = await app.cache.get('temp-data');
  console.log(`✓ After expiration: ${value}\n`); // Should be null

  // 2. Cache with Tags
  console.log('🏷️  Testing Tags...');
  await app.cache.set('user:1', { name: 'Alice' }, {
    tags: ['user', 'profile'],
  });

  await app.cache.set('user:2', { name: 'Bob' }, {
    tags: ['user', 'profile'],
  });

  await app.cache.set('post:1', { title: 'Hello' }, {
    tags: ['post'],
  });

  console.log('✓ Cached 3 items with tags\n');

  // 3. Invalidate by tag
  console.log('🗑️  Invalidating by tag...');
  await app.cache.invalidateByTag('user');

  const user1 = await app.cache.get('user:1');
  const user2 = await app.cache.get('user:2');
  const post1 = await app.cache.get('post:1');

  console.log(`✓ User 1: ${user1}`); // null
  console.log(`✓ User 2: ${user2}`); // null
  console.log(`✓ Post 1: ${JSON.stringify(post1)}`); // Still exists

  console.log('\n🎉 Example completed!');
}

main().catch(console.error);
