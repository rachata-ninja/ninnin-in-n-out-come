import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../types';
import {
  calculateBudgetUsage,
  calculateTotals,
  filterTransactionsByPeriod,
  getSelectableCategories,
  groupTransactionsByCategory,
  sortTransactions,
  validateTransactionInput,
} from './finance';

const categories: Category[] = [
  {
    id: 'salary',
    name: 'เงินเดือน',
    type: 'income',
    color: '#16a34a',
    isActive: true,
  },
  {
    id: 'food',
    name: 'ค่าอาหาร',
    type: 'expense',
    color: '#f97316',
    monthlyBudget: 6000,
    isActive: true,
  },
  {
    id: 'rent',
    name: 'ค่าห้อง',
    type: 'expense',
    color: '#2563eb',
    monthlyBudget: 8000,
    isActive: true,
  },
  {
    id: 'inactive-snack',
    name: 'ขนมเก่า',
    type: 'expense',
    color: '#64748b',
    monthlyBudget: 1000,
    isActive: false,
  },
  {
    id: 'emergency-saving',
    name: 'เงินสำรอง',
    type: 'savings',
    color: '#0f766e',
    isActive: true,
  },
];

const transactions: Transaction[] = [
  {
    id: 't1',
    type: 'income',
    categoryId: 'salary',
    amount: 30000,
    date: '2026-05-01',
    note: '',
    createdAt: '2026-05-01T01:00:00.000Z',
    updatedAt: '2026-05-01T01:00:00.000Z',
  },
  {
    id: 't2',
    type: 'expense',
    categoryId: 'food',
    amount: 120,
    date: '2026-05-02',
    note: 'ข้าวกลางวัน',
    createdAt: '2026-05-02T02:00:00.000Z',
    updatedAt: '2026-05-02T02:00:00.000Z',
  },
  {
    id: 't3',
    type: 'expense',
    categoryId: 'rent',
    amount: 7500,
    date: '2026-05-03',
    note: '',
    createdAt: '2026-05-03T03:00:00.000Z',
    updatedAt: '2026-05-03T03:00:00.000Z',
  },
  {
    id: 't4',
    type: 'expense',
    categoryId: 'food',
    amount: 80,
    date: '2026-06-02',
    note: '',
    createdAt: '2026-06-02T04:00:00.000Z',
    updatedAt: '2026-06-02T04:00:00.000Z',
  },
  {
    id: 't5',
    type: 'savings',
    categoryId: 'emergency-saving',
    amount: 2500,
    date: '2026-05-04',
    note: '',
    createdAt: '2026-05-04T05:00:00.000Z',
    updatedAt: '2026-05-04T05:00:00.000Z',
  },
];

describe('finance domain', () => {
  it('calculates income, expense, savings, and balance', () => {
    expect(calculateTotals(transactions)).toEqual({
      income: 30000,
      expense: 7700,
      savings: 2500,
      balance: 19800,
    });
  });

  it('filters transactions by month without leaking other months', () => {
    const result = filterTransactionsByPeriod(transactions, {
      type: 'month',
      year: 2026,
      month: 5,
    });

    expect(result.map((transaction) => transaction.id)).toEqual(['t1', 't2', 't3', 't5']);
  });

  it('filters transactions by day when a daily dashboard view is selected', () => {
    const result = filterTransactionsByPeriod(transactions, {
      type: 'day',
      year: 2026,
      month: 5,
      day: 2,
    });

    expect(result.map((transaction) => transaction.id)).toEqual(['t2']);
  });

  it('filters transactions by year', () => {
    const result = filterTransactionsByPeriod(transactions, {
      type: 'year',
      year: 2026,
      month: 1,
    });

    expect(result).toHaveLength(5);
  });

  it('groups expenses by category and keeps old inactive categories reportable', () => {
    const result = groupTransactionsByCategory(
      [
        ...transactions,
        {
          id: 't5',
          type: 'expense',
          categoryId: 'inactive-snack',
          amount: 50,
          date: '2026-05-04',
          note: '',
          createdAt: '2026-05-04T05:00:00.000Z',
          updatedAt: '2026-05-04T05:00:00.000Z',
        },
      ],
      categories,
      'expense',
    );

    expect(result.map((item) => [item.category.name, item.amount])).toEqual([
      ['ค่าห้อง', 7500],
      ['ค่าอาหาร', 200],
      ['ขนมเก่า', 50],
    ]);
  });

  it('sorts transactions by date desc and createdAt desc', () => {
    const result = sortTransactions([
      transactions[0],
      {
        ...transactions[1],
        id: 'newer',
        createdAt: '2026-05-02T09:00:00.000Z',
      },
      transactions[1],
    ]);

    expect(result.map((transaction) => transaction.id)).toEqual(['newer', 't2', 't1']);
  });

  it('excludes inactive categories from new transaction options', () => {
    const result = getSelectableCategories(categories, 'expense').map((category) => category.id);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(['food', 'rent']));
    expect(result).not.toContain('inactive-snack');
  });

  it('selects active savings categories for savings transactions', () => {
    const result = getSelectableCategories(categories, 'savings').map((category) => category.id);

    expect(result).toEqual(['emergency-saving']);
  });

  it('calculates budget usage by expense category', () => {
    const result = calculateBudgetUsage(transactions, categories);

    expect(result.find((item) => item.category.id === 'rent')).toMatchObject({
      amount: 7500,
      budget: 8000,
      remaining: 500,
      percentUsed: 94,
    });
  });

  it('excludes inactive categories from budget usage', () => {
    const result = calculateBudgetUsage(transactions, categories);

    expect(result.map((item) => item.category.id)).not.toContain('inactive-snack');
  });

  it('validates transaction input amount, category, and date', () => {
    expect(
      validateTransactionInput({
        type: 'expense',
        categoryId: '',
        amount: 0,
        date: '',
        note: '',
      }),
    ).toEqual(['กรุณาเลือกหมวดหมู่', 'จำนวนเงินต้องมากกว่า 0', 'กรุณาเลือกวันที่']);
  });
});
