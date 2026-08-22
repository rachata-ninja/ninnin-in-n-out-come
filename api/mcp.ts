import type { IncomingMessage, ServerResponse } from 'node:http';
import { executeMcpTool, generateOpenApiSchema, MCP_TOOLS } from '../src/server/mcpTools';
import { getSupabaseContext } from '../src/server/supabaseService';

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: unknown;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => VercelResponse;
  send: (body: unknown) => VercelResponse;
  setHeader: (name: string, value: string | number | readonly string[]) => this;
}

export { MCP_TOOLS };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-user-key, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  try {
    const host = (req.headers.host as string) || 'ninnin-in-n-out-come.vercel.app';
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const hostUrl = `${proto}://${host}`;

    let queryParams: URLSearchParams | null = null;
    try {
      if (req.url) queryParams = new URL(req.url, hostUrl).searchParams;
    } catch {
      queryParams = null;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore parse error
      }
    }
    const payload = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

    const authHeader = (req.headers.authorization as string) || '';
    const keyHeader = (req.headers['x-user-key'] as string) || (req.headers['x-api-key'] as string) || '';
    const queryKey = queryParams?.get('key') || queryParams?.get('apiKey') || queryParams?.get('token') || (req.query?.key as string) || (req.query?.apiKey as string);
    const bodyKey = (payload.key as string) || (payload.apiKey as string) || (payload.token as string);

    const userKey =
      (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader) ||
      keyHeader ||
      queryKey ||
      bodyKey ||
      '';

    // Global Server API Key check (if configured in env)
    const expectedApiKey = process.env.MCP_API_KEY;
    if (expectedApiKey && userKey !== expectedApiKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing MCP_API_KEY' });
    }

    // 2. GET Request - Returns Dual OpenAPI 3.0.0 & MCP Schema for Gemini Spark & MCP Clients
    if (req.method === 'GET') {
      const acceptHeader = String(req.headers.accept || '');
      if (acceptHeader.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.write === 'function') {
          res.write('event: endpoint\ndata: /api/mcp\n\n');
        }
        res.end();
        return;
      }

      const openApiSchema = generateOpenApiSchema(hostUrl);

      return res.status(200).json({
        ...openApiSchema,
        name: 'ninjahmajod-mcp-server',
        version: '1.0.0',
        status: 'online',
        tools: MCP_TOOLS,
        endpoints: {
          mcpJsonRpc: 'POST /api/mcp',
          sseStream: 'GET /api/mcp',
        },
      });
    }

    // 3. POST Request - Execution
    if (req.method === 'POST') {
      // Handle MCP Protocol Discovery & Handshake before auth
      const rpcMethod = payload.method as string | undefined;
      const id = payload.id ?? 1;

      if (rpcMethod === 'initialize') {
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'ninjahmajod-mcp-server', version: '1.0.0' },
          },
        });
      }

      if (rpcMethod === 'ping') {
        return res.status(200).json({ jsonrpc: '2.0', id, result: {} });
      }

      if (rpcMethod === 'tools/list') {
        return res.status(200).json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });
      }

      // Connect to Supabase Context
      let context;
      try {
        context = await getSupabaseContext({ key: userKey, token: authHeader });
      } catch (authErr) {
        const authMsg = authErr instanceof Error ? authErr.message : String(authErr);
        return res.status(401).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: `Unauthorized: ${authMsg}`,
          },
          message: `Unauthorized: ${authMsg}`,
        });
      }

      // Determine Tool Name from URL path, RPC method, or payload
      const urlPath = req.url || '';
      let toolName = (payload.tool as string) || (payload.params as { name?: string })?.name || (payload.operationId as string);

      if (!toolName) {
        if (urlPath.includes('get_financial_summary') || urlPath.includes('summary')) {
          toolName = 'get_financial_summary';
        } else if (urlPath.includes('list_recent_transactions') || urlPath.includes('recent')) {
          toolName = 'list_recent_transactions';
        } else if (urlPath.includes('list_categories') || urlPath.includes('categories')) {
          toolName = 'list_categories';
        } else if (urlPath.includes('delete_transaction') || urlPath.includes('delete') || payload.transaction_id) {
          toolName = 'delete_transaction';
        } else if (typeof payload.amount === 'number' || payload.amount || payload.note) {
          toolName = 'record_transaction';
        } else {
          toolName = 'record_transaction';
        }
      }

      const toolArgs: Record<string, unknown> =
        (payload.args as Record<string, unknown>) ||
        (payload.params as { arguments?: Record<string, unknown> })?.arguments ||
        payload;

      // Execute Tool via authoritative executor
      const toolResult = await executeMcpTool(context, toolName, toolArgs);

      if (toolResult.isError) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: toolResult.text },
          text: toolResult.text,
        });
      }

      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: toolResult.text }] },
        ...toolResult,
      });
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('MCP Server Error:', errorMsg);
    return res.status(500).json({ error: errorMsg });
  }
}
