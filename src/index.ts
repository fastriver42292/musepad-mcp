#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MusepadClient } from '@musepadlol/sdk';

import { registerTools } from './tools.js';
import { VERSION } from './version.js';

const apiToken = process.env.MUSEPAD_API_TOKEN || undefined;
const baseUrl = process.env.MUSEPAD_BASE_URL || undefined;

if (!apiToken) {
  // Non-fatal: both read tools work fine without a token. launch_token
  // already fails clearly per-call when one is missing (see tools.ts); this
  // is just a heads-up printed once at startup.
  console.error('musepad-mcp-server: MUSEPAD_API_TOKEN is not set — launch_token will be unavailable until it is.');
}

const client = new MusepadClient({ apiToken, baseUrl });
const server = new McpServer({ name: 'musepad', version: VERSION });
registerTools(server, client);

await server.connect(new StdioServerTransport());
