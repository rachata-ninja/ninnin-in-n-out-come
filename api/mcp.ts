import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. Types & Interfaces
// ==========================================
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

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ==========================================
// 2. Authoritative MCP Tools Definition
// ==========================================
export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'record_transaction',
    description:
      'Record an expense, income, or savings transaction into NinJahMajod with smart category matching in Thai & English.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'The amount of money (e.g. 60, 150, 35000).',
        },
        note: {
          type: 'string',
          description:
            'Description of what was spent or earned (e.g. "food", "ข้าวมันไก่", "iced latte", "grab to work", "salary").',
        },
        type: {
          type: 'string',
          enum: ['expense', 'income', 'savings'],
          description: 'Transaction type: "expense" (default), "income", or "savings".',
        },
        category_name: {
          type: 'string',
          description:
            'Optional specific category name hint (e.g. "ค่าอาหาร", "เดินทาง", "ของใช้"). If omitted, it is auto-matched from the note.',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
      },
      required: ['amount', 'note'],
    },
  },
  {
    name: 'get_financial_summary',
    description:
      'Get a summary of total income, expenses, net balance, and category budget usage for a given month.',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'number',
          description: 'Month (1-12). Defaults to current month.',
        },
        year: {
          type: 'number',
          description: 'Year (e.g. 2026). Defaults to current year.',
        },
      },
    },
  },
  {
    name: 'list_recent_transactions',
    description: 'List recent financial transactions with dates, notes, amounts, and categories.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of transactions to return (default 10, max 50).',
        },
        type: {
          type: 'string',
          enum: ['expense', 'income', 'savings'],
          description: 'Filter by transaction type.',
        },
        date: {
          type: 'string',
          description: 'Filter by specific date (YYYY-MM-DD).',
        },
      },
    },
  },
  {
    name: 'list_categories',
    description: 'List all active expense, income, and savings categories and their monthly budgets.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction by its unique ID.',
    inputSchema: {
      type: 'object',
      properties: {
        transaction_id: {
          type: 'string',
          description: 'The unique ID of the transaction to delete.',
        },
      },
      required: ['transaction_id'],
    },
  },
];

// ==========================================
// 3. Smart NLP Category Matcher (Thai & English)
// ==========================================
const DEFAULT_KEYWORD_RULES = [
  { keywords: ['อาหาร', 'ข้าว', 'food', 'lunch', 'dinner', 'breakfast', 'ก๋วยเตี๋ยว', 'ชาบู', 'หมูกระทะ', 'ข้าวมันไก่', 'kfc', 'mcdonald'], categoryNames: ['ค่าอาหาร', 'อาหาร', 'food'] },
  { keywords: ['กาแฟ', 'ชา', 'coffee', 'cafe', 'amazon', 'starbucks', 'ชาเขียว', 'ชานม', 'latte', 'drink'], categoryNames: ['กาแฟ', 'เครื่องดื่ม', 'ค่าอาหาร', 'เซเว่น', 'food'] },
  { keywords: ['ขนม', 'snack', 'dessert', 'เค้ก', 'ไอติม'], categoryNames: ['ขนม', 'snack', 'เซเว่น'] },
  { keywords: ['เซเว่น', '7-11', '711', 'seven', 'lawson', 'cj'], categoryNames: ['เซเว่น', 'seven', 'ของใช้', 'ค่าอาหาร'] },
  { keywords: ['เดินทาง', 'transport', 'bts', 'mrt', 'grab', 'bolt', 'น้ำมัน', 'ค่ารถ', 'วิน', 'แท็กซี่', 'taxi'], categoryNames: ['เดินทาง', 'ค่าเดินทาง', 'transport'] },
  { keywords: ['ค่าห้อง', 'rent', 'หอพัก', 'คอนโด', 'ค่าเช่า', 'ค่าน้ำ', 'ค่าไฟ', 'ค่าเน็ต', 'wifi'], categoryNames: ['ค่าห้อง', 'rent'] },
  { keywords: ['ของใช้', 'household', 'สบู่', 'ยาสีฟัน', 'ผงซักฟอก', 'ทิชชู่', 'big c', 'lotus', 'tops'], categoryNames: ['ของใช้', 'household'] },
  { keywords: ['สุขภาพ', 'health', 'ยา', 'หมอ', 'โรงพยาบาล', 'วิตามิน', 'คลินิก'], categoryNames: ['สุขภาพ', 'health'] },
  { keywords: ['เงินเดือน', 'salary', 'paycheck', 'โบนัส'], categoryNames: ['เงินเดือน', 'salary'] },
  { keywords: ['เงินออม', 'savings', 'ออมเงิน', 'ลงทุน', 'หุ้น'], categoryNames: ['เงินออม', 'savings'] },
];

