import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../types';
import {
  calculateBudgetUsage,
  calculateSafeToSpend,
  calculateSpendPace,
  splitVariableSpend,
  calculateTotals,
  filterTransactionsForList,
  filterTransactionsByPeriod,
  getMonthlyFilterForDate,
  getMonthlyPeriodRange,
  getSelectableCategories,
  groupTransactionsByCategory,
  parseAmountExpression,
  sanitizeAmountExpression,
  sortTransactions,
  upsertTransactionById,
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

  it('builds a selected month from the previous payday through the day before that month payday', () => {
    expect(getMonthlyPeriodRange(2026, 5, 25)).toEqual({
      start: '2026-04-25',
      end: '2026-05-24',
    });
  });

  it('selects the next salary month once today reaches payday', () => {
    expect(getMonthlyFilterForDate(new Date(2026, 4, 28), 25)).toMatchObject({
      type: 'month',
      year: 2026,
      month: 6,
    });
  });

  it('selects the next salary month without overflowing on a month-end payday', () => {
    expect(getMonthlyFilterForDate(new Date(2026, 0, 31), 31)).toMatchObject({
      type: 'month',
      year: 2026,
      month: 2,
    });
  });

  it('filters monthly transactions by payday cycle when a payday day is set', () => {
    const result = filterTransactionsByPeriod(
      [
        ...transactions,
        {
          id: 'before-cycle',
          type: 'expense',
          categoryId: 'food',
          amount: 90,
          date: '2026-04-24',
          note: '',
          createdAt: '2026-04-24T05:00:00.000Z',
          updatedAt: '2026-04-24T05:00:00.000Z',
        },
        {
          id: 'cycle-start',
          type: 'income',
          categoryId: 'salary',
          amount: 30000,
          date: '2026-04-25',
          note: '',
          createdAt: '2026-04-25T05:00:00.000Z',
          updatedAt: '2026-04-25T05:00:00.000Z',
        },
        {
          id: 'before-payday',
          type: 'expense',
          categoryId: 'food',
          amount: 100,
          date: '2026-05-24',
          note: '',
          createdAt: '2026-05-24T05:00:00.000Z',
          updatedAt: '2026-05-24T05:00:00.000Z',
        },
        {
          id: 'next-cycle-start',
          type: 'income',
          categoryId: 'salary',
          amount: 30000,
          date: '2026-05-25',
          note: '',
          createdAt: '2026-05-25T05:00:00.000Z',
          updatedAt: '2026-05-25T05:00:00.000Z',
        },
        {
          id: 'cycle-end',
          type: 'expense',
          categoryId: 'food',
          amount: 200,
          date: '2026-06-24',
          note: '',
          createdAt: '2026-06-24T05:00:00.000Z',
          updatedAt: '2026-06-24T05:00:00.000Z',
        },
        {
          id: 'next-cycle',
          type: 'expense',
          categoryId: 'food',
          amount: 300,
          date: '2026-06-25',
          note: '',
          createdAt: '2026-06-25T05:00:00.000Z',
          updatedAt: '2026-06-25T05:00:00.000Z',
        },
      ],
      {
        type: 'month',
        year: 2026,
        month: 5,
        paydayDay: 25,
      },
    );

    expect(result.map((transaction) => transaction.id)).toEqual([
      't1',
      't2',
      't3',
      't5',
      'cycle-start',
      'before-payday',
    ]);
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

  it('filters transaction lists by date, month, year, and category', () => {
    const result = filterTransactionsForList(transactions, {
      date: '2026-05-02',
      month: 5,
      year: 2026,
      categoryId: 'food',
    });

    expect(result.map((transaction) => transaction.id)).toEqual(['t2']);
  });

  it('leaves transaction lists unchanged when no list filters are selected', () => {
    expect(filterTransactionsForList(transactions, {})).toEqual(transactions);
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

  it('keeps the planned budget at zero for active expense categories without a monthly budget', () => {
    const unbudgetedCategory: Category = {
      id: 'coffee',
      name: 'กาแฟ',
      type: 'expense',
      color: '#92400e',
      isActive: true,
    };
    const result = calculateBudgetUsage(
      [
        ...transactions,
        {
          id: 'coffee-1',
          type: 'expense',
          categoryId: 'coffee',
          amount: 300,
          date: '2026-05-05',
          note: '',
          createdAt: '2026-05-05T05:00:00.000Z',
          updatedAt: '2026-05-05T05:00:00.000Z',
        },
      ],
      [...categories, unbudgetedCategory],
    );

    expect(result.find((item) => item.category.id === 'coffee')).toMatchObject({
      amount: 300,
      budget: 0,
      remaining: -300,
      percentUsed: 0,
    });
  });

  it('sorts budget usage by actual expense amount instead of percent used', () => {
    const result = calculateBudgetUsage(
      [
        {
          id: 'large-planned',
          type: 'expense',
          categoryId: 'rent',
          amount: 7500,
          date: '2026-05-05',
          note: '',
          createdAt: '2026-05-05T05:00:00.000Z',
          updatedAt: '2026-05-05T05:00:00.000Z',
        },
        {
          id: 'small-over-budget',
          type: 'expense',
          categoryId: 'food',
          amount: 7000,
          date: '2026-05-05',
          note: '',
          createdAt: '2026-05-05T05:01:00.000Z',
          updatedAt: '2026-05-05T05:01:00.000Z',
        },
      ],
      categories,
    );

    expect(result.map((item) => item.category.id).slice(0, 2)).toEqual(['rent', 'food']);
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

  it('parses a plain amount expression', () => {
    expect(parseAmountExpression('85')).toBe(85);
  });

  it('calculates amount expressions with arithmetic operators', () => {
    expect(parseAmountExpression('20+50')).toBe(70);
    expect(parseAmountExpression('20.5 + 50')).toBe(70.5);
    expect(parseAmountExpression('100-20*2+10/5')).toBe(62);
    expect(parseAmountExpression('20x3')).toBe(60);
    expect(parseAmountExpression('20X3')).toBe(60);
  });

  it('rejects malformed amount expressions', () => {
    expect(parseAmountExpression('20+')).toBeNaN();
    expect(parseAmountExpression('20/0')).toBeNaN();
    expect(parseAmountExpression('abc')).toBeNaN();
  });

  it('keeps only amount characters while users type', () => {
    expect(sanitizeAmountExpression('abc20+ข้าว50x2/4-1*3.5')).toBe('20+50x2/4-1*3.5');
  });

  it('upserts a transaction by id instead of duplicating idempotent retries', () => {
    const retryTransaction: Transaction = {
      id: 'request-1',
      type: 'expense',
      categoryId: 'food',
      amount: 85,
      date: '2026-05-10',
      note: 'ลาเต้',
      createdAt: '2026-05-10T02:00:00.000Z',
      updatedAt: '2026-05-10T02:00:00.000Z',
    };

    const result = upsertTransactionById(
      [retryTransaction],
      {
        ...retryTransaction,
        amount: 90,
        updatedAt: '2026-05-10T02:00:05.000Z',
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'request-1',
      amount: 90,
    }));
  });

  it('calculates safe to spend based on remaining budget and cycle days', () => {
    const range = { start: '2026-08-25', end: '2026-09-24' };
    // 12 days remaining before end of cycle (from 2026-09-13 to 2026-09-24 = 12 days)
    const result = calculateSafeToSpend(10000, 4600, 20000, range, '2026-09-13');

    expect(result.daysRemaining).toBe(12);
    expect(result.remainingPool).toBe(5400); // 10000 - 4600
    expect(result.dailySafeToSpend).toBe(450); // 5400 / 12 = 450
    expect(result.percentUsed).toBe(46);
    expect(result.isOverBudget).toBe(false);
  });

  it('handles over-budget state gracefully with 0 daily safe to spend', () => {
    const range = { start: '2026-08-25', end: '2026-09-24' };
    const result = calculateSafeToSpend(5000, 6000, 10000, range, '2026-09-13');

    expect(result.dailySafeToSpend).toBe(0);
    expect(result.remainingPool).toBe(-1000);
    expect(result.isOverBudget).toBe(true);
  });
  it('reports spending under plan when actual trails the even burn-down', () => {
    const range = { start: '2026-09-01', end: '2026-09-30' };
    // Day 6 of 30 => expected 25500 * 6/30 = 5100. Spent 3000, so 2100 under.
    const result = calculateSpendPace(25500, 3000, range, '2026-09-06');

    expect(result.expectedSpend).toBe(5100);
    expect(result.delta).toBe(2100);
    expect(result.status).toBe('under');
  });

  it('reports spending over plan when actual outruns the even burn-down', () => {
    const range = { start: '2026-09-01', end: '2026-09-30' };
    const result = calculateSpendPace(25500, 9000, range, '2026-09-06');

    expect(result.delta).toBe(-3900);
    expect(result.status).toBe('over');
  });

  it('treats a small difference as on-track rather than a signal', () => {
    const range = { start: '2026-09-01', end: '2026-09-30' };
    // Expected 5100, tolerance is 2% of 25500 = 510.
    const result = calculateSpendPace(25500, 5000, range, '2026-09-06');

    expect(result.status).toBe('on-track');
  });

  it('clamps elapsed days to the period when today is past the end', () => {
    const range = { start: '2026-09-01', end: '2026-09-30' };
    const result = calculateSpendPace(25500, 25500, range, '2026-10-15');

    expect(result.expectedSpend).toBe(25500);
    expect(result.status).toBe('on-track');
  });

  it('returns a neutral pace when there is no planned pool', () => {
    const range = { start: '2026-09-01', end: '2026-09-30' };
    const result = calculateSpendPace(0, 4000, range, '2026-09-06');

    expect(result).toEqual({ expectedSpend: 0, delta: 0, status: 'on-track' });
  });

  it('excludes a fixed commitment from the variable pace pool', () => {
    const categories = [
      { id: 'rent', name: 'ค่าห้อง', type: 'expense' as const, color: '#000', monthlyBudget: 8000, isActive: true },
      { id: 'food', name: 'ค่าอาหาร', type: 'expense' as const, color: '#000', monthlyBudget: 6000, isActive: true },
    ];
    const transactions = [
      // One payment covering the whole rent budget — a fixed commitment.
      { id: 'r', type: 'expense' as const, categoryId: 'rent', amount: 8000, date: '2026-09-01', note: '', createdAt: '', updatedAt: '' },
      { id: 'f1', type: 'expense' as const, categoryId: 'food', amount: 120, date: '2026-09-02', note: '', createdAt: '', updatedAt: '' },
      { id: 'f2', type: 'expense' as const, categoryId: 'food', amount: 80, date: '2026-09-03', note: '', createdAt: '', updatedAt: '' },
    ];

    expect(splitVariableSpend(transactions, categories)).toEqual({
      variablePool: 6000,
      variableSpend: 200,
    });
  });

  it('keeps a category variable when its budget is spread over many payments', () => {
    const categories = [
      { id: 'food', name: 'ค่าอาหาร', type: 'expense' as const, color: '#000', monthlyBudget: 1000, isActive: true },
    ];
    const transactions = [
      { id: 'a', type: 'expense' as const, categoryId: 'food', amount: 300, date: '2026-09-01', note: '', createdAt: '', updatedAt: '' },
      { id: 'b', type: 'expense' as const, categoryId: 'food', amount: 300, date: '2026-09-02', note: '', createdAt: '', updatedAt: '' },
    ];

    expect(splitVariableSpend(transactions, categories)).toEqual({
      variablePool: 1000,
      variableSpend: 600,
    });
  });

  it('does not report a rent payment on payday as being over plan', () => {
    const categories = [
      { id: 'rent', name: 'ค่าห้อง', type: 'expense' as const, color: '#000', monthlyBudget: 8000, isActive: true },
      { id: 'food', name: 'ค่าอาหาร', type: 'expense' as const, color: '#000', monthlyBudget: 6000, isActive: true },
    ];
    const transactions = [
      { id: 'r', type: 'expense' as const, categoryId: 'rent', amount: 8000, date: '2026-09-01', note: '', createdAt: '', updatedAt: '' },
      { id: 'f', type: 'expense' as const, categoryId: 'food', amount: 900, date: '2026-09-02', note: '', createdAt: '', updatedAt: '' },
    ];
    const { variablePool, variableSpend } = splitVariableSpend(transactions, categories);

    // Day 5 of 30 => expected 6000 * 5/30 = 1000 against 900 spent.
    const pace = calculateSpendPace(variablePool, variableSpend, { start: '2026-09-01', end: '2026-09-30' }, '2026-09-05');

    expect(pace.status).toBe('on-track');
  });
});
