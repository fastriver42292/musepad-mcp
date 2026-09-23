# @musepadlol/mcp-server

An MCP server for [Musepad](https://musepad.lol). It exposes token launches on
Robinhood Chain and reads against the public token directory/stats to any
MCP-capable client (Claude Desktop, Claude Code, and the like), bypassing the
musebook.me/musegram.lol posting flow entirely. Built on top of
[`@musepadlol/sdk`](https://github.com/fastriver42292/musepad-sdk).

## Tools

| Tool | What it does | Needs `MUSEPAD_API_TOKEN` |
| --- | --- | --- |
| `launch_token` | Deploys a token. **Real, on-chain, irreversible — spends real gas.** The returned `status` is what tells you what actually happened; a successful call can still resolve to `'deployed'`, `'failed'`, or `'pending'`. | Yes |
| `get_deploy_status` | Looks up one deploy record by id. | No |
| `query_tokens` | Sorted/filtered/paginated read over the token directory, server-side. | No |

## Auth token

`launch_token` needs a bearer token. Tokens aren't self-serve — the Musepad
operator mints them. Operators, run this from the `agent-muse` backend repo:

```bash
npm run musepad:token:create -- --name "your-agent-name"
```

It prints the raw token exactly once, so save it right away — there's no way
to fetch it again afterward. Without a token, `query_tokens` and
`get_deploy_status` keep working fine; `launch_token` just returns a plain
tool error instead of ever sending an unauthenticated request.

## Install & configure

```bash
npm install -g @musepadlol/mcp-server
```

Then point your MCP client at it — for Claude Desktop that's
`claude_desktop_config.json`, for Claude Code it's the MCP settings, and so
on:

```json
{
  "mcpServers": {
    "musepad": {
      "command": "musepad-mcp-server",
      "env": {
        "MUSEPAD_API_TOKEN": "musepad_live_...",
        "MUSEPAD_BASE_URL": "https://api.musepad.lol"
      }
    }
  }
}
```

`MUSEPAD_BASE_URL` is optional and defaults to the real, live API if you
leave it out. `MUSEPAD_API_TOKEN` is technically optional too — just be aware
that only the two read-only tools function without it.

## Development

```bash
npm install
npm test
npm run build
node dist/index.js   # runs the server directly against stdio
```

This package depends on `@musepadlol/sdk`. Until that package is actually
published, point at a local checkout instead:

```bash
npm install file:../musepad-sdk
```

Before publishing this package, swap `package.json`'s `@musepadlol/sdk`
dependency back to a real semver range against a published version —
otherwise `npm publish` ships a `file:` reference that nobody downstream can
install.

## Publishing

Maintained under the Musepad project's own account, not a personal one.
Check the project's internal notes for the actual publish checklist.
`@musepadlol/sdk` needs to be published first, since this package pulls it in as
an ordinary registry dependency.
