import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  type CategoryTotal,
  type SpendPace,
  calculateBudgetUsage,
  calculateSafeToSpend,
  calculateSpendPace,
  calculateTotals,
  splitVariableSpend,
  filterTransactionsByPeriod,
  getMonthlyPeriodRange,
  groupTransactionsByCategory,
  todayISO,
} from '../domain/finance';
import { formatCurrency, getMonthName } from '../format';
import type { Category, PeriodFilter, Transaction } from '../types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const dateWithoutYearFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
});
const dayTitleFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Recharts writes colours straight into SVG attributes, so it cannot consume
 * our CSS variables. Resolve them once and re-resolve when the theme changes.
 */
function useChartTheme() {
  const read = () => {
    if (typeof window === 'undefined') {
      return { grid: '#e4e8f0', axis: '#5a6478', income: '#15803d', expense: '#dc2626' };
    }
    const styles = getComputedStyle(document.documentElement);
    const pick = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    return {
      grid: pick('--color-border', '#e4e8f0'),
      axis: pick('--color-muted', '#5a6478'),
      income: pick('--color-income', '#15803d'),
      expense: pick('--color-expense', '#dc2626'),
    };
  };

  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const refresh = () => setTheme(read());
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', refresh);
    return () => {
      observer.disconnect();
      mq?.removeEventListener('change', refresh);
    };
  }, []);

  return theme;
}

type DailyExpensePoint = {
  date: string;
  day: number;
  expense: number;
};

type Props = {
  transactions: Transaction[];
  categories: Category[];
  filter: PeriodFilter;
  paydayDay?: number;
  onFilterChange: (filter: PeriodFilter) => void;
};

