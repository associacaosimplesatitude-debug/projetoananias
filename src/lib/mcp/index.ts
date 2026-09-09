import { defineMcp, auth } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";

const SUPABASE_URL = "https://nccyrvfnvjngfyfvgnww.supabase.co";

export default defineMcp({
  name: "gestaoebd-mcp",
  title: "Gestão EBD MCP",
  version: "0.1.0",
  instructions:
    "MCP server for the Gestão EBD app. Use the `echo` tool to verify connectivity. Additional tools can be added under src/lib/mcp/tools/.",
  // Require a verified access token issued by the app's auth server.
  // Anonymous callers can no longer reach any tool.
  auth: auth.oauth.issuer({
    issuer: `${SUPABASE_URL}/auth/v1`,
    jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    acceptedAudiences: "authenticated",
    resource: `${SUPABASE_URL}/functions/v1/mcp`,
    resourceName: "Gestão EBD MCP",
  }),
  tools: [echoTool],
});
