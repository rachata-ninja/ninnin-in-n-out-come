import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultCategories } from '../data/defaultData';
import type { Transaction } from '../types';
import { Dashboard } from './Dashboard';

const transactions: Transaction[] = [
  {
    id: 'income-may',
    type: 'income',
    categoryId: 'salary',
    amount: 30000,
    date: '2026-05-01',
    note: '',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'expense-may',
    type: 'expense',
    categoryId: 'food',
    amount: 1000,
    date: '2026-05-02',
    note: '',
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
  },
  {
    id: 'expense-may-later',
    type: 'expense',
    categoryId: 'transport',
    amount: 250,
    date: '2026-05-15',
    note: '',
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
  },
  {
    id: 'expense-june',
    type: 'expense',
    categoryId: 'food',
    amount: 500,
    date: '2026-06-02',
    note: '',
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  },
  {
    id: 'saving-may',
    type: 'savings',
    categoryId: 'savings',
    amount: 2500,
    date: '2026-05-03',
    note: '',
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
  },
];

describe('Dashboard', () => {
  it('shows the NinJahMajod logo in the dashboard header', () => {
    render(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 5 }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'NinJahMajod logo' })).toHaveAttribute(
      'src',
      '/assets/nin-jah-ma-jod-logo.png',
    );
  });

  it('keeps the dashboard on the monthly filter by default', () => {
    render(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 5 }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('รูปแบบช่วงเวลา')).toHaveValue('month');
    expect(screen.getByLabelText('เดือน')).toHaveValue('5');
    expect(screen.queryByLabelText('วันที่')).not.toBeInTheDocument();
  });

  it('updates displayed totals when the month filter changes', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 5 }}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getAllByText('฿30,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('฿1,250').length).toBeGreaterThan(0);
    expect(screen.getAllByText('฿2,500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('฿26,250').length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('เดือน'), '6');
    expect(onFilterChange).toHaveBeenCalledWith({ type: 'month', year: 2026, month: 6 });

    rerender(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 6 }}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getAllByText('฿500').length).toBeGreaterThan(0);
  });

  it('summarizes actual expenses and planned budget in the category budget panel', () => {
    render(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 5 }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('รายจ่ายจริง ฿1,250')).toBeInTheDocument();
    expect(screen.getByLabelText('งบประมาณการ ฿25,500')).toBeInTheDocument();
  });

  it('uses a weekly expense bar chart when the dashboard is filtered by month', () => {
    render(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 5 }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'แนวโน้มรายสัปดาห์' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /แนวโน้มรายจ่ายรายสัปดาห์: 1-3 ฿1,000, 4-10 ฿0, 11-17 ฿250/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('1-3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4-10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('11-17').length).toBeGreaterThan(0);
    expect(screen.getByText('วันที่ 2')).toBeInTheDocument();
    expect(screen.getAllByText('฿1,000').length).toBeGreaterThan(0);
    expect(screen.getByText('วันที่ 15')).toBeInTheDocument();
    expect(screen.getAllByText('฿250').length).toBeGreaterThan(0);
  });

  it('keeps the daily amount strip scrollable from newer days back to day one', () => {
    render(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 5 }}
        onFilterChange={vi.fn()}
      />,
    );

    const chartScroller = screen.getByRole('region', { name: 'แถบจำนวนเงินรายวันแบบเลื่อนได้' });
    expect(chartScroller).toHaveClass('daily-trend-scroll');

    const dayLabels = within(chartScroller).getAllByText(/^วันที่ \d+/).map((element) => element.textContent);
    expect(dayLabels.slice(0, 2)).toEqual(['วันที่ 15 ฿250', 'วันที่ 2 ฿1,000']);
  });

  it('switches to a daily filter and shows only transactions from that date', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'month', year: 2026, month: 5 }}
        onFilterChange={onFilterChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText('รูปแบบช่วงเวลา'), 'day');
    expect(onFilterChange).toHaveBeenCalledWith({ type: 'day', year: 2026, month: 5, day: 1 });

    rerender(
      <Dashboard
        transactions={transactions}
        categories={defaultCategories}
        filter={{ type: 'day', year: 2026, month: 5, day: 2 }}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByLabelText('วันที่')).toHaveValue('2026-05-02');
    expect(screen.getAllByText('฿1,000').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('รายรับ ฿0')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('วันที่'), { target: { value: '2026-05-03' } });

    expect(onFilterChange).toHaveBeenLastCalledWith({
      type: 'day',
      year: 2026,
      month: 5,
      day: 3,
    });
  });
});
