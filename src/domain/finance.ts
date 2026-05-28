import type { Category, PeriodFilter, Transaction, TransactionInput, TransactionType } from '../types';

export type Totals = {
  income: number;
  expense: number;
  savings: number;
  balance: number;
};

export type CategoryTotal = {
  category: Category;
  amount: number;
  transactionCount: number;
};

export type BudgetUsage = CategoryTotal & {
  budget: number;
  remaining: number;
  percentUsed: number;
};

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    if (dateOrder !== 0) return dateOrder;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  filter: PeriodFilter,
): Transaction[] {
  return transactions.filter((transaction) => {
    const date = new Date(`${transaction.date}T00:00:00`);
    const yearMatches = date.getFullYear() === filter.year;
    if (filter.type === 'year') return yearMatches;
    const monthMatches = date.getMonth() + 1 === filter.month;
    if (filter.type === 'month') return yearMatches && monthMatches;
    return yearMatches && monthMatches && date.getDate() === filter.day;
  });
}

export function calculateTotals(transactions: Transaction[]): Totals {
  return transactions.reduce<Totals>(
    (totals, transaction) => {
      if (transaction.type === 'income') {
        totals.income += transaction.amount;
      } else if (transaction.type === 'expense') {
        totals.expense += transaction.amount;
      } else {
        totals.savings += transaction.amount;
      }

      totals.balance = totals.income - totals.expense - totals.savings;
      return totals;
    },
    { income: 0, expense: 0, savings: 0, balance: 0 },
  );
}

export function groupTransactionsByCategory(
  transactions: Transaction[],
  categories: Category[],
  type?: TransactionType,
): CategoryTotal[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totalsByCategory = new Map<string, { amount: number; transactionCount: number }>();

  transactions
    .filter((transaction) => (type ? transaction.type === type : true))
    .forEach((transaction) => {
      const current = totalsByCategory.get(transaction.categoryId) ?? {
        amount: 0,
        transactionCount: 0,
      };
      totalsByCategory.set(transaction.categoryId, {
        amount: current.amount + transaction.amount,
        transactionCount: current.transactionCount + 1,
      });
    });

  return Array.from(totalsByCategory.entries())
    .map(([categoryId, total]) => ({
      category: categoryById.get(categoryId) ?? {
        id: categoryId,
        name: 'ไม่พบหมวดหมู่',
        type: 'both',
        color: '#64748b',
        isActive: false,
      },
      ...total,
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function calculateBudgetUsage(
  transactions: Transaction[],
  categories: Category[],
): BudgetUsage[] {
  const expenseTotals = groupTransactionsByCategory(transactions, categories, 'expense');

  return categories
    .filter((category) => category.isActive)
    .filter((category) => (category.type === 'expense' || category.type === 'both') && typeof category.monthlyBudget === 'number')
    .map((category) => {
      const usage = expenseTotals.find((total) => total.category.id === category.id);
      const amount = usage?.amount ?? 0;
      const budget = category.monthlyBudget ?? 0;
      const percentUsed = budget > 0 ? Math.round((amount / budget) * 100) : 0;

      return {
        category,
        amount,
        transactionCount: usage?.transactionCount ?? 0,
        budget,
        remaining: budget - amount,
        percentUsed,
      };
    })
    .sort((left, right) => right.percentUsed - left.percentUsed);
}

export function getSelectableCategories(
  categories: Category[],
  type: TransactionType,
): Category[] {
  return categories
    .filter((category) => category.isActive)
    .filter((category) => category.type === type || category.type === 'both')
    .sort((left, right) => left.name.localeCompare(right.name, 'th'));
}

export function validateTransactionInput(input: TransactionInput): string[] {
  const errors: string[] = [];

  if (!input.categoryId) errors.push('กรุณาเลือกหมวดหมู่');
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    errors.push('จำนวนเงินต้องมากกว่า 0');
  }
  if (!input.date) errors.push('กรุณาเลือกวันที่');

  return errors;
}
