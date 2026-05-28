import { render, screen } from '@testing-library/react';
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
    id: 'expense-june',
    type: 'expense',
    categoryId: 'food',
    amount: 500,
    date: '2026-06-02',
    note: '',
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  },
];

describe('Dashboard', () => {
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
    expect(screen.getAllByText('฿1,000').length).toBeGreaterThan(0);

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
});
