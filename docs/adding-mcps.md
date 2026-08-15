# Connect an MCP Server

Use MCP when a service already exposes useful tools. MCP servers are opt-in so
an unavailable third-party server cannot block the Slack agent from starting.

Read Mastra's [MCP overview](https://mastra.ai/docs/mcp/overview) and
[`MCPClient` reference](https://mastra.ai/reference/tools/mcp-client) before
adding remote transports or advanced server options.

## 1. Configure the server

Install `@mastra/mcp`, then create `src/mastra/mcp/index.ts`:

```ts
import { MCPClient } from '@mastra/mcp';

export const mcpTools = await new MCPClient({
  id: 'mcp',
  servers: {
    context7: {
      url: new URL('https://mcp.context7.com/mcp'),
    },
  },
}).listTools();
```

Add another entry to `servers`, or replace `context7` with the service your
agent needs. Remote transports are supported, but verify the options against
`node_modules/@mastra/mcp/dist/docs/` because MCP configuration changes between
Mastra versions.

## 2. Register the tools

```ts
import { mcpTools } from '../mcp';

export const deferredTools = {
  // local tools
  ...mcpTools,
};
```

Add this registration to `src/mastra/tools/toolsets.ts`.

## 3. Validate

Run typecheck first. It catches configuration differences between the template
and examples written for other `@mastra/mcp` versions.

```bash
bun run typecheck
bun run check
bun run check:spelling
```
