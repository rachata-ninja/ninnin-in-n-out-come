import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultCategories } from '../data/defaultData';
import { todayISO } from '../domain/finance';
import { TransactionForm } from './TransactionForm';

describe('TransactionForm', () => {
  it('defaults the transaction date to today', () => {
    render(<TransactionForm categories={defaultCategories} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('วันที่')).toHaveValue(todayISO());
  });

  it('shows validation errors for empty category and invalid amount', async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={defaultCategories} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาเลือกหมวดหมู่');
    expect(screen.getByRole('alert')).toHaveTextContent('จำนวนเงินต้องมากกว่า 0');
  });
});
