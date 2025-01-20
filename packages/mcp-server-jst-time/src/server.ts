import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

console.log("Starting server...");

const server = new Server(
  {
    name: "Time MCP Server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_current_time",
        description: "Get the current time in Japan",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  } satisfies ListToolsResult;
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_current_time":
      return {
        content: [
          {
            type: "text",
            text: new Date().toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            }),
          },
        ],
      } satisfies CallToolResult;
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Server connected and ready!");
}

main().catch(console.error);
