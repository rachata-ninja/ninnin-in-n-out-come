import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultAppData } from '../data/defaultData';
import { sortTransactions } from '../domain/finance';
import type { AppData, Category, Transaction } from '../types';

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  type: Category['type'];
  color: string;
  monthly_budget: number | null;
  is_active: boolean;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  type: Transaction['type'];
  category_id: string;
  amount: number;
  date: string;
  note: string;
  created_at: string;
  updated_at: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export function categoryToRow(category: Category, userId: string): CategoryRow {
  return {
    id: category.id,
    user_id: userId,
    name: category.name,
    type: category.type,
    color: category.color,
    monthly_budget: category.monthlyBudget ?? null,
    is_active: category.isActive,
  };
}

export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    monthlyBudget: row.monthly_budget ?? undefined,
    isActive: row.is_active,
  };
}

export function transactionToRow(transaction: Transaction, userId: string): TransactionRow {
  return {
    id: transaction.id,
    user_id: userId,
    type: transaction.type,
    category_id: transaction.categoryId,
    amount: transaction.amount,
    date: transaction.date,
    note: transaction.note,
    created_at: transaction.createdAt,
    updated_at: transaction.updatedAt,
  };
}

export function transactionFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    categoryId: row.category_id,
    amount: row.amount,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeRemoteAppData(data: Pick<AppData, 'categories' | 'transactions'>): AppData {
  return {
    categories: data.categories,
    transactions: sortTransactions(data.transactions),
    settings: defaultAppData.settings,
  };
}

export async function loadRemoteAppData(
  client: SupabaseClient,
  userId: string,
): Promise<AppData> {
  const categories = await selectRows<CategoryRow>(
    client.from('categories').select('*').eq('user_id', userId).order('name'),
  );

  if (categories.length === 0) {
    await saveRemoteAppData(client, userId, {
      ...defaultAppData,
      transactions: [],
    });
    return { ...defaultAppData, transactions: [] };
  }

  const transactions = await selectRows<TransactionRow>(
    client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  );

  return normalizeRemoteAppData({
    categories: categories.map(categoryFromRow),
    transactions: transactions.map(transactionFromRow),
  });
}

export async function saveRemoteAppData(
  client: SupabaseClient,
  userId: string,
  data: AppData,
): Promise<void> {
  await deleteRows(client.from('transactions').delete().eq('user_id', userId));
  await deleteRows(client.from('categories').delete().eq('user_id', userId));
  await upsertRemoteCategories(client, userId, data.categories);
  await upsertRemoteTransactions(client, userId, data.transactions);
}

export async function upsertRemoteCategory(
  client: SupabaseClient,
  userId: string,
  category: Category,
): Promise<void> {
  await upsertRows(client.from('categories').upsert(categoryToRow(category, userId), {
    onConflict: 'user_id,id',
  }));
}

export async function upsertRemoteTransaction(
  client: SupabaseClient,
  userId: string,
  transaction: Transaction,
): Promise<void> {
  await upsertRows(client.from('transactions').upsert(transactionToRow(transaction, userId), {
    onConflict: 'user_id,id',
  }));
}

export async function deleteRemoteTransaction(
  client: SupabaseClient,
  userId: string,
  transactionId: string,
): Promise<void> {
  await deleteRows(
    client.from('transactions').delete().eq('user_id', userId).eq('id', transactionId),
  );
}

async function upsertRemoteCategories(
  client: SupabaseClient,
  userId: string,
  categories: Category[],
): Promise<void> {
  if (categories.length === 0) return;
  await upsertRows(client.from('categories').upsert(
    categories.map((category) => categoryToRow(category, userId)),
    { onConflict: 'user_id,id' },
  ));
}

async function upsertRemoteTransactions(
  client: SupabaseClient,
  userId: string,
  transactions: Transaction[],
): Promise<void> {
  if (transactions.length === 0) return;
  await upsertRows(client.from('transactions').upsert(
    transactions.map((transaction) => transactionToRow(transaction, userId)),
    { onConflict: 'user_id,id' },
  ));
}

async function selectRows<T>(query: PromiseLike<SupabaseResult<T[]>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function upsertRows(query: PromiseLike<SupabaseResult<unknown>>): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function deleteRows(query: PromiseLike<SupabaseResult<unknown>>): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(error.message);
}
