import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MusepadApiError, MusepadClient, type ListTokensQuery } from '@musepadlol/sdk';
import { z } from 'zod';

const jsonResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });

const errorResult = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true as const,
});

/** Used in every tool's catch block: turns an upstream 4xx/5xx into a tool error result the model can see and react to, instead of an uncaught exception that would take the process down. */
const describeError = (error: unknown): string =>
  error instanceof MusepadApiError
    ? `Musepad API error (${error.status}): ${Array.isArray(error.body?.message) ? error.body.message.join('; ') : (error.body?.message ?? error.message)}`
    : error instanceof Error
      ? error.message
      : String(error);

const LAUNCH_TOKEN_SHAPE = {
  name: z.string().max(128).describe('Token name'),
  symbol: z.string().max(32).describe('Token ticker/symbol'),
  wallet: z
    .string()
    .optional()
    .describe("The on-chain 0x... address set as creatorFeeRecipient. Exactly one of wallet/paypal is required."),
  paypal: z
    .string()
    .optional()
    .describe('A PayPal email or PayPal.me handle, used instead of wallet. Exactly one of wallet/paypal is required.'),
  description: z.string().max(2048).optional().describe('Free-form description of the token'),
  imageUrl: z.string().optional().describe("URL for the token's icon"),
  platform: z.enum(['robinhood', 'bankr']).optional().describe("Deploy mechanism to use. Defaults to 'robinhood' (Pons/MuseFactory) when omitted."),
  quote: z.enum(['meta', 'musebook']).optional().describe("Quote asset for a 'robinhood'-platform launch. Defaults to 'meta' when omitted."),
  idempotencyKey: z
    .string()
    .max(256)
    .describe('Unique key for this specific attempt. Reusing a key returns 409 rather than triggering a second deploy — generate a new one for every genuinely new launch.'),
};

const GET_DEPLOY_STATUS_SHAPE = {
  id: z.string().describe('The deploy record id, e.g. returned by launch_token or query_tokens.'),
};

const QUERY_TOKENS_SHAPE = {
  sort: z.enum(['hot', 'new', 'mcap', 'volume', 'sourcePlatform']).describe('hot: |changePct| desc. new: launch time desc. mcap/volume: respective USD figure desc.'),
  platform: z.string().optional().describe("Exact-match platform filter, e.g. '#memecoins'. Omit for every platform."),
  launchpad: z.enum(['pons', 'bankr', 'muse-launchpad']).optional().describe('Exact-match launch-mechanism filter. Omit for every launchpad.'),
  page: z.number().int().min(1).optional().describe('1-based page number. Defaults to 1.'),
  pageSize: z.number().int().min(1).max(100).optional().describe('Items per page, 1-100. Defaults to 10.'),
};

/**
 * Registers every Musepad tool onto `server`, wired to `client`. Kept
 * separate from `index.ts`'s stdio bootstrap so tests can exercise it
 * against a mocked `MusepadClient` — no real transport or network call
 * needed.
 */
export const registerTools = (server: McpServer, client: MusepadClient): void => {
  server.registerTool(
    'launch_token',
    {
      title: 'Launch a Musepad token',
      description:
        'Deploys a token on Robinhood Chain straight through the Musepad API — no musebook.me/musegram.lol post needed. ' +
        'REAL, ON-CHAIN, IRREVERSIBLE: gas is spent the moment this call succeeds. The returned `status` is the actual outcome — ' +
        "'deployed' means live, but 'failed' and 'pending' are both ordinary 200-level results too, not a plain pass/fail. " +
        'Needs MUSEPAD_API_TOKEN configured; if it is not, this tool fails with a clear error rather than sending an unauthenticated request.',
      inputSchema: LAUNCH_TOKEN_SHAPE,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      try {
        const deploy = await client.launchToken(input);
        return jsonResult(deploy);
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    'get_deploy_status',
    {
      title: 'Get a Musepad deploy record',
      description: 'Looks up one deploy attempt by id. Same record shape launch_token returns. Public, read-only.',
      inputSchema: GET_DEPLOY_STATUS_SHAPE,
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      try {
        return jsonResult(await client.getDeploy(id));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    'query_tokens',
    {
      title: 'List Musepad-launched tokens',
      description: 'A sorted, filtered, paginated read over the token directory: market cap, volume, launch platform, and so on. Public, read-only, no API token required.',
      inputSchema: QUERY_TOKENS_SHAPE,
      annotations: { readOnlyHint: true },
    },
    async (query) => {
      try {
        return jsonResult(await client.listTokens(query as ListTokensQuery));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
};
