import { executeMcpTool, MCP_TOOLS } from '../src/server/mcpTools';
import { getSupabaseContext, type UserAuthCredentials } from '../src/server/supabaseService';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-api-key, x-user-key, x-user-id, x-user-email, x-user-password',
};

export interface VercelRequest {
  url?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => VercelResponse;
  send: (body: unknown) => VercelResponse;
  write?: (chunk: unknown) => boolean;
  end?: () => void;
  setHeader: (name: string, value: string | number | readonly string[]) => this;
}

function parseNodeAuth(req: VercelRequest, payload?: Record<string, unknown>): UserAuthCredentials {
  let urlParams: URLSearchParams | null = null;
  try {
    if (req.url) {
      urlParams = new URL(req.url, 'http://localhost').searchParams;
    }
  } catch {
    urlParams = null;
  }

  const authHeader = (req.headers?.authorization as string) || '';
  const keyHeader =
    (req.headers?.['x-user-key'] as string) ||
    (req.headers?.['x-api-key'] as string) ||
    '';

  const queryKey =
    urlParams?.get('key') ||
    urlParams?.get('apiKey') ||
    urlParams?.get('token') ||
    (req.query?.key as string) ||
    (req.query?.apiKey as string) ||
    (req.query?.token as string);

  const bodyKey =
    (payload?.key as string) ||
    (payload?.apiKey as string) ||
    (payload?.token as string);

  const key =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader) ||
    keyHeader ||
    queryKey ||
    bodyKey;

  const email =
    (req.headers?.['x-user-email'] as string) ||
    urlParams?.get('email') ||
    (req.query?.email as string) ||
    (payload?.email as string);

  const password =
    (req.headers?.['x-user-password'] as string) ||
    urlParams?.get('password') ||
    (req.query?.password as string) ||
    (payload?.password as string);

  const userId =
    (req.headers?.['x-user-id'] as string) ||
    urlParams?.get('userId') ||
    (req.query?.userId as string) ||
    (payload?.userId as string);

  return { key, token: key, email, password, userId };
}

function parseWebAuth(request: Request, payload?: Record<string, unknown>): UserAuthCredentials {
  const url = new URL(request.url);
  const authHeader = request.headers.get('authorization') || '';
  const keyHeader =
    request.headers.get('x-user-key') ||
    request.headers.get('x-api-key') ||
    '';

  const queryKey =
    url.searchParams.get('key') ||
    url.searchParams.get('apiKey') ||
    url.searchParams.get('token');

  const bodyKey =
    (payload?.key as string) ||
    (payload?.apiKey as string) ||
    (payload?.token as string);

  const key =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader) ||
    keyHeader ||
    queryKey ||
    bodyKey ||
    undefined;

  const email =
    request.headers.get('x-user-email') ||
    url.searchParams.get('email') ||
    (payload?.email as string) ||
    undefined;

  const password =
    request.headers.get('x-user-password') ||
    url.searchParams.get('password') ||
    (payload?.password as string) ||
    undefined;

  const userId =
    request.headers.get('x-user-id') ||
    url.searchParams.get('userId') ||
    (payload?.userId as string) ||
    undefined;

  return { key, token: key, email, password, userId };
}

