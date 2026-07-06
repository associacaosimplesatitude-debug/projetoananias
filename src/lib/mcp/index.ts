import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";

export default defineMcp({
  name: "gestaoebd-mcp",
  title: "Gestão EBD MCP",
  version: "0.1.0",
  instructions:
    "MCP server for the Gestão EBD app. Use the `echo` tool to verify connectivity. Additional tools can be added under src/lib/mcp/tools/.",
  tools: [echoTool],
});
