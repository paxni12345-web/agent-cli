import { InMemoryApprovalStore } from '../../src/gateway/approvalStore.js';
import type { ApprovalRequest } from '../../src/gateway/types.js';

const mk = (id: string, createdAt = 1000, choices: ApprovalRequest['choices'] = ['once', 'deny']): ApprovalRequest => ({
  id, upstreamId: `up-${id}`, kind: 'shell', summary: 'touch /tmp/x', choices, createdAt,
});

describe('InMemoryApprovalStore', () => {
  it('stores and returns an approval; put is idempotent', () => {
    const s = new InMemoryApprovalStore({ now: () => 1000 });
    s.put('sess', 'u1', mk('a'));
    s.put('sess', 'u1', { ...mk('a'), summary: 'changed' });
    expect(s.get('a')?.approval.summary).toBe('touch /tmp/x');
    expect(s.get('missing')).toBeNull();
  });

  it('first writer wins: two simultaneous resolves give one resolved and one already_resolved', async () => {
    const s = new InMemoryApprovalStore({ now: () => 1000 });
    s.put('sess', 'u1', mk('a'));
    const [x, y] = await Promise.all([
      Promise.resolve().then(() => s.resolve('a', 'once', 'u1')),
      Promise.resolve().then(() => s.resolve('a', 'deny', 'u1')),
    ]);
    expect([x, y].sort()).toEqual(['already_resolved', 'resolved']);
    expect(s.get('a')?.resolved?.choice).toBe('once');
  });

  it('only the owning user can resolve', () => {
    const s = new InMemoryApprovalStore({ now: () => 1000 });
    s.put('sess', 'u1', mk('a'));
    expect(s.resolve('a', 'once', 'u2')).toBe('forbidden');
    expect(s.get('a')?.resolved).toBeUndefined();
  });

  it('rejects choices the gateway did not offer', () => {
    const s = new InMemoryApprovalStore({ now: () => 1000 });
    s.put('sess', 'u1', mk('a', 1000, ['once', 'deny']));
    expect(s.resolve('a', 'always', 'u1')).toBe('invalid_choice');
    expect(s.resolve('a', 'once', 'u1')).toBe('resolved');
  });

  it('unknown id is not_found', () => {
    expect(new InMemoryApprovalStore().resolve('nope', 'once', 'u1')).toBe('not_found');
  });

  it('expired approvals cannot be resolved and are not pending', () => {
    let t = 1000;
    const s = new InMemoryApprovalStore({ ttlMs: 500, now: () => t });
    s.put('sess', 'u1', mk('a', 1000));
    expect(s.pending('u1')).toHaveLength(1);
    t = 1600;
    expect(s.pending('u1')).toHaveLength(0);
    expect(s.resolve('a', 'once', 'u1')).toBe('expired');
  });

  it('pending lists only the user’s unresolved approvals, oldest first', () => {
    const s = new InMemoryApprovalStore({ now: () => 1000 });
    s.put('s1', 'u1', mk('late', 1100));
    s.put('s1', 'u1', mk('early', 1000));
    s.put('s2', 'u2', mk('other', 1000));
    s.put('s1', 'u1', mk('done', 1050));
    s.resolve('done', 'deny', 'u1');
    expect(s.pending('u1').map((a) => a.id)).toEqual(['early', 'late']);
  });
});