export function matchCategory(
  categories: Array<{ id: string; name: string; type: string; isActive: boolean }>,
  note: string,
  categoryHint?: string,
  type = 'expense',
) {
  const active = categories.filter((c) => c.isActive !== false);
  if (active.length === 0) return { id: 'other', name: 'อื่นๆ' };

  const pool = active.filter((c) => c.type === type || c.type === 'both');
  const targetPool = pool.length > 0 ? pool : active;

  if (categoryHint) {
    const hint = categoryHint.trim().toLowerCase();
    const found = targetPool.find((c) => c.name.toLowerCase() === hint || c.id.toLowerCase() === hint || c.name.toLowerCase().includes(hint));
    if (found) return found;
  }

  const cleanNote = (note || '').trim().toLowerCase();
  if (cleanNote) {
    const direct = targetPool.find((c) => cleanNote.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cleanNote));
    if (direct) return direct;

    for (const rule of DEFAULT_KEYWORD_RULES) {
      if (rule.keywords.some((kw) => cleanNote.includes(kw.toLowerCase()))) {
        const found = targetPool.find((c) => rule.categoryNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()) || c.id.toLowerCase() === n.toLowerCase()));
        if (found) return found;
      }
    }
  }

  return targetPool.find((c) => c.name.includes('อื่น') || c.name.toLowerCase().includes('other')) || targetPool[0];
}

