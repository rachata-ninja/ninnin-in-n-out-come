import {
  type CategoryTotal,
  calculateBudgetUsage,
  calculateTotals,
  filterTransactionsByPeriod,
  groupTransactionsByCategory,
} from '../domain/finance';
import { formatCurrency, getMonthName } from '../format';
import type { Category, PeriodFilter, Transaction } from '../types';

const appLogoPath = '/assets/nin-jah-ma-jod-logo.png';

type Props = {
  transactions: Transaction[];
  categories: Category[];
  filter: PeriodFilter;
  onFilterChange: (filter: PeriodFilter) => void;
};

export function Dashboard({ transactions, categories, filter, onFilterChange }: Props) {
  const filteredTransactions = filterTransactionsByPeriod(transactions, filter);
  const totals = calculateTotals(filteredTransactions);
  const expenseByCategory = groupTransactionsByCategory(filteredTransactions, categories, 'expense');
  const budgetUsage = calculateBudgetUsage(filteredTransactions, categories);
  const budgetSummary = budgetUsage.reduce(
    (summary, item) => ({
      actual: summary.actual + item.amount,
      planned: summary.planned + item.budget,
    }),
    { actual: 0, planned: 0 },
  );
  const expensePieGradient = buildPieGradient(expenseByCategory);
  const dailyExpenseTrend = buildDailyExpenseTrend(transactions, filter.year, filter.month);
  const weeklyExpenseTrend = buildWeeklyExpenseTrend(dailyExpenseTrend, filter.year, filter.month);
  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
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
  });

  const selectedDate = toDateInputValue(filter);

  function changeFilterType(type: PeriodFilter['type']) {
    onFilterChange({
      ...filter,
      type,
      day: filter.day ?? 1,
    });
  }

  function changeDailyDate(value: string) {
    const nextDate = parseDateInputValue(value);
    if (!nextDate) return;

    onFilterChange({
      ...filter,
      type: 'day',
      year: nextDate.year,
      month: nextDate.month,
      day: nextDate.day,
    });
  }

  return (
    <section className="page-stack" aria-label="Dashboard">
      <div className="toolbar">
        <div className="dashboard-title">
          <img className="dashboard-logo" src={appLogoPath} alt="NinJahMajod logo" />
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>ภาพรวมเงินสด</h1>
          </div>
        </div>
        <div className="filter-controls">
          <select
            aria-label="รูปแบบช่วงเวลา"
            value={filter.type}
            onChange={(event) => changeFilterType(event.target.value as PeriodFilter['type'])}
          >
            <option value="month">รายเดือน</option>
            <option value="day">รายวัน</option>
            <option value="year">รายปี</option>
          </select>
          {filter.type === 'day' && (
            <input
              aria-label="วันที่"
              type="date"
              value={selectedDate}
              onChange={(event) => changeDailyDate(event.target.value)}
            />
          )}
          {filter.type === 'month' && (
            <select
              aria-label="เดือน"
              value={filter.month}
              onChange={(event) => onFilterChange({ ...filter, month: Number(event.target.value) })}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
          )}
          {filter.type !== 'day' && (
            <input
              aria-label="ปี"
              type="number"
              value={filter.year}
              onChange={(event) => onFilterChange({ ...filter, year: Number(event.target.value) })}
            />
          )}
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="รายรับ" value={formatCurrency(totals.income)} tone="income" />
        <MetricCard label="รายจ่าย" value={formatCurrency(totals.expense)} tone="expense" />
        <MetricCard label="ออมเงินทั้งหมด" value={formatCurrency(totals.savings)} tone="savings" />
        <MetricCard label="คงเหลือ" value={formatCurrency(totals.balance)} tone="balance" />
      </div>

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
            <div className="pie-summary">
              <div
                className="css-pie"
                style={{ background: expensePieGradient }}
                role="img"
                aria-label={`รายจ่ายตามหมวด: ${expenseByCategory
                  .map((item) => `${item.category.name} ${formatCurrency(item.amount)}`)
                  .join(', ')}`}
              />
              <div className="pie-legend">
                {expenseByCategory.map((item) => (
                  <div key={item.category.id}>
                    <span className="category-dot" style={{ background: item.category.color }} />
                    <strong>{item.category.name}</strong>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>งบประมาณรายหมวด</h2>
        <div className="budget-summary" aria-label="สรุปงบประมาณรายหมวด">
          <div aria-label={`รายจ่ายจริง ${formatCurrency(budgetSummary.actual)}`}>
            <span>รายจ่ายจริง</span>
            <strong>{formatCurrency(budgetSummary.actual)}</strong>
          </div>
          <div aria-label={`งบประมาณการ ${formatCurrency(budgetSummary.planned)}`}>
            <span>งบประมาณการ</span>
            <strong>{formatCurrency(budgetSummary.planned)}</strong>
          </div>
        </div>
        <div className="budget-list">
          {budgetUsage.map((item) => (
            <div className="budget-row" key={item.category.id}>
              <div>
                <strong>{item.category.name}</strong>
                <span>
                  {formatCurrency(item.amount)} / {formatCurrency(item.budget)}
                </span>
              </div>
              <div className="progress" aria-label={`${item.category.name} ใช้ไป ${item.percentUsed}%`}>
                <span
                  role="progressbar"
                  aria-label={`${item.category.name} ใช้งบไป ${item.percentUsed}%`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(item.percentUsed, 100)}
                  style={{
                    width: `${Math.min(item.percentUsed, 100)}%`,
                    background: item.percentUsed > 100 ? '#dc2626' : item.category.color,
                  }}
                />
              </div>
              <strong>{item.percentUsed}%</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function toDateInputValue(filter: PeriodFilter): string {
  const day = filter.day ?? 1;
  return `${filter.year}-${String(filter.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateInputValue(value: string): Pick<PeriodFilter, 'year' | 'month' | 'day'> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
}

function buildDailyExpenseTrend(
  transactions: Transaction[],
  year: number,
  month: number,
): Array<{ day: number; expense: number }> {
  const daysInMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayTransactions = filterTransactionsByPeriod(transactions, {
      type: 'day',
      year,
      month,
      day,
    });
    const dayTotals = calculateTotals(dayTransactions);

    return {
      day,
      expense: dayTotals.expense,
    };
  });
}

function buildWeeklyExpenseTrend(
  dailyData: Array<{ day: number; expense: number }>,
  year: number,
  month: number,
): Array<{ label: string; expense: number }> {
  const weeks: Array<{ label: string; expense: number }> = [];
  let startDay = 1;

  while (startDay <= dailyData.length) {
    const weekday = new Date(year, month - 1, startDay).getDay();
    const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday;
    const endDay = Math.min(startDay + daysUntilSunday, dailyData.length);
    const expense = dailyData
      .slice(startDay - 1, endDay)
      .reduce((total, item) => total + item.expense, 0);

    weeks.push({
      label: `${startDay}-${endDay}`,
      expense,
    });

    startDay = endDay + 1;
  }

  return weeks;
}

function buildPieGradient(items: CategoryTotal[]): string {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    const end = cursor + (item.amount / total) * 100;
    cursor = end;
    return `${item.category.color} ${start}% ${end}%`;
  });

  return `conic-gradient(${stops.join(', ')})`;
}

function MonthlyExpenseTrendChart({
  dailyData,
  weeklyData,
}: {
  dailyData: Array<{ day: number; expense: number }>;
  weeklyData: Array<{ label: string; expense: number }>;
}) {
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
        {weeklyData.map((item) => (
          <div className="trend-month" key={item.label}>
            <div className="trend-columns">
              <span
                className="trend-bar expense"
                style={{ height: `${Math.max((item.expense / maxValue) * 100, item.expense > 0 ? 3 : 0)}%` }}
                title={`${item.label} ${formatCurrency(item.expense)}`}
              />
            </div>
            <span>{item.label}</span>
          </div>
        ))}
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

function YearTrendChart({
  data,
}: {
  data: Array<{ month: string; income: number; expense: number }>;
}) {
  const maxValue = Math.max(...data.flatMap((item) => [item.income, item.expense]), 1);

  return (
    <div
      className="trend-chart"
      role="img"
      aria-label={`แนวโน้มรายรับรายจ่ายทั้งปี: ${data
        .filter((item) => item.income > 0 || item.expense > 0)
        .map((item) => `${item.month} รายรับ ${formatCurrency(item.income)} รายจ่าย ${formatCurrency(item.expense)}`)
        .join(', ')}`}
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
        {data.map((item) => (
          <div className="trend-month" key={item.month}>
            <div className="trend-columns">
              <span
                className="trend-bar income"
                style={{ height: `${Math.max((item.income / maxValue) * 100, item.income > 0 ? 3 : 0)}%` }}
                title={`รายรับ ${item.month} ${formatCurrency(item.income)}`}
              />
              <span
                className="trend-bar expense"
                style={{ height: `${Math.max((item.expense / maxValue) * 100, item.expense > 0 ? 3 : 0)}%` }}
                title={`รายจ่าย ${item.month} ${formatCurrency(item.expense)}`}
              />
            </div>
            <span>{item.month}</span>
          </div>
        ))}
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