export function Dashboard({
  transactions,
  categories,
  filter,
  paydayDay = 1,
  onFilterChange,
}: Props) {
  const filteredTransactions = useMemo(
    () =>
      filterTransactionsByPeriod(transactions, {
        ...filter,
        paydayDay,
      }),
    [transactions, filter, paydayDay],
  );

  const totals = useMemo(() => calculateTotals(filteredTransactions), [filteredTransactions]);

  const expenseByCategory = useMemo(
    () => groupTransactionsByCategory(filteredTransactions, categories, 'expense'),
    [filteredTransactions, categories],
  );

  const budgetUsage = useMemo(
    () => calculateBudgetUsage(filteredTransactions, categories),
    [filteredTransactions, categories],
  );

  const sortedBudgetUsage = useMemo(
    () =>
      budgetUsage.toSorted((first, second) => {
        const firstRisk = getBudgetRiskScore(first);
        const secondRisk = getBudgetRiskScore(second);
        if (firstRisk !== secondRisk) return secondRisk - firstRisk;
        return second.amount - first.amount;
      }),
    [budgetUsage],
  );

  const budgetSummary = useMemo(
    () =>
      budgetUsage.reduce(
        (summary, item) => ({
          actual: summary.actual + item.amount,
          planned: summary.planned + item.budget,
        }),
        { actual: 0, planned: 0 },
      ),
    [budgetUsage],
  );

  const monthlyPeriodRange = useMemo(
    () => getMonthlyPeriodRange(filter.year, filter.month, paydayDay),
    [filter.year, filter.month, paydayDay],
  );

  const dailyExpenseTrend = useMemo(
    () => buildDailyExpenseTrend(transactions, monthlyPeriodRange),
    [transactions, monthlyPeriodRange],
  );

  const weeklyExpenseTrend = useMemo(
    () => buildWeeklyExpenseTrend(dailyExpenseTrend),
    [dailyExpenseTrend],
  );

  const monthlyTrend = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const monthTransactions = filterTransactionsByPeriod(transactions, {
          type: 'month',
          year: filter.year,
          month,
        });
        const monthTotals = calculateTotals(monthTransactions);

        return {
          month: getMonthName(month).slice(0, 3),
          income: monthTotals.income,
          expense: monthTotals.expense,
        };
      }),
    [transactions, filter.year],
  );

  const safeToSpend = useMemo(
    () =>
      calculateSafeToSpend(
        budgetSummary.planned,
        totals.expense,
        totals.balance,
        monthlyPeriodRange,
      ),
    [budgetSummary.planned, totals.expense, totals.balance, monthlyPeriodRange],
  );

  // Pace is measured on variable spending only — a rent payment on payday is
  // on plan, not an overspend. See splitVariableSpend.
  const variable = useMemo(
    () => splitVariableSpend(filteredTransactions, categories),
    [filteredTransactions, categories],
  );

  const spendPace = useMemo(
    () => calculateSpendPace(variable.variablePool, variable.variableSpend, monthlyPeriodRange),
    [variable, monthlyPeriodRange],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const todayDate = todayISO();
  const todayTransactions = useMemo(
    () => transactions.filter((t) => t.date === todayDate),
    [transactions, todayDate],
  );

  function changeFilterType(type: PeriodFilter['type']) {
    onFilterChange({
      ...filter,
      type,
      day: filter.day ?? 1,
    });
  }

  function stepPeriod(direction: -1 | 1) {
    onFilterChange(shiftFilter(filter, direction));
  }

  const periodTitle =
    filter.type === 'day'
      ? formatDayTitle(filter)
      : filter.type === 'year'
        ? `ปี ${filter.year}`
        : `${getMonthName(filter.month)} ${filter.year}`;

  return (
    <section className="page-stack" aria-label="ภาพรวม">
      <header className="period-bar" aria-label="ตัวกรองช่วงเวลา">
        <div className="period-bar-top">
          {filter.type === 'month' ? (
            <span className="period-cycle">
              รอบ {formatDateWithoutYear(monthlyPeriodRange.start)} – {formatDateWithoutYear(monthlyPeriodRange.end)}
            </span>
          ) : (
            <span className="period-cycle">ภาพรวมเงินสด</span>
          )}
          <div className="segmented period-type" role="group" aria-label="รูปแบบช่วงเวลา">
            {(['day', 'month', 'year'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={filter.type === type ? 'active' : ''}
                aria-pressed={filter.type === type}
                onClick={() => changeFilterType(type)}
              >
                {type === 'day' ? 'วัน' : type === 'month' ? 'เดือน' : 'ปี'}
              </button>
            ))}
          </div>
        </div>
        <div className="period-stepper">
          <button
            type="button"
            className="period-step-button"
            aria-label="ช่วงเวลาก่อนหน้า"
            onClick={() => stepPeriod(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 aria-live="polite">{periodTitle}</h1>
          <button
            type="button"
            className="period-step-button"
            aria-label="ช่วงเวลาถัดไป"
            onClick={() => stepPeriod(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>


      {filter.type === 'month' && (
        <article
          className={`safe-to-spend-card ${safeToSpend.isOverBudget ? 'over-budget' : ''}`}
          aria-label="งบใช้จ่ายรายวัน"
        >
          <div className="safe-to-spend-header">
            <span className="safe-to-spend-badge">
              {safeToSpend.isOverBudget ? 'เกินงบแล้ว' : 'ใช้ได้สบาย'}
            </span>
            <span className="safe-to-spend-countdown">
              เหลืออีก {safeToSpend.daysRemaining} วันก่อนเงินเดือนออก
            </span>
          </div>
          <div className="safe-to-spend-main">
            <PaceRing
              percentUsed={safeToSpend.percentUsed}
              isOverBudget={safeToSpend.isOverBudget}
            />

            <div className="safe-to-spend-figure">
              <span className="safe-to-spend-label">เหลือใช้วันละ</span>
              <strong className="safe-to-spend-amount">
                <span className="currency-mark" aria-hidden="true">
                  ฿
                </span>
                {safeToSpend.dailySafeToSpend.toLocaleString('th-TH')}
                <span className="sr-only">{formatCurrency(safeToSpend.dailySafeToSpend)}</span>
              </strong>
              <PaceSentence pace={spendPace} hasPlan={budgetSummary.planned > 0} />
              <span className="safe-to-spend-context">
                {budgetSummary.planned > 0
                  ? `เหลือ ${formatCurrency(Math.max(0, safeToSpend.remainingPool))} จากงบ ${formatCurrency(safeToSpend.totalPool)}`
                  : `คงเหลือ ${formatCurrency(totals.balance)}`}
              </span>
            </div>
          </div>

          {/* Text equivalent of the ring — DESIGN.md §6 */}
          <div
            className="safe-to-spend-bar-track"
            role="progressbar"
            aria-label="ความคืบหน้าการใช้งบประมาณเดือน"
            aria-valuenow={safeToSpend.percentUsed}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`ใช้ไปแล้ว ${safeToSpend.percentUsed}% ของงบเดือนนี้`}
          >
            <div
              className={`safe-to-spend-bar-fill ${safeToSpend.isOverBudget ? 'danger' : safeToSpend.percentUsed > 80 ? 'warning' : 'normal'}`}
              style={{ width: `${Math.min(100, safeToSpend.percentUsed)}%` }}
            />
          </div>
        </article>
      )}

      <div className="metric-grid">
        <MetricCard label="รายรับ" value={formatCurrency(totals.income)} tone="income" />
        <MetricCard label="รายจ่าย" value={formatCurrency(totals.expense)} tone="expense" />
        <MetricCard label="ออมเงิน" value={formatCurrency(totals.savings)} tone="savings" />
        <MetricCard label="คงเหลือ" value={formatCurrency(totals.balance)} tone="balance" />
      </div>

      <section className="panel today-transactions-panel" aria-label="รายการวันนี้">
        <div className="today-panel-header">
          <h2>รายการวันนี้</h2>
          <span className="today-date-badge">{formatDateWithoutYear(todayDate)}</span>
        </div>
        {todayTransactions.length === 0 ? (
          <p className="empty-state">ยังไม่มีรายการในวันนี้ — บันทึกได้ทันทีด้วยปุ่ม "จดรายการ"</p>
        ) : (
          <div className="today-transactions-list" role="list">
            {todayTransactions.map((tx) => {
              const cat = categoryById.get(tx.categoryId);
              return (
                <div key={tx.id} className="today-transaction-row" role="listitem">
                  <div className="today-cat-info">
                    <span
                      className="category-dot"
                      style={{ backgroundColor: cat?.color ?? '#94a3b8' }}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{cat?.name ?? 'ไม่พบหมวดหมู่'}</strong>
                      {tx.note && <small>{tx.note}</small>}
                    </div>
                  </div>
                  <span className={`today-tx-amount ${tx.type}`}>
                    {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="analytics-grid">
        <div className="panel">
          <h2>{filter.type === 'month' ? 'แนวโน้มรายสัปดาห์' : 'แนวโน้มทั้งปี'}</h2>
          <div className="chart-box">
            {filter.type === 'month' ? (
              <MonthlyExpenseTrendChart dailyData={dailyExpenseTrend} weeklyData={weeklyExpenseTrend} />
            ) : (
              <YearTrendChart data={monthlyTrend} />
            )}
          </div>
        </div>

        <div className="panel">
          <h2>รายจ่ายตามหมวด</h2>
          {expenseByCategory.length === 0 ? (
            <p className="empty-state">ยังไม่มีรายจ่ายในช่วงนี้</p>
          ) : (
            <ExpenseCategoryChart data={expenseByCategory} />
          )}
        </div>
      </div>

      <div className="panel">
        <h2>งบประมาณรายหมวด</h2>
        <div className="budget-overview" aria-label="สรุปงบประมาณรายหมวด">
          <div className="budget-overview-figures">
            <div aria-label={`รายจ่ายจริง ${formatCurrency(budgetSummary.actual)}`}>
              <span>ใช้ไปแล้ว</span>
              <strong>{formatCurrency(budgetSummary.actual)}</strong>
            </div>
            <div
              className="budget-overview-remaining"
              aria-label={`เหลือ ${formatCurrency(Math.max(0, budgetSummary.planned - budgetSummary.actual))}`}
            >
              <span>เหลือ</span>
              <strong>
                {formatCurrency(Math.max(0, budgetSummary.planned - budgetSummary.actual))}
              </strong>
            </div>
            <div aria-label={`งบประมาณการ ${formatCurrency(budgetSummary.planned)}`}>
              <span>งบทั้งหมด</span>
              <strong>{formatCurrency(budgetSummary.planned)}</strong>
            </div>
          </div>

          {/* One stacked bar showing how the whole budget is divided up, so the
              panel leads with a picture rather than a column of numbers. */}
          <div className="budget-stack" aria-hidden="true">
            {sortedBudgetUsage
              .filter((item) => item.amount > 0)
              .map((item) => (
                <span
                  key={item.category.id}
                  className="budget-stack-part"
                  style={{
                    width: `${budgetSummary.planned > 0 ? (item.amount / budgetSummary.planned) * 100 : 0}%`,
                    background: item.category.color,
                  }}
                  title={`${item.category.name} ${formatCurrency(item.amount)}`}
                />
              ))}
          </div>
          <p className="budget-overview-caption">
            ใช้ไป {budgetSummary.planned > 0
              ? Math.round((budgetSummary.actual / budgetSummary.planned) * 100)
              : 0}
            % ของงบทั้งหมด
          </p>
        </div>
        <div className="budget-list">
          {sortedBudgetUsage.map((item) => {
            const isUnplannedExpense = item.budget === 0 && item.amount > 0;
            const progressValue = isUnplannedExpense ? 100 : Math.min(item.percentUsed, 100);
            const budgetStatusLabel = isUnplannedExpense
              ? `+${formatCurrency(item.amount)}`
              : `${item.percentUsed}%`;
            const progressLabel = isUnplannedExpense
              ? `${item.category.name} นอกแผน ${budgetStatusLabel}`
              : `${item.category.name} ใช้งบไป ${item.percentUsed}%`;

            return (
              <div className="budget-row" key={item.category.id} data-testid="budget-row">
                <div className="budget-row-head">
                  <span className="budget-row-name">
                    <span
                      className="category-dot"
                      style={{ backgroundColor: item.category.color }}
                      aria-hidden="true"
                    />
                    <strong>{item.category.name}</strong>
                  </span>
                  <span>
                    {formatCurrency(item.amount)} / {formatCurrency(item.budget)}
                  </span>
                </div>
                <div className="budget-row-meter">
                  <div className="progress">
                    <span
                      role="progressbar"
                      aria-label={progressLabel}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressValue}
                      style={{
                        width: `${progressValue}%`,
                        background: isUnplannedExpense || item.percentUsed > 100 ? '#dc2626' : item.category.color,
                      }}
                    />
                  </div>
                  <strong className={isUnplannedExpense ? 'budget-status overrun' : 'budget-status'}>
                    {budgetStatusLabel}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * The one expressive element in the product (DESIGN.md §6). It is always
 * paired with PaceSentence — the ring alone is decoration.
 */
function PaceRing({
  percentUsed,
  isOverBudget,
}: {
  percentUsed: number;
  isOverBudget: boolean;
}) {
  const radius = 49;
  const circumference = 2 * Math.PI * radius;
  const shown = Math.min(100, Math.max(0, percentUsed));
  const offset = circumference * (1 - shown / 100);
  const tone = isOverBudget
    ? 'var(--color-expense)'
    : shown > 80
      ? 'var(--color-warn)'
      : 'var(--color-blade)';

  return (
    <div className="pace-ring" aria-hidden="true">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--hero-track)" strokeWidth="9" />
        <circle
          className="pace-ring-arc"
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <div className="pace-ring-center">
        <span className="pace-ring-value">{percentUsed}%</span>
        <span className="pace-ring-caption">ใช้ไปแล้ว</span>
      </div>
    </div>
  );
}

/**
 * v1 showed "43% used" but never whether 43% on day 6 of 30 was good news.
 * This is that sentence.
 */
function PaceSentence({ pace, hasPlan }: { pace: SpendPace; hasPlan: boolean }) {
  if (!hasPlan) return null;

  if (pace.status === 'on-track') {
    return (
      <span className="pace-sentence on-track">
        <Minus size={13} aria-hidden="true" />
        ใช้ตามแผนพอดี
      </span>
    );
  }

  const isUnder = pace.status === 'under';
  const Icon = isUnder ? TrendingDown : TrendingUp;

  return (
    <span className={`pace-sentence ${isUnder ? 'under' : 'over'}`}>
      <Icon size={13} aria-hidden="true" />
      {isUnder ? 'ประหยัดกว่าแผน' : 'ใช้เกินแผน'} {formatCurrency(Math.abs(pace.delta))}
    </span>
  );
}

function formatDayTitle(filter: PeriodFilter): string {
  const day = filter.day ?? 1;
  return dayTitleFormatter.format(new Date(filter.year, filter.month - 1, day));
}

/** Moves the filter one period in `direction`, rolling months and years over. */
function shiftFilter(filter: PeriodFilter, direction: -1 | 1): PeriodFilter {
  if (filter.type === 'year') {
    return { ...filter, year: filter.year + direction };
  }

  if (filter.type === 'day') {
    const next = new Date(filter.year, filter.month - 1, (filter.day ?? 1) + direction);
    return {
      ...filter,
      year: next.getFullYear(),
      month: next.getMonth() + 1,
      day: next.getDate(),
    };
  }

  const next = new Date(filter.year, filter.month - 1 + direction, 1);
  return { ...filter, year: next.getFullYear(), month: next.getMonth() + 1 };
}

function buildDailyExpenseTrend(
  transactions: Transaction[],
  range: { start: string; end: string },
): DailyExpensePoint[] {
  const startDate = parseISODate(range.start);
  const endDate = parseISODate(range.end);
  if (!startDate || !endDate) return [];

  const dailyData: DailyExpensePoint[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const date = toISODate(currentDate);
    const dayTransactions = transactions.filter((transaction) => transaction.date === date);
    const dayTotals = calculateTotals(dayTransactions);

    dailyData.push({
      date,
      day: currentDate.getDate(),
      expense: dayTotals.expense,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dailyData;
}

function formatDateWithoutYear(value: string): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '';

  return dateWithoutYearFormatter.format(date);
}

function buildWeeklyExpenseTrend(
  dailyData: DailyExpensePoint[],
): Array<{ label: string; expense: number }> {
  const weeks: Array<{ label: string; expense: number }> = [];
  let startIndex = 0;

  while (startIndex < dailyData.length) {
    const startPoint = dailyData[startIndex];
    const weekday = parseISODate(startPoint.date)?.getDay() ?? 1;
    const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday;
    const endIndex = Math.min(startIndex + daysUntilSunday, dailyData.length - 1);
    const expense = dailyData
      .slice(startIndex, endIndex + 1)
      .reduce((total, item) => total + item.expense, 0);
    const endPoint = dailyData[endIndex];

    weeks.push({
      label: `${startPoint.day}-${endPoint.day}`,
      expense,
    });

    startIndex = endIndex + 1;
  }

  return weeks;
}

function getBudgetRiskScore(item: { amount: number; budget: number; percentUsed: number }): number {
  if (item.budget === 0 && item.amount > 0) return 1000 + item.amount;
  if (item.percentUsed > 100) return 900 + item.percentUsed;
  if (item.percentUsed >= 80) return 500 + item.percentUsed;
  return item.percentUsed;
}

function MonthlyExpenseTrendChart({
  dailyData,
  weeklyData,
}: {
  dailyData: DailyExpensePoint[];
  weeklyData: Array<{ label: string; expense: number }>;
}) {
  const chartTheme = useChartTheme();
  const newestFirstData = [...dailyData].reverse();
  const activeDays = newestFirstData.filter((item) => item.expense > 0);
  const maxValue = Math.max(...weeklyData.map((item) => item.expense), 1);

  return (
    <div className="trend-chart daily-trend-chart">
      <span
        className="sr-only"
        role="img"
        aria-label={`แนวโน้มรายจ่ายรายสัปดาห์: ${weeklyData
          .map((item) => `${item.label} ${formatCurrency(item.expense)}`)
          .join(', ')}`}
      />
      <table className="sr-only">
        <caption>สรุปรายจ่ายรายสัปดาห์</caption>
        <thead>
          <tr>
            <th>ช่วงวันที่</th>
            <th>รายจ่าย</th>
          </tr>
        </thead>
        <tbody>
          {weeklyData.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{formatCurrency(item.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="trend-bars weekly-trend-bars" aria-hidden="true">
        <ResponsiveContainer width="100%" height={210} minWidth={280} initialDimension={{ width: 460, height: 210 }}>
          <BarChart data={weeklyData} margin={{ top: 12, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: chartTheme.axis, fontSize: 12 }}
            />
            <YAxis hide domain={[0, maxValue]} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(label) => `วันที่ ${label}`} />
            <Bar dataKey="expense" name="รายจ่าย" fill={chartTheme.expense} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {activeDays.length > 0 ? (
        <div
          className="daily-trend-values daily-trend-scroll"
          role="region"
          aria-label="แถบจำนวนเงินรายวันแบบเลื่อนได้"
          tabIndex={0}
        >
          {activeDays.map((item) => (
            <span key={item.day}>
              วันที่ {item.day} <strong>{formatCurrency(item.expense)}</strong>
            </span>
          ))}
        </div>
      ) : (
        <p className="empty-state">ยังไม่มีรายจ่ายในเดือนนี้</p>
      )}
    </div>
  );
}

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function YearTrendChart({
  data,
}: {
  data: Array<{ month: string; income: number; expense: number }>;
}) {
  const chartTheme = useChartTheme();
  const maxValue = Math.max(...data.flatMap((item) => [item.income, item.expense]), 1);

  return (
    <div
      className="trend-chart"
      role="img"
      aria-label={`แนวโน้มรายรับรายจ่ายทั้งปี: ${summarizeActiveMonths(data)}`}
    >
      <table className="sr-only">
        <caption>สรุปรายรับรายจ่ายรายเดือน</caption>
        <thead>
          <tr>
            <th>เดือน</th>
            <th>รายรับ</th>
            <th>รายจ่าย</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.month}>
              <td>{item.month}</td>
              <td>{formatCurrency(item.income)}</td>
              <td>{formatCurrency(item.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="trend-bars" aria-hidden="true">
        <ResponsiveContainer width="100%" height={230} minWidth={280} initialDimension={{ width: 560, height: 230 }}>
          <BarChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: chartTheme.axis, fontSize: 12 }}
            />
            <YAxis hide domain={[0, maxValue]} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar dataKey="income" name="รายรับ" fill={chartTheme.income} radius={[5, 5, 0, 0]} />
            <Bar dataKey="expense" name="รายจ่าย" fill={chartTheme.expense} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="trend-legend">
        <span className="category-dot income-dot" />
        รายรับ
        <span className="category-dot expense-dot" />
        รายจ่าย
      </div>
    </div>
  );
}

function summarizeActiveMonths(
  data: Array<{ month: string; income: number; expense: number }>,
): string {
  return data.reduce<string[]>((summary, item) => {
    if (item.income === 0 && item.expense === 0) return summary;

    summary.push(`${item.month} รายรับ ${formatCurrency(item.income)} รายจ่าย ${formatCurrency(item.expense)}`);
    return summary;
  }, []).join(', ');
}

function ExpenseCategoryChart({ data }: { data: CategoryTotal[] }) {
  return (
    <div className="pie-summary">
      <div
        className="category-pie-chart"
        role="img"
        aria-label={`รายจ่ายตามหมวด: ${data
          .map((item) => `${item.category.name} ${formatCurrency(item.amount)}`)
          .join(', ')}`}
      >
        <PieChart width={220} height={220}>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category.name"
            cx="50%"
            cy="50%"
            innerRadius={54}
            outerRadius={94}
            paddingAngle={1}
          >
            {data.map((item) => (
              <Cell key={item.category.id} fill={item.category.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        </PieChart>
      </div>
      <div className="pie-legend">
        {data.map((item) => (
          <div key={item.category.id}>
            <span className="category-dot" style={{ background: item.category.color }} />
            <strong>{item.category.name}</strong>
            <span>{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'income' | 'expense' | 'savings' | 'balance';
}) {
  return (
    <article className={`metric-card ${tone}`} aria-label={`${label} ${value}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
