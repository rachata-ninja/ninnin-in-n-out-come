import {
  calculateBudgetUsage,
  calculateTotals,
  filterTransactionsByPeriod,
  todayISO,
} from '../domain/finance';
import type { Transaction, TransactionType } from '../types';
import { matchCategory } from './categoryMatcher';
import {
  deleteTransaction,
  fetchCategories,
  fetchTransactions,
  insertTransaction,
  type SupabaseContext,
} from './supabaseService';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'record_transaction',
    description:
      'Record an expense, income, or savings transaction into NinJahMajod. Supports Thai/English notes with automatic smart category matching.',
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
            'Description of what was spent/earned (e.g. "food", "ข้าวมันไก่", "iced latte", "grab to work", "เงินเดือน").',
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
          description: 'Date in YYYY-MM-DD format. Defaults to today.',
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

export async function executeMcpTool(
  context: SupabaseContext,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError?: boolean }> {
  const { client, userId } = context;

  try {
    switch (name) {
      case 'record_transaction': {
        const amount = Number(args.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return { text: 'Error: amount must be a positive number.', isError: true };
        }

        const note = String(args.note || '').trim();
        if (!note) {
          return { text: 'Error: note is required.', isError: true };
        }

        const type = (args.type as TransactionType) || 'expense';
        const categoryNameHint = args.category_name ? String(args.category_name) : undefined;
        const date = (args.date as string) || todayISO();

        const categories = await fetchCategories(client, userId);
        const matchedCategory = matchCategory(categories, {
          note,
          categoryName: categoryNameHint,
          type,
        });

        const categoryId = matchedCategory?.id || (categories[0]?.id ?? 'other');
        const categoryDisplayName = matchedCategory?.name || categoryId;

        const newTransaction: Transaction = {
          id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          categoryId,
          amount,
          date,
          note,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await insertTransaction(client, userId, newTransaction);

        const typeEmoji = type === 'income' ? '💰' : type === 'savings' ? '🏦' : '💸';
        return {
          text: `${typeEmoji} บันทึกเรียบร้อย: ${note} ${amount.toLocaleString('th-TH')} บาท [หมวดหมู่: ${categoryDisplayName}] (วันที่: ${date}, ID: ${newTransaction.id})`,
        };
      }

      case 'get_financial_summary': {
        const now = new Date();
        const month = typeof args.month === 'number' ? args.month : now.getMonth() + 1;
        const year = typeof args.year === 'number' ? args.year : now.getFullYear();

        const [categories, allTransactions] = await Promise.all([
          fetchCategories(client, userId),
          fetchTransactions(client, userId),
        ]);

        const monthlyTransactions = filterTransactionsByPeriod(allTransactions, {
          type: 'month',
          year,
          month,
          paydayDay: 1,
        });

        const totals = calculateTotals(monthlyTransactions);
        const budgetUsage = calculateBudgetUsage(monthlyTransactions, categories);

        const lines: string[] = [
          `📊 สรุปการเงินประจำเดือน ${month}/${year}:`,
          `• รายรับรวม: ${totals.income.toLocaleString('th-TH')} บาท`,
          `• รายจ่ายรวม: ${totals.expense.toLocaleString('th-TH')} บาท`,
          `• เงินออม: ${totals.savings.toLocaleString('th-TH')} บาท`,
          `• คงเหลือสุทธิ: ${totals.balance.toLocaleString('th-TH')} บาท`,
          '',
          '📌 การใช้จ่ายตามงบประมาณ (Budget):',
        ];

        if (budgetUsage.length === 0) {
          lines.push('  (ไม่มีรายการใช้จ่ายในเดือนนี้)');
        } else {
          for (const item of budgetUsage) {
            const budgetText = item.budget > 0 ? ` (งบ ${item.budget.toLocaleString()} บาท - ใช้ไป ${item.percentUsed}%)` : '';
            lines.push(`• ${item.category.name}: ${item.amount.toLocaleString('th-TH')} บาท${budgetText}`);
          }
        }

        return { text: lines.join('\n') };
      }

      case 'list_recent_transactions': {
        const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
        const typeFilter = args.type ? String(args.type) : undefined;
        const dateFilter = args.date ? String(args.date) : undefined;

        const [categories, transactions] = await Promise.all([
          fetchCategories(client, userId),
          fetchTransactions(client, userId, {
            limit,
            type: typeFilter,
            date: dateFilter,
          }),
        ]);

        const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

        if (transactions.length === 0) {
          return { text: 'ไม่พบรายการใช้จ่ายตามเงื่อนไขที่ระบุ' };
        }

        const lines = [`📋 รายการล่าสุด ${transactions.length} รายการ:`];
        for (const t of transactions) {
          const categoryName = categoryMap.get(t.categoryId) || t.categoryId;
          const sign = t.type === 'income' ? '+' : '-';
          lines.push(`• [${t.date}] ${t.note}: ${sign}${t.amount.toLocaleString('th-TH')} บาท (${categoryName}) [ID: ${t.id}]`);
        }

        return { text: lines.join('\n') };
      }

      case 'list_categories': {
        const categories = await fetchCategories(client, userId);
        const active = categories.filter((c) => c.isActive);

        const lines = [`📁 หมวดหมู่ทั้งหมด (${active.length} หมวด):`];
        for (const c of active) {
          const budgetText = c.monthlyBudget ? ` [งบต่อเดือน: ${c.monthlyBudget.toLocaleString()} บาท]` : '';
          lines.push(`• ${c.name} (${c.type})${budgetText} [ID: ${c.id}]`);
        }

        return { text: lines.join('\n') };
      }

      case 'delete_transaction': {
        const transactionId = String(args.transaction_id || '').trim();
        if (!transactionId) {
          return { text: 'Error: transaction_id is required.', isError: true };
        }

        await deleteTransaction(client, userId, transactionId);
        return { text: `🗑️ ลบรายการ ID ${transactionId} เรียบร้อยแล้ว` };
      }

      default:
        return { text: `Error: Unknown tool "${name}"`, isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { text: `Error executing ${name}: ${message}`, isError: true };
  }
}
