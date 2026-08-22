import { executeMcpTool, MCP_TOOLS } from '../src/server/mcpTools';
import { getSupabaseContext, type UserAuthCredentials } from '../src/server/supabaseService';

export interface VercelRequest {
  query: Record<string, string | string[]>;
  body: unknown;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => VercelResponse;
  send: (body: unknown) => VercelResponse;
  write: (chunk: unknown) => boolean;
  end: () => void;
  setHeader: (name: string, value: string | number | readonly string[]) => this;
}

function extractAuthCredentials(req: VercelRequest, payload?: Record<string, unknown>): UserAuthCredentials {
  const authHeader = (req.headers.authorization as string) || '';
  const keyHeader = (req.headers['x-user-key'] as string) || (req.headers['x-api-key'] as string) || '';
  const queryKey = (req.query?.key as string) || (req.query?.apiKey as string) || (req.query?.token as string);
  const bodyKey = (payload?.key as string) || (payload?.apiKey as string) || (payload?.token as string);

  const key =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader) ||
    keyHeader ||
    queryKey ||
    bodyKey;

  const userId =
    (req.headers['x-user-id'] as string) ||
    (req.query?.userId as string) ||
    (payload?.userId as string);

  return { key, token: key, userId };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-user-key, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  // 2. Optional Global Server API Key Validation
  const expectedApiKey = process.env.MCP_API_KEY;
  if (expectedApiKey) {
    const authHeader = (req.headers.authorization as string) || '';
    const xApiKey = (req.headers['x-api-key'] as string) || '';
    const queryApiKey = (req.query?.apiKey as string) || (req.query?.token as string);

    const providedKey =
      (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader) ||
      xApiKey ||
      queryApiKey;

    if (providedKey !== expectedApiKey) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing MCP_API_KEY',
      });
    }
  }

  // 3. GET Request - Server Info / Discovery / SSE
  if (req.method === 'GET') {
    const acceptHeader = String(req.headers.accept || '');
    if (acceptHeader.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.write('event: endpoint\ndata: /api/mcp\n\n');
      return;
    }

    return res.status(200).json({
      name: 'ninjahmajod-mcp-server',
      version: '1.0.0',
      description: 'NinJahMajod MCP Server for Google Gemini & Voice expense logging (Passwordless API Key)',
      tools: MCP_TOOLS,
      endpoints: {
        mcpJsonRpc: 'POST /api/mcp',
        sseStream: 'GET /api/mcp (Accept: text/event-stream)',
      },
      authentication: {
        supported: ['Personal API Key (?key=ninja_key_...)', 'Bearer JWT Token (Authorization: Bearer ...)'],
      },
    });
  }

  // 3. POST Request - MCP JSON-RPC & Direct Tool Calling
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: Invalid JSON' },
          id: null,
        });
      }
    }

    const payload = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const userAuth = extractAuthCredentials(req, payload);

    // Direct REST tool calling helper (for easy webhook / shortcut integration)
    if (payload.tool && typeof payload.tool === 'string') {
      try {
        const context = await getSupabaseContext(userAuth);
        const args = (typeof payload.args === 'object' && payload.args !== null ? payload.args : {}) as Record<string, unknown>;
        const result = await executeMcpTool(context, payload.tool, args);
        return res.status(result.isError ? 400 : 200).json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ error: message });
      }
    }

    // Standard MCP JSON-RPC 2.0 Protocol Handler
    const id = payload.id;
    const method = payload.method as string | undefined;
    const params = (typeof payload.params === 'object' && payload.params !== null ? payload.params : {}) as Record<string, unknown>;

    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request: missing method' },
        id: id ?? null,
      });
    }

    try {
      switch (method) {
        case 'initialize':
          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: {
                name: 'ninjahmajod-mcp-server',
                version: '1.0.0',
              },
            },
          });

        case 'notifications/initialized':
          return res.status(200).json({ jsonrpc: '2.0', id: id ?? null, result: {} });

        case 'ping':
          return res.status(200).json({ jsonrpc: '2.0', id, result: {} });

        case 'tools/list':
          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            result: {
              tools: MCP_TOOLS,
            },
          });

        case 'tools/call': {
          const toolName = params.name as string | undefined;
          const toolArgs = (typeof params.arguments === 'object' && params.arguments !== null ? params.arguments : {}) as Record<string, unknown>;

          if (!toolName) {
            return res.status(400).json({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Invalid params: missing tool name' },
            });
          }

          const context = await getSupabaseContext(userAuth);
          const toolResult = await executeMcpTool(context, toolName, toolArgs);

          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: toolResult.text }],
              isError: Boolean(toolResult.isError),
            },
          });
        }

        default:
          return res.status(404).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message },
      });
    }
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
