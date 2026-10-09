describe('sandbox mode without a key', () => {
  it('stops the server instead of running tools locally', async () => {
    process.env.AGENT_SANDBOX = 'e2b';
    delete process.env.E2B_API_KEY;
    await expect(import('../../src/agent-server.js')).rejects.toThrow(/E2B_API_KEY/);
  });
});
