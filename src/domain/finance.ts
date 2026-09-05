import type {
  Category,
  PeriodFilter,
  Transaction,
  TransactionInput,
  TransactionListFilter,
  TransactionType,
} from '../types';

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

export type DateRange = {
  start: string;
  end: string;
};

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.toSorted((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    if (dateOrder !== 0) return dateOrder;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function upsertTransactionById(
  transactions: Transaction[],
  transaction: Transaction,
): Transaction[] {
  const exists = transactions.some((current) => current.id === transaction.id);
  const nextTransactions = exists
    ? transactions.map((current) =>
        current.id === transaction.id ? transaction : current,
      )
    : [transaction, ...transactions];

  return sortTransactions(nextTransactions);
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  filter: PeriodFilter,
): Transaction[] {
  if (filter.type === 'month' && filter.paydayDay && filter.paydayDay > 1) {
    const range = getMonthlyPeriodRange(filter.year, filter.month, filter.paydayDay);
    return transactions.filter(
      (transaction) => transaction.date >= range.start && transaction.date <= range.end,
    );
  }

  return transactions.filter((transaction) => {
    const date = new Date(`${transaction.date}T00:00:00`);
    const yearMatches = date.getFullYear() === filter.year;
    if (filter.type === 'year') return yearMatches;
    const monthMatches = date.getMonth() + 1 === filter.month;
    if (filter.type === 'month') return yearMatches && monthMatches;
    return yearMatches && monthMatches && date.getDate() === filter.day;
  });
}

export function filterTransactionsForList(
  transactions: Transaction[],
  filter: TransactionListFilter,
): Transaction[] {
  return transactions.filter((transaction) => {
    if (filter.date && transaction.date !== filter.date) return false;
    if (filter.categoryId && transaction.categoryId !== filter.categoryId) return false;

    const [year, month] = transaction.date.split('-').map(Number);
    if (filter.year && year !== filter.year) return false;
    if (filter.month && month !== filter.month) return false;

    return true;
  });
}

export function getMonthlyPeriodRange(year: number, month: number, paydayDay = 1): DateRange {
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return {
      start: '',
      end: '',
    };
  }

  const normalizedPaydayDay = Math.min(31, Math.max(1, Math.trunc(paydayDay)));
  if (normalizedPaydayDay === 1) {
    const start = createDateForDay(year, month, 1);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const end = createDateForDay(nextMonthYear, nextMonth, 1);
    end.setDate(end.getDate() - 1);

    return {
      start: toLocalISODate(start),
      end: toLocalISODate(end),
    };
  }

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousMonthYear = month === 1 ? year - 1 : year;
  const start = createDateForDay(previousMonthYear, previousMonth, normalizedPaydayDay);
  const end = createDateForDay(year, month, normalizedPaydayDay);
  end.setDate(end.getDate() - 1);

  return {
    start: toLocalISODate(start),
    end: toLocalISODate(end),
  };
}

export type SafeToSpendInfo = {
  dailySafeToSpend: number;
  daysRemaining: number;
  remainingPool: number;
  totalPool: number;
  percentUsed: number;
  isOverBudget: boolean;
};

export type SpendPace = {
  /** What the user "should" have spent by today if spending were even across the period. */
  expectedSpend: number;
  /** expectedSpend - actual. Positive means under plan, negative means over plan. */
  delta: number;
  status: 'under' | 'on-track' | 'over';
};

/**
 * A category is treated as a fixed commitment when a single transaction covers
 * most of its budget — rent, internet, insurance. These are *meant* to be paid
 * at the top of the cycle, so measuring them against an even burn-down reports
 * a huge overspend on day one of every month.
 */
const FIXED_COMMITMENT_RATIO = 0.8;

export function isFixedCommitment(
  transactions: Transaction[],
  category: Category,
): boolean {
  const budget = category.monthlyBudget ?? 0;
  if (budget <= 0) return false;

  return transactions.some(
    (transaction) =>
      transaction.type === 'expense' &&
      transaction.categoryId === category.id &&
      transaction.amount >= budget * FIXED_COMMITMENT_RATIO,
  );
}

/**
 * Splits a period's budget and spend into the part that can reasonably be
 * spread evenly across the days, and the part that cannot.
 */
export function splitVariableSpend(
  transactions: Transaction[],
  categories: Category[],
): { variablePool: number; variableSpend: number } {
  let variablePool = 0;
  let variableSpend = 0;

  for (const category of categories) {
    const budget = category.monthlyBudget ?? 0;
    if (budget <= 0) continue;
    if (isFixedCommitment(transactions, category)) continue;

    variablePool += budget;
    variableSpend += transactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' && transaction.categoryId === category.id,
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  return { variablePool, variableSpend };
}

/**
 * Compares actual spend against an even burn-down of the period's budget.
 *
 * The dashboard already knew "43% used" but never whether 43% was good news on
 * day 6 of 30. This is the sentence that answers that.
 *
 * Callers should pass the *variable* pool and spend (see splitVariableSpend) so
 * that a rent payment on payday does not read as being wildly over budget.
 */
export function calculateSpendPace(
  totalPool: number,
  totalExpense: number,
  periodRange: DateRange,
  today = todayISO(),
): SpendPace {
  const startDate = periodRange.start ? new Date(`${periodRange.start}T00:00:00`) : null;
  const endDate = periodRange.end ? new Date(`${periodRange.end}T00:00:00`) : null;

  if (!startDate || !endDate || totalPool <= 0) {
    return { expectedSpend: 0, delta: 0, status: 'on-track' };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
  if (totalDays <= 0) {
    return { expectedSpend: 0, delta: 0, status: 'on-track' };
  }

  const todayDate = new Date(`${today}T00:00:00`);
  const rawElapsed = Math.round((todayDate.getTime() - startDate.getTime()) / msPerDay) + 1;
  const daysElapsed = Math.min(totalDays, Math.max(0, rawElapsed));

  const expectedSpend = Math.round((totalPool * daysElapsed) / totalDays);
  const delta = expectedSpend - totalExpense;

  // Under 2% of the pool either way is noise, not a signal worth a sentence.
  const tolerance = Math.max(1, Math.round(totalPool * 0.02));
  const status = delta > tolerance ? 'under' : delta < -tolerance ? 'over' : 'on-track';

  return { expectedSpend, delta, status };
}

export function calculateSafeToSpend(
  plannedBudget: number,
  totalExpense: number,
  totalBalance: number,
  periodRange: DateRange,
  today = todayISO(),
): SafeToSpendInfo {
  if (!periodRange.start || !periodRange.end) {
    return {
      dailySafeToSpend: 0,
      daysRemaining: 1,
      remainingPool: 0,
      totalPool: 0,
      percentUsed: 0,
      isOverBudget: false,
    };
  }

  const endDate = new Date(`${periodRange.end}T23:59:59`);
  const todayDate = new Date(`${today}T00:00:00`);
  const diffMs = endDate.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const daysRemaining = diffDays > 0 ? diffDays : 1;

  const hasPlannedBudget = plannedBudget > 0;
  const totalPool = hasPlannedBudget ? plannedBudget : Math.max(0, totalBalance + totalExpense);
  const remainingPool = hasPlannedBudget ? plannedBudget - totalExpense : totalBalance;
  const isOverBudget = remainingPool < 0;

  const safeRemaining = Math.max(0, remainingPool);
  const dailySafeToSpend = Math.round(safeRemaining / daysRemaining);
  const percentUsed =
    totalPool > 0 ? Math.min(100, Math.round((totalExpense / totalPool) * 100)) : 0;

  return {
    dailySafeToSpend,
    daysRemaining,
    remainingPool,
    totalPool,
    percentUsed,
    isOverBudget,
  };
}

export function getMonthlyFilterForDate(date: Date, paydayDay = 1): PeriodFilter {
  const normalizedPaydayDay = Math.min(31, Math.max(1, Math.trunc(paydayDay)));
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const shouldUseNextMonth = normalizedPaydayDay > 1 && date.getDate() >= normalizedPaydayDay;

  const selectedYear = shouldUseNextMonth ? nextMonthYear : currentYear;
  const selectedMonth = shouldUseNextMonth ? nextMonth : currentMonth;

  return {
    type: 'month',
    year: selectedYear,
    month: selectedMonth,
    day: date.getDate(),
  };
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

  for (const transaction of transactions) {
    if (type && transaction.type !== type) continue;

    const current = totalsByCategory.get(transaction.categoryId) ?? {
      amount: 0,
      transactionCount: 0,
    };
    totalsByCategory.set(transaction.categoryId, {
      amount: current.amount + transaction.amount,
      transactionCount: current.transactionCount + 1,
    });
  }

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
  const expenseTotalByCategoryId = new Map(
    expenseTotals.map((total) => [total.category.id, total]),
  );

  const usageByCategory: BudgetUsage[] = [];

  for (const category of categories) {
    const usage = expenseTotalByCategoryId.get(category.id);
    const isExpenseCategory = category.type === 'expense' || category.type === 'both';
    const shouldInclude = (
      category.isActive
      && isExpenseCategory
      && (typeof category.monthlyBudget === 'number' || Boolean(usage))
    );
    if (!shouldInclude) continue;

    const amount = usage?.amount ?? 0;
    const budget = category.monthlyBudget ?? 0;
    const percentUsed = budget > 0 ? Math.round((amount / budget) * 100) : 0;

    usageByCategory.push({
      category,
      amount,
      transactionCount: usage?.transactionCount ?? 0,
      budget,
      remaining: budget - amount,
      percentUsed,
    });
  }

  return usageByCategory.sort((left, right) => right.amount - left.amount);
}

export function getSelectableCategories(
  categories: Category[],
  type: TransactionType,
): Category[] {
  return categories
    .filter((category) => category.isActive && (category.type === type || category.type === 'both'))
    .sort((left, right) => left.name.localeCompare(right.name, 'th'));
}

export function parseAmountExpression(expression: string): number {
  const value = expression.trim();
  if (!value) return Number.NaN;

  const tokens = value.replace(/\s+/g, '').match(/\d+(?:\.\d*)?|\.\d+|[+\-*/xX]/g);
  if (!tokens || tokens.join('') !== value.replace(/\s+/g, '')) return Number.NaN;

  const values: number[] = [];
  const operators: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (index % 2 === 0) {
      const amount = Number(token);
      if (!Number.isFinite(amount)) return Number.NaN;
      values.push(amount);
    } else {
      if (!/[+\-*/xX]/.test(token)) return Number.NaN;
      operators.push(token);
    }
  }

  if (values.length !== operators.length + 1) return Number.NaN;

  const terms = [values[0]];
  const additiveOperators: string[] = [];

  for (let index = 0; index < operators.length; index += 1) {
    const operator = operators[index];
    const nextValue = values[index + 1];

    if (operator === '*' || operator === 'x' || operator === 'X') {
      terms[terms.length - 1] *= nextValue;
    } else if (operator === '/') {
      if (nextValue === 0) return Number.NaN;
      terms[terms.length - 1] /= nextValue;
    } else {
      additiveOperators.push(operator);
      terms.push(nextValue);
    }
  }

  return additiveOperators.reduce((total, operator, index) => {
    const nextValue = terms[index + 1];
    return operator === '+' ? total + nextValue : total - nextValue;
  }, terms[0]);
}

export function sanitizeAmountExpression(expression: string): string {
  return expression.replace(/[^0-9.+\-*/xX ]/g, '');
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

function createDateForDay(year: number, month: number, day: number): Date {
  const daysInMonth = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, daysInMonth));
}

function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
