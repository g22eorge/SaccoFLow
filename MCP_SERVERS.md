# MCP Servers

## Shadcn MCP

This repo now includes `.mcp.json` with a Shadcn MCP server entry using:

- package: `@jpisnice/shadcn-ui-mcp-server`
- command: `bunx -y @jpisnice/shadcn-ui-mcp-server`

Optional environment variable for higher GitHub API limits:

- `GITHUB_PERSONAL_ACCESS_TOKEN`

## Notes

- Without a GitHub token, the server can still run, but may hit lower rate limits.
- If your MCP client does not read `.mcp.json`, copy the same server entry into that tool's MCP config.
