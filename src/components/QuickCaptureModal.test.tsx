import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultCategories } from '../data/defaultData';
import { QuickCaptureModal } from './QuickCaptureModal';

describe('QuickCaptureModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <QuickCaptureModal
        isOpen={false}
        categories={defaultCategories}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders numpad, quick chips, categories and allows typing amounts', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <QuickCaptureModal
        isOpen={true}
        categories={defaultCategories}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'จดรายการด่วน' })).toBeInTheDocument();

    // Type 65 on numpad
    await user.click(screen.getByRole('button', { name: '6' }));
    await user.click(screen.getByRole('button', { name: '5' }));

    expect(screen.getByTestId('quick-amount-value')).toHaveTextContent('65');

    // Quick chip +50 -> 115
    await user.click(screen.getByRole('button', { name: '+50' }));
    expect(screen.getByTestId('quick-amount-value')).toHaveTextContent('115');

    // Type note
    await user.type(screen.getByLabelText('โน้ตรายการ'), 'มื้อเที่ยง');

    // Save
    await user.click(screen.getByRole('button', { name: /บันทึก/ }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        amount: 115,
        note: 'มื้อเที่ยง',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('allows backspace and clearing', async () => {
    const user = userEvent.setup();

    render(
      <QuickCaptureModal
        isOpen={true}
        categories={defaultCategories}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '9' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    expect(screen.getByTestId('quick-amount-value')).toHaveTextContent('90');

    await user.click(screen.getByRole('button', { name: 'ลบตัวเลข' }));
    expect(screen.getByTestId('quick-amount-value')).toHaveTextContent('9');
  });
});