// ==========================================
// 4. Pure, Strict OpenAPI 3.0.0 Schema (Google Gemini Compliant)
// ==========================================
export function getStrictOpenApiSchema(hostUrl: string) {
  return {
    openapi: '3.0.0',
    info: {
      title: 'NinJahMajod Voice & Finance API',
      description: 'API for Google Gemini to record expenses, view financial summaries, and manage transactions in NinJahMajod.',
      version: '1.0.0',
    },
    servers: [
      {
        url: hostUrl,
        description: 'NinJahMajod Production Server',
      },
    ],
    paths: {
      '/api/mcp': {
        post: {
          operationId: 'record_transaction',
          summary: 'Record an expense or income transaction',
          description: 'Records an expense, income, or savings transaction into NinJahMajod with automatic smart category matching in Thai & English.',
          parameters: [
            {
              name: 'key',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Personal Voice API Key from NinJahMajod settings',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number', description: 'The amount of money spent or earned (e.g. 60, 150, 35000)' },
                    note: { type: 'string', description: 'Description of what was spent or earned (e.g. food, coffee, grab, salary)' },
                    type: { type: 'string', enum: ['expense', 'income', 'savings'], default: 'expense', description: 'Transaction type' },
                    category_name: { type: 'string', description: 'Optional category name hint' },
                    date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
                    key: { type: 'string', description: 'Optional Voice API Key' },
                  },
                  required: ['amount', 'note'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Transaction recorded successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      text: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/summary': {
        post: {
          operationId: 'get_financial_summary',
          summary: 'Get monthly financial summary',
          description: 'Calculates total income, total expenses, net remaining balance, and category budget usage for a given month.',
          parameters: [
            {
              name: 'key',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Personal Voice API Key',
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    month: { type: 'number', description: 'Month (1-12, defaults to current month)' },
                    year: { type: 'number', description: 'Year (e.g. 2026, defaults to current year)' },
                    key: { type: 'string', description: 'Optional Voice API Key' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Summary calculated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      text: { type: 'string' },
                      income: { type: 'number' },
                      expense: { type: 'number' },
                      balance: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/recent': {
        post: {
          operationId: 'list_recent_transactions',
          summary: 'List recent financial transactions',
          description: 'Returns the most recent financial transactions with notes, amounts, dates, and category names.',
          parameters: [
            {
              name: 'key',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Personal Voice API Key',
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    limit: { type: 'number', default: 10, description: 'Number of transactions' },
                    type: { type: 'string', enum: ['expense', 'income', 'savings'], description: 'Filter by type' },
                    date: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
                    key: { type: 'string', description: 'Optional Voice API Key' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Recent transactions list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      text: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/categories': {
        post: {
          operationId: 'list_categories',
          summary: 'List all categories and budgets',
          description: 'Returns all active categories and their monthly budgets in NinJahMajod.',
          parameters: [
            {
              name: 'key',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Personal Voice API Key',
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: 'Optional Voice API Key' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Categories list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      text: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/delete': {
        post: {
          operationId: 'delete_transaction',
          summary: 'Delete a transaction by ID',
          description: 'Deletes a transaction by its unique transaction ID.',
          parameters: [
            {
              name: 'key',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Personal Voice API Key',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transaction_id: { type: 'string', description: 'The unique ID of the transaction to delete' },
                    key: { type: 'string', description: 'Optional Voice API Key' },
                  },
                  required: ['transaction_id'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Transaction deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      text: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'query',
          name: 'key',
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  };
}

// ==========================================
// 5. Main Vercel Serverless Function
// ==========================================
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

    // 2. GET Request
    if (req.method === 'GET') {
      const acceptHeader = String(req.headers.accept || '');
      if (acceptHeader.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        const endpointUrl = req.url ? (req.url.startsWith('http') ? req.url : `${hostUrl}${req.url}`) : `${hostUrl}/api/mcp`;
        if (typeof res.write === 'function') {
          res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);
        }
        res.end();
        return;
      }

      // Check if client explicitly asks for MCP format via query param ?format=mcp
      const isMcpFormat = queryParams?.get('format') === 'mcp' || (req.query?.format as string) === 'mcp';
      if (isMcpFormat) {
        return res.status(200).json({
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

      // Default: Return Strict, Standard OpenAPI 3.0.0 Schema (Google Gemini Spark Compliant)
      const openApiSchema = getStrictOpenApiSchema(hostUrl);
      return res.status(200).json(openApiSchema);
    }

    // 3. POST Request - Execution
    if (req.method === 'POST') {
      const rpcMethod = payload.method as string | undefined;
      const id = payload.id ?? 1;

      // Handle MCP Handshake & Protocol Lifecycle Methods before database auth
      if (rpcMethod === 'initialize') {
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              resources: {},
              prompts: {},
              logging: {},
            },
            serverInfo: { name: 'ninjahmajod-mcp-server', version: '1.0.0' },
          },
        });
      }

      if (rpcMethod === 'notifications/initialized' || rpcMethod === 'initialized' || (rpcMethod && rpcMethod.startsWith('notifications/'))) {
        return res.status(200).json({});
      }

      if (rpcMethod === 'ping') {
        return res.status(200).json({ jsonrpc: '2.0', id, result: {} });
      }

      if (rpcMethod === 'tools/list') {
        return res.status(200).json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });
      }

      if (rpcMethod === 'resources/list') {
        return res.status(200).json({ jsonrpc: '2.0', id, result: { resources: [] } });
      }

      if (rpcMethod === 'prompts/list') {
        return res.status(200).json({ jsonrpc: '2.0', id, result: { prompts: [] } });
      }

      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      if (!supabaseUrl || (!supabaseAnonKey && !serviceRoleKey)) {
        return res.status(500).json({
          error: 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set in Vercel.',
        });
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
        auth: { persistSession: false },
      });

      let userId: string | null = null;

      if (userKey) {
        // Try user_api_keys table
        const { data: keyRecord } = await supabase
          .from('user_api_keys')
          .select('user_id')
          .eq('key', userKey)
          .maybeSingle();

        if (keyRecord?.user_id) {
          userId = keyRecord.user_id;
        } else {
          // Try JWT token
          const { data: userData } = await supabase.auth.getUser(userKey);
          if (userData?.user?.id) {
            userId = userData.user.id;
          }
        }
      }

      if (!userId && process.env.SUPABASE_USER_EMAIL && process.env.SUPABASE_USER_PASSWORD) {
        const { data: loginData } = await supabase.auth.signInWithPassword({
          email: process.env.SUPABASE_USER_EMAIL,
          password: process.env.SUPABASE_USER_PASSWORD,
        });
        if (loginData?.user?.id) userId = loginData.user.id;
      }

      if (!userId) {
        return res.status(401).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: 'Unauthorized: Invalid or missing API Key. Go to NinJahMajod Settings to generate your Voice MCP Key.',
          },
          message: 'Unauthorized: Invalid or missing API Key. Go to NinJahMajod Settings to generate your Voice MCP Key.',
        });
      }

      // Determine Tool Name from URL path, RPC method, or payload
      const urlPath = req.url || '';
      let toolName = (payload.tool as string) || (payload.params as { name?: string })?.name || (payload.operationId as string);

      if (!toolName) {
        if (urlPath.includes('summary') || typeof payload.month === 'number') {
          toolName = 'get_financial_summary';
        } else if (urlPath.includes('recent') || typeof payload.limit === 'number') {
          toolName = 'list_recent_transactions';
        } else if (urlPath.includes('categories')) {
          toolName = 'list_categories';
        } else if (urlPath.includes('delete') || payload.transaction_id) {
          toolName = 'delete_transaction';
        } else {
          toolName = 'record_transaction';
        }
      }

      const toolArgs: Record<string, unknown> =
        (payload.args as Record<string, unknown>) ||
        (payload.params as { arguments?: Record<string, unknown> })?.arguments ||
        payload;

      // 1. Record Transaction Tool
      if (toolName === 'record_transaction') {
        const amount = Number(toolArgs.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({ error: 'amount must be a positive number' });
        }
        const note = String(toolArgs.note || '').trim();
        const type = (toolArgs.type as string) || 'expense';
        const date = (toolArgs.date as string) || new Date().toISOString().slice(0, 10);
        const categoryHint = toolArgs.category_name as string | undefined;

        const { data: rawCategories } = await supabase.from('categories').select('*').eq('user_id', userId);
        const categories = (rawCategories || []).map((c: { id: string; name: string; type: string; is_active?: boolean }) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          isActive: c.is_active !== false,
        }));

        const matched = matchCategory(categories, note, categoryHint, type);
        const transactionId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const { error: insertError } = await supabase.from('transactions').insert({
          id: transactionId,
          user_id: userId,
          type,
          category_id: matched.id,
          amount,
          date,
          note,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          return res.status(500).json({ error: `Supabase insert failed: ${insertError.message}` });
        }

        const typeEmoji = type === 'income' ? '💰' : type === 'savings' ? '🏦' : '💸';
        const msg = `${typeEmoji} บันทึกเรียบร้อย: ${note} ${amount.toLocaleString('th-TH')} บาท [หมวดหมู่: ${matched.name}] (วันที่: ${date})`;
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: msg }] },
          success: true,
          text: msg,
          message: msg,
        });
      }

      // 2. Financial Summary Tool
      if (toolName === 'get_financial_summary') {
        const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId);
        let income = 0;
        let expense = 0;
        let savings = 0;
        for (const t of txs || []) {
          if (t.type === 'income') income += Number(t.amount);
          else if (t.type === 'expense') expense += Number(t.amount);
          else if (t.type === 'savings') savings += Number(t.amount);
        }
        const text = `📊 สรุปการเงิน: รายรับรวม ${income.toLocaleString()} บาท, รายจ่ายรวม ${expense.toLocaleString()} บาท, เงินออม ${savings.toLocaleString()} บาท, คงเหลือ ${(income - expense).toLocaleString()} บาท`;
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
          success: true,
          text,
          income,
          expense,
          balance: income - expense,
          savings,
        });
      }

      // 3. List Recent Transactions Tool
      if (toolName === 'list_recent_transactions') {
        const limit = Math.min(50, Math.max(1, Number(toolArgs.limit) || 10));
        const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(limit);
        const lines = [`📋 รายการล่าสุด ${txs?.length || 0} รายการ:`];
        for (const t of txs || []) {
          lines.push(`• [${t.date}] ${t.note}: ${t.amount.toLocaleString('th-TH')} บาท`);
        }
        const text = lines.join('\n');
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
          success: true,
          text,
          transactions: txs,
        });
      }

      // 4. List Categories Tool
      if (toolName === 'list_categories') {
        const { data: categories } = await supabase.from('categories').select('*').eq('user_id', userId).order('name');
        const lines = [`📁 หมวดหมู่ (${categories?.length || 0} หมวด):`];
        for (const c of categories || []) {
          lines.push(`• ${c.name} (${c.type})`);
        }
        const text = lines.join('\n');
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
          success: true,
          text,
          categories,
        });
      }

      // 5. Delete Transaction Tool
      if (toolName === 'delete_transaction') {
        const transactionId = String(toolArgs.transaction_id || payload.transaction_id || '').trim();
        if (!transactionId) {
          return res.status(400).json({ error: 'transaction_id is required' });
        }

        const { error: delError } = await supabase.from('transactions').delete().eq('user_id', userId).eq('id', transactionId);
        if (delError) {
          return res.status(500).json({ error: `Supabase delete failed: ${delError.message}` });
        }

        const text = `🗑️ ลบรายการ ID ${transactionId} เรียบร้อยแล้ว`;
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
          success: true,
          text,
        });
      }

      return res.status(404).json({ error: `Tool ${toolName} not found` });
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('MCP Server Error:', errorMsg);
    return res.status(500).json({ error: errorMsg });
  }
}
