import {
  type CategoryTotal,
  calculateBudgetUsage,
  calculateTotals,
  filterTransactionsByPeriod,
  groupTransactionsByCategory,
} from '../domain/finance';
import { formatCurrency, getMonthName } from '../format';
import type { Category, PeriodFilter, Transaction } from '../types';

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
  const expensePieGradient = buildPieGradient(expenseByCategory);
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

  return (
    <section className="page-stack" aria-label="Dashboard">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>ภาพรวมเงินสด</h1>
        </div>
        <div className="filter-controls">
          <select
            aria-label="รูปแบบช่วงเวลา"
            value={filter.type}
            onChange={(event) =>
              onFilterChange({ ...filter, type: event.target.value as PeriodFilter['type'] })
            }
          >
            <option value="month">รายเดือน</option>
            <option value="year">รายปี</option>
          </select>
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
          <input
            aria-label="ปี"
            type="number"
            value={filter.year}
            onChange={(event) => onFilterChange({ ...filter, year: Number(event.target.value) })}
          />
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="รายรับ" value={formatCurrency(totals.income)} tone="income" />
        <MetricCard label="รายจ่าย" value={formatCurrency(totals.expense)} tone="expense" />
        <MetricCard label="คงเหลือ" value={formatCurrency(totals.balance)} tone="balance" />
      </div>

      <div className="analytics-grid">
        <div className="panel">
          <h2>แนวโน้มทั้งปี</h2>
          <div className="chart-box">
            <YearTrendChart data={monthlyTrend} />
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
  tone: 'income' | 'expense' | 'balance';
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
