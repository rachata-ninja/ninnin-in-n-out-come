import { describe, expect, it } from 'vitest';
import { defaultAppData } from '../data/defaultData';
import type { Category, Transaction } from '../types';
import {
  categoryFromRow,
  categoryToRow,
  normalizeRemoteAppData,
  transactionFromRow,
  transactionToRow,
} from './supabaseStorage';

describe('supabase storage mapping', () => {
  it('maps categories between app data and Supabase rows', () => {
    const category: Category = {
      id: 'coffee',
      name: 'กาแฟ',
      type: 'expense',
      color: '#78350f',
      monthlyBudget: 1200,
      isActive: true,
    };

    const row = categoryToRow(category, 'user-1');

    expect(row).toEqual({
      id: 'coffee',
      user_id: 'user-1',
      name: 'กาแฟ',
      type: 'expense',
      color: '#78350f',
      monthly_budget: 1200,
      is_active: true,
    });
    expect(categoryFromRow(row)).toEqual(category);
  });

  it('maps transactions between app data and Supabase rows', () => {
    const transaction: Transaction = {
      id: 'tx-1',
      type: 'expense',
      categoryId: 'coffee',
      amount: 85,
      date: '2026-05-10',
      note: 'ลาเต้',
      createdAt: '2026-05-10T02:00:00.000Z',
      updatedAt: '2026-05-10T02:00:00.000Z',
    };

    const row = transactionToRow(transaction, 'user-1');

    expect(row).toEqual({
      id: 'tx-1',
      user_id: 'user-1',
      type: 'expense',
      category_id: 'coffee',
      amount: 85,
      date: '2026-05-10',
      note: 'ลาเต้',
      created_at: '2026-05-10T02:00:00.000Z',
      updated_at: '2026-05-10T02:00:00.000Z',
    });
    expect(transactionFromRow(row)).toEqual(transaction);
  });

  it('maps savings transactions between app data and Supabase rows', () => {
    const transaction: Transaction = {
      id: 'tx-saving',
      type: 'savings',
      categoryId: 'savings',
      amount: 2500,
      date: '2026-05-10',
      note: 'เงินสำรอง',
      createdAt: '2026-05-10T02:00:00.000Z',
      updatedAt: '2026-05-10T02:00:00.000Z',
    };

    const row = transactionToRow(transaction, 'user-1');

    expect(row.type).toBe('savings');
    expect(transactionFromRow(row)).toEqual(transaction);
  });

  it('normalizes remote data with default settings', () => {
    const data = normalizeRemoteAppData({
      categories: defaultAppData.categories,
      transactions: defaultAppData.transactions,
    });

    expect(data.settings).toEqual(defaultAppData.settings);
    expect(data.categories).toHaveLength(defaultAppData.categories.length);
    expect(data.transactions).toHaveLength(defaultAppData.transactions.length);
  });
});
