import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MusepadApiError, type MusepadClient, type MusepadDeploy } from '@musepadlol/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerTools } from './tools.js';

const DEPLOY: MusepadDeploy = {
  id: '66d1f2b8c1a4e5f6a7b8c9d0',
  sourcePlatform: 'api',
  sourceThreadId: 'k',
  sourceChannel: 'some-agent',
  sourceThreadTitle: 'Launched via Musepad API',
  sourceThreadUrl: 'https://api.musepad.lol/api/musepad/deploys/66d1f2b8c1a4e5f6a7b8c9d0',
  sourceAuthor: 'some-agent',
  token: { name: 'Test', symbol: 'TEST', wallet: '0xabc', paypal: null, description: '', imageUrl: null },
  status: 'deployed',
  deployTxHash: '0xtx',
  deployedTokenAddress: '0xtoken',
  deployError: null,
  replyPostId: null,
  createdAt: '2026-09-23T00:00:00.000Z',
  updatedAt: '2026-09-23T00:00:00.000Z',
};

describe('registerTools', () => {
  let client: { launchToken: ReturnType<typeof vi.fn>; getDeploy: ReturnType<typeof vi.fn>; listTokens: ReturnType<typeof vi.fn> };
  let mcpClient: Client;

  const textOf = (result: Awaited<ReturnType<Client['callTool']>>): string => {
    const content = result.content as { type: string; text: string }[];
    return content[0]!.text;
  };

  beforeEach(async () => {
    client = { launchToken: vi.fn(), getDeploy: vi.fn(), listTokens: vi.fn() };

    const server = new McpServer({ name: 'musepad-test', version: '0.0.0' });
    registerTools(server, client as unknown as MusepadClient);

    mcpClient = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
  });

  it('lists all three tools', async () => {
    const { tools } = await mcpClient.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_deploy_status', 'launch_token', 'query_tokens']);
  });

  describe('launch_token', () => {
    it('calls MusepadClient.launchToken and returns the deploy as JSON', async () => {
      client.launchToken.mockResolvedValue(DEPLOY);

      const result = await mcpClient.callTool({
        name: 'launch_token',
        arguments: { name: 'Test', symbol: 'TEST', wallet: '0xabc', idempotencyKey: 'k' },
      });

      expect(client.launchToken).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test', symbol: 'TEST', wallet: '0xabc', idempotencyKey: 'k' }));
      expect(JSON.parse(textOf(result))).toEqual(DEPLOY);
      expect(result.isError).toBeFalsy();
    });

    it('returns a tool error result, not a thrown exception, when the API rejects the call', async () => {
      client.launchToken.mockRejectedValue(
        new MusepadApiError(409, { statusCode: 409, error: 'CONFLICT', message: 'already used', path: '/api/musepad/launch', timestamp: 'now' }),
      );

      const result = await mcpClient.callTool({
        name: 'launch_token',
        arguments: { name: 'Test', symbol: 'TEST', wallet: '0xabc', idempotencyKey: 'k' },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('409');
      expect(textOf(result)).toContain('already used');
    });
  });

  describe('get_deploy_status', () => {
    it('calls MusepadClient.getDeploy with the given id', async () => {
      client.getDeploy.mockResolvedValue(DEPLOY);

      const result = await mcpClient.callTool({ name: 'get_deploy_status', arguments: { id: DEPLOY.id } });

      expect(client.getDeploy).toHaveBeenCalledWith(DEPLOY.id);
      expect(JSON.parse(textOf(result))).toEqual(DEPLOY);
    });
  });

  describe('query_tokens', () => {
    it('calls MusepadClient.listTokens with the given query', async () => {
      const page = { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 };
      client.listTokens.mockResolvedValue(page);

      const result = await mcpClient.callTool({ name: 'query_tokens', arguments: { sort: 'new', pageSize: 5 } });

      expect(client.listTokens).toHaveBeenCalledWith(expect.objectContaining({ sort: 'new', pageSize: 5 }));
      expect(JSON.parse(textOf(result))).toEqual(page);
    });
  });
});
