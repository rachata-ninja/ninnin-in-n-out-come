import { describe, expect, it } from 'vitest';
import handler, { MCP_TOOLS, type VercelRequest, type VercelResponse } from '../../api/mcp';

interface MockReqResResult {
  req: VercelRequest;
  res: VercelResponse & {
    _getData: () => unknown;
    _getStatus: () => number;
    _getHeaders: () => Record<string, string>;
  };
}

function createMockReqRes(options: {
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}): MockReqResResult {
  const req = {
    method: options.method,
    body: options.body,
    headers: options.headers || {},
    query: options.query || {},
  } as unknown as VercelRequest;

  let statusCode = 200;
  let responseData: unknown = null;
  const headers: Record<string, string> = {};

  const res = {
    statusCode,
    setHeader: (k: string, v: string | number | readonly string[]) => {
      headers[k.toLowerCase()] = String(v);
      return res;
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: unknown) => {
      responseData = data;
      return res;
    },
    send: (data: unknown) => {
      responseData = data;
      return res;
    },
    write: (data: unknown) => {
      responseData = String(responseData || '') + String(data);
      return true;
    },
    end: () => {},
    _getData: () => responseData,
    _getStatus: () => statusCode,
    _getHeaders: () => headers,
  };

  return { req, res: res as unknown as MockReqResResult['res'] };
}

describe('api/mcp Serverless Handler', () => {
  it('handles GET request returning valid OpenAPI 3.0 schema', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatus()).toBe(200);
    const data = res._getData() as { openapi: string; paths: Record<string, unknown>; info: { title: string } };
    expect(data.openapi).toBe('3.0.0');
    expect(data.paths['/api/mcp']).toBeDefined();
    expect(data.info.title).toContain('NinJahMajod');
  });

  it('handles GET request with format=mcp returning MCP tools list', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', query: { format: 'mcp' } });
    await handler(req, res);

    expect(res._getStatus()).toBe(200);
    const data = res._getData() as { name: string; tools: Array<{ name: string }> };
    expect(data.name).toBe('ninjahmajod-mcp-server');
    expect(data.tools).toHaveLength(MCP_TOOLS.length);
  });

  it('handles GET request with SSE accept header', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });
    await handler(req, res);

    expect(res._getHeaders()['content-type']).toBe('text/event-stream');
    expect(String(res._getData())).toContain('event: endpoint');
  });

  it('handles MCP initialize JSON-RPC request', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      },
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(200);
    const data = res._getData() as { result: { serverInfo: { name: string }; capabilities: { tools: unknown } } };
    expect(data.result.serverInfo.name).toBe('ninjahmajod-mcp-server');
    expect(data.result.capabilities.tools).toBeDefined();
  });

  it('handles MCP tools/list JSON-RPC request', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      },
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(200);
    const data = res._getData() as { result: { tools: unknown[] } };
    expect(data.result.tools).toHaveLength(5);
  });

  it('handles ping request', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
      },
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(200);
    const data = res._getData() as { result: Record<string, unknown> };
    expect(data.result).toEqual({});
  });

  it('validates API key when MCP_API_KEY environment variable is configured', async () => {
    process.env.MCP_API_KEY = 'secret-key-123';

    // Without key -> 401
    const { req: unauthReq, res: unauthRes } = createMockReqRes({ method: 'GET' });
    await handler(unauthReq, unauthRes);
    expect(unauthRes._getStatus()).toBe(401);

    // With key in headers -> 200
    const { req: authReq, res: authRes } = createMockReqRes({
      method: 'GET',
      headers: { authorization: 'Bearer secret-key-123' },
    });
    await handler(authReq, authRes);
    expect(authRes._getStatus()).toBe(200);

    delete process.env.MCP_API_KEY;
  });

  it('rejects unauthenticated tool calls when no user credentials or tokens are provided', async () => {
    delete process.env.SUPABASE_USER_EMAIL;
    delete process.env.SUPABASE_USER_PASSWORD;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_USER_ID;

    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        tool: 'record_transaction',
        args: { amount: 50, note: 'lunch' },
      },
    });

    await handler(req, res);
    expect(res._getStatus()).toBe(401);
    const data = res._getData() as { error?: string; jsonrpc?: string; error_description?: string; message?: string; [k: string]: unknown };
    const errObj = (data.error && typeof data.error === 'object') ? (data.error as { message: string }) : null;
    const msg = errObj?.message || data.error || data.message || '';
    expect(String(msg)).toContain('Unauthorized');
  });
});