async function handleWeb(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response('OK', { status: 200, headers: CORS_HEADERS });
  }

  // Global Server API Key Validation
  const expectedApiKey = process.env.MCP_API_KEY;
  if (expectedApiKey) {
    const url = new URL(request.url);
    const authHeader = request.headers.get('authorization') || '';
    const keyHeader = request.headers.get('x-api-key') || '';
    const queryKey = url.searchParams.get('apiKey') || url.searchParams.get('token');
    const provided =
      (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader) ||
      keyHeader ||
      queryKey;

    if (provided !== expectedApiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing MCP_API_KEY' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  if (method === 'GET') {
    const accept = request.headers.get('accept') || '';
    if (accept.includes('text/event-stream')) {
      return new Response('event: endpoint\ndata: /api/mcp\n\n', {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    return new Response(
      JSON.stringify({
        name: 'ninjahmajod-mcp-server',
        version: '1.0.0',
        description: 'NinJahMajod MCP Server for Google Gemini & Voice expense logging',
        tools: MCP_TOOLS,
        endpoints: {
          mcpJsonRpc: 'POST /api/mcp',
          sseStream: 'GET /api/mcp (Accept: text/event-stream)',
        },
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (method === 'POST') {
    let payload: Record<string, unknown> = {};
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const userAuth = parseWebAuth(request, payload);

    if (payload.tool && typeof payload.tool === 'string') {
      try {
        const context = await getSupabaseContext(userAuth);
        const args = (typeof payload.args === 'object' && payload.args !== null ? payload.args : {}) as Record<string, unknown>;
        const result = await executeMcpTool(context, payload.tool, args);
        return new Response(JSON.stringify(result), {
          status: result.isError ? 400 : 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    const id = payload.id;
    const rpcMethod = payload.method as string | undefined;
    const params = (typeof payload.params === 'object' && payload.params !== null ? payload.params : {}) as Record<string, unknown>;

    if (!rpcMethod) {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Missing method' }, id: id ?? null }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    try {
      switch (rpcMethod) {
        case 'initialize':
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'ninjahmajod-mcp-server', version: '1.0.0' },
              },
            }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );

        case 'notifications/initialized':
          return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result: {} }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });

        case 'ping':
          return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: {} }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });

        case 'tools/list':
          return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });

        case 'tools/call': {
          const toolName = params.name as string | undefined;
          const toolArgs = (typeof params.arguments === 'object' && params.arguments !== null ? params.arguments : {}) as Record<string, unknown>;
          if (!toolName) {
            return new Response(
              JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing tool name' } }),
              { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
            );
          }

          const context = await getSupabaseContext(userAuth);
          const toolResult = await executeMcpTool(context, toolName, toolArgs);

          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: toolResult.text }],
                isError: Boolean(toolResult.isError),
              },
            }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );
        }

        default:
          return new Response(
            JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${rpcMethod}` } }),
            { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
    status: 405,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export async function GET(request: Request): Promise<Response> {
  return handleWeb(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleWeb(request);
}

export async function OPTIONS(): Promise<Response> {
  return new Response('OK', { status: 200, headers: CORS_HEADERS });
}

export default async function handler(
  req: VercelRequest | Request,
  res?: VercelResponse,
): Promise<unknown> {
  // 1. If invoked as Web Standard Request (Edge / Modern Vercel Runtime)
  if (typeof Request !== 'undefined' && req instanceof Request) {
    return handleWeb(req);
  }

  const nodeReq = req as VercelRequest;
  const nodeRes = res as VercelResponse;

  if (!nodeRes || typeof nodeRes.setHeader !== 'function') {
    if ('url' in nodeReq && typeof nodeReq.url === 'string') {
      const fetchRequest = new Request(nodeReq.url, {
        method: nodeReq.method || 'GET',
        headers: (nodeReq.headers as HeadersInit) || {},
        body: nodeReq.body ? JSON.stringify(nodeReq.body) : undefined,
      });
      return handleWeb(fetchRequest);
    }
    return;
  }

  // 2. Node.js Standard Runtime
  try {
    for (const [key, val] of Object.entries(CORS_HEADERS)) {
      nodeRes.setHeader(key, val);
    }

    if (nodeReq.method === 'OPTIONS') {
      return nodeRes.status(200).send('OK');
    }

    const expectedApiKey = process.env.MCP_API_KEY;
    if (expectedApiKey) {
      const auth = parseNodeAuth(nodeReq);
      if (auth.token !== expectedApiKey && auth.key !== expectedApiKey) {
        return nodeRes.status(401).json({
          error: 'Unauthorized: Invalid or missing MCP_API_KEY',
        });
      }
    }

    if (nodeReq.method === 'GET') {
      const acceptHeader = String(nodeReq.headers?.accept || '');
      if (acceptHeader.includes('text/event-stream')) {
        nodeRes.setHeader('Content-Type', 'text/event-stream');
        nodeRes.setHeader('Cache-Control', 'no-cache, no-transform');
        nodeRes.setHeader('Connection', 'keep-alive');
        if (typeof nodeRes.write === 'function') {
          nodeRes.write('event: endpoint\ndata: /api/mcp\n\n');
        }
        return;
      }

      return nodeRes.status(200).json({
        name: 'ninjahmajod-mcp-server',
        version: '1.0.0',
        description: 'NinJahMajod MCP Server for Google Gemini & Voice expense logging',
        tools: MCP_TOOLS,
        endpoints: {
          mcpJsonRpc: 'POST /api/mcp',
          sseStream: 'GET /api/mcp (Accept: text/event-stream)',
        },
      });
    }

    if (nodeReq.method === 'POST') {
      let body = nodeReq.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return nodeRes.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error: Invalid JSON' },
            id: null,
          });
        }
      }

      const payload = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
      const userAuth = parseNodeAuth(nodeReq, payload);

      if (payload.tool && typeof payload.tool === 'string') {
        try {
          const context = await getSupabaseContext(userAuth);
          const args = (typeof payload.args === 'object' && payload.args !== null ? payload.args : {}) as Record<string, unknown>;
          const result = await executeMcpTool(context, payload.tool, args);
          return nodeRes.status(result.isError ? 400 : 200).json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return nodeRes.status(500).json({ error: message });
        }
      }

      const id = payload.id;
      const method = payload.method as string | undefined;
      const params = (typeof payload.params === 'object' && payload.params !== null ? payload.params : {}) as Record<string, unknown>;

      if (!method) {
        return nodeRes.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request: missing method' },
          id: id ?? null,
        });
      }

      try {
        switch (method) {
          case 'initialize':
            return nodeRes.status(200).json({
              jsonrpc: '2.0',
              id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'ninjahmajod-mcp-server', version: '1.0.0' },
              },
            });

          case 'notifications/initialized':
            return nodeRes.status(200).json({ jsonrpc: '2.0', id: id ?? null, result: {} });

          case 'ping':
            return nodeRes.status(200).json({ jsonrpc: '2.0', id, result: {} });

          case 'tools/list':
            return nodeRes.status(200).json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });

          case 'tools/call': {
            const toolName = params.name as string | undefined;
            const toolArgs = (typeof params.arguments === 'object' && params.arguments !== null ? params.arguments : {}) as Record<string, unknown>;

            if (!toolName) {
              return nodeRes.status(400).json({
                jsonrpc: '2.0',
                id,
                error: { code: -32602, message: 'Invalid params: missing tool name' },
              });
            }

            const context = await getSupabaseContext(userAuth);
            const toolResult = await executeMcpTool(context, toolName, toolArgs);

            return nodeRes.status(200).json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: toolResult.text }],
                isError: Boolean(toolResult.isError),
              },
            });
          }

          default:
            return nodeRes.status(404).json({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Method not found: ${method}` },
            });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return nodeRes.status(500).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message },
        });
      }
    }

    return nodeRes.status(405).json({ error: `Method ${nodeReq.method} not allowed` });
  } catch (globalError) {
    const message = globalError instanceof Error ? globalError.message : String(globalError);
    return nodeRes.status(500).json({ error: message });
  }
}
