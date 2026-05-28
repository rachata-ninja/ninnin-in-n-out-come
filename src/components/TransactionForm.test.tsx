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

  it('lets users record savings with savings categories', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TransactionForm categories={defaultCategories} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'ออมเงิน' }));
    await user.selectOptions(screen.getByLabelText('หมวดหมู่'), screen.getByRole('option', { name: 'เงินออม' }));
    await user.type(screen.getByLabelText('จำนวนเงิน'), '2500');
    await user.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'savings',
      categoryId: 'savings',
      amount: 2500,
    }));
  });
});
