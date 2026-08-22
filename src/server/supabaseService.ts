import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { defaultCategories } from '../data/defaultData';
import {
  categoryFromRow,
  categoryToRow,
  transactionFromRow,
  transactionToRow,
  type CategoryRow,
  type TransactionRow,
} from '../storage/supabaseStorage';
import type { Category, Transaction } from '../types';

export interface SupabaseContext {
  client: SupabaseClient;
  userId: string;
}

export interface UserAuthCredentials {
  key?: string;
  token?: string;
  email?: string;
  password?: string;
  userId?: string;
}

export async function getSupabaseContext(
  auth?: UserAuthCredentials | string,
): Promise<SupabaseContext> {
  const credentials: UserAuthCredentials =
    typeof auth === 'string' ? { token: auth } : auth || {};

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL environment variable');
  }

  // 1. Dedicated User Secret API Key (ninja_key_...) or Bearer Token
  let rawToken = credentials.key || credentials.token;
  if (rawToken && rawToken.startsWith('Bearer ')) {
    rawToken = rawToken.slice(7).trim();
  }

  if (rawToken) {
    // 1a. Check if it matches a user API key in user_api_keys table
    const baseClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data: keyRecord } = await baseClient
      .from('user_api_keys')
      .select('user_id')
      .eq('key', rawToken)
      .maybeSingle();

    if (keyRecord?.user_id) {
      return { client: baseClient, userId: keyRecord.user_id };
    }

    // 1b. Check if it is a standard Supabase JWT Access Token
    const jwtClient = createClient(supabaseUrl, supabaseAnonKey || serviceRoleKey || '', {
      global: { headers: { Authorization: `Bearer ${rawToken}` } },
      auth: { persistSession: false },
    });
    const { data: { user }, error } = await jwtClient.auth.getUser(rawToken);
    if (!error && user) {
      return { client: jwtClient, userId: user.id };
    }

    throw new Error('Invalid API Key or Session Token. Please generate a new key from NinJahMajod Settings.');
  }

  // 2. Direct Service Role Key with User ID
  const directUserId = credentials.userId || process.env.SUPABASE_USER_ID;
  if (serviceRoleKey && directUserId) {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    return { client, userId: directUserId };
  }

  // 3. Fallback: Server-configured Email + Password in environment variables (for private single-user servers)
  const serverEmail = credentials.email || process.env.SUPABASE_USER_EMAIL;
  const serverPassword = credentials.password || process.env.SUPABASE_USER_PASSWORD;

  if (serverEmail && serverPassword) {
    const client = createClient(supabaseUrl, supabaseAnonKey || serviceRoleKey || '', {
      auth: { persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: serverEmail,
      password: serverPassword,
    });
    if (!error && data.user) {
      return { client, userId: data.user.id };
    }
  }

  throw new Error(
    'Unauthorized: No valid API Key provided. Please pass your personal API key (?key=ninja_key_...) or Bearer token.',
  );
}

export async function fetchCategories(
  client: SupabaseClient,
  userId: string,
): Promise<Category[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
  if (!data || data.length === 0) {
    const defaultRows = defaultCategories.map((c) => categoryToRow(c, userId));
    await client.from('categories').upsert(defaultRows, { onConflict: 'user_id,id' });
    return defaultCategories;
  }

  return (data as CategoryRow[]).map(categoryFromRow);
}

export async function fetchTransactions(
  client: SupabaseClient,
  userId: string,
  options?: { limit?: number; categoryId?: string; type?: string; date?: string },
): Promise<Transaction[]> {
  let query = client
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.limit) query = query.limit(options.limit);
  if (options?.categoryId) query = query.eq('category_id', options.categoryId);
  if (options?.type) query = query.eq('type', options.type);
  if (options?.date) query = query.eq('date', options.date);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
  return (data as TransactionRow[] || []).map(transactionFromRow);
}

export async function insertTransaction(
  client: SupabaseClient,
  userId: string,
  transaction: Transaction,
): Promise<Transaction> {
  const row = transactionToRow(transaction, userId);
  const { error } = await client.from('transactions').insert(row);
  if (error) throw new Error(`Failed to record transaction: ${error.message}`);
  return transaction;
}

export async function deleteTransaction(
  client: SupabaseClient,
  userId: string,
  transactionId: string,
): Promise<void> {
  const { error } = await client
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('id', transactionId);

  if (error) throw new Error(`Failed to delete transaction: ${error.message}`);
}
