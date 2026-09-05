import * as Dialog from '@radix-ui/react-dialog';
import { Delete, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { getSelectableCategories, todayISO, validateTransactionInput } from '../domain/finance';
import { formatCurrency } from '../format';
import type { Category, TransactionInput, TransactionType } from '../types';

type Props = {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSubmit: (input: TransactionInput) => boolean | Promise<boolean>;
};

export function QuickCaptureModal(props: Props) {
  return (
    <Dialog.Root
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <AnimatePresence>
        {props.isOpen && <QuickCaptureDialog {...props} />}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function QuickCaptureDialog({ categories, onClose, onSubmit }: Props) {
  const reduceMotion = useReducedMotion();
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectableCategories = useMemo(
    () => getSelectableCategories(categories, type),
    [categories, type],
  );

  const categoryId =
    selectedCategoryId && selectableCategories.some((c) => c.id === selectedCategoryId)
      ? selectedCategoryId
      : (selectableCategories[0]?.id ?? '');

  function handleTypeChange(nextType: TransactionType) {
    setType(nextType);
    setSelectedCategoryId(null);
    setError('');
  }

  const currentAmountNum = Number(amountStr) || 0;

  function appendDigit(digit: string) {
    setError('');
    setAmountStr((prev) => {
      if (prev.length >= 8) return prev;
      if (digit === '.') {
        if (prev.includes('.')) return prev;
        return prev ? `${prev}.` : '0.';
      }
      if (prev === '0') return digit;
      return `${prev}${digit}`;
    });
  }

  function handleBackspace() {
    setError('');
    setAmountStr((prev) => prev.slice(0, -1));
  }

  function handleAddQuickAmount(add: number) {
    setError('');
    setAmountStr((prev) => {
      const current = Number(prev) || 0;
      return String(current + add);
    });
  }

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    if (isSubmitting) return;

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('กรุณาระบุจำนวนเงินมากกว่า 0');
      return;
    }

    if (!categoryId) {
      setError('กรุณาเลือกหมวดหมู่');
      return;
    }

    const input: TransactionInput = {
      clientRequestId: crypto.randomUUID(),
      type,
      categoryId,
      amount,
      date: todayISO(),
      note: note.trim(),
    };

    const validationErrors = validateTransactionInput(input);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSubmit(input);
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog.Portal forceMount>
      <Dialog.Overlay asChild>
        <motion.div
          className="quick-capture-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.32, 0.72, 0, 1] }}
        />
      </Dialog.Overlay>
      <Dialog.Content asChild aria-label="จดรายการด่วน">
        <motion.div
          className="quick-capture-sheet"
          initial={{ y: reduceMotion ? 0 : '100%' }}
          animate={{ y: 0 }}
          exit={{ y: reduceMotion ? 0 : '100%' }}
          transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.32, 0.72, 0, 1] }}
        >
          <Dialog.Title className="sr-only">จดรายการด่วน</Dialog.Title>
        <div className="quick-capture-header">
          <div className="segmented quick-type-segmented" aria-label="เลือกประเภทรายการ">
            <button
              type="button"
              className={type === 'expense' ? 'active' : ''}
              onClick={() => handleTypeChange('expense')}
            >
              รายจ่าย
            </button>
            <button
              type="button"
              className={type === 'income' ? 'active' : ''}
              onClick={() => handleTypeChange('income')}
            >
              รายรับ
            </button>
            <button
              type="button"
              className={type === 'savings' ? 'active' : ''}
              onClick={() => handleTypeChange('savings')}
            >
              ออมเงิน
            </button>
          </div>
          <Dialog.Close asChild>
            <button type="button" className="icon-button quick-close-btn" aria-label="ปิด">
              <X size={20} />
            </button>
          </Dialog.Close>
        </div>

        {/* Big Amount Display */}
        <div className="quick-amount-display">
          <span className="quick-currency-symbol">฿</span>
          <span className="quick-amount-value" data-testid="quick-amount-value">
            {amountStr || '0'}
          </span>
        </div>

        {error && (
          <p className="quick-capture-error" role="alert">
            {error}
          </p>
        )}

        {/* Quick Amount Chips */}
        <div className="quick-chips-row" aria-label="เพิ่มจำนวนเงินด่วน">
          <button type="button" className="quick-amount-chip" onClick={() => handleAddQuickAmount(50)}>
            +50
          </button>
          <button type="button" className="quick-amount-chip" onClick={() => handleAddQuickAmount(100)}>
            +100
          </button>
          <button type="button" className="quick-amount-chip" onClick={() => handleAddQuickAmount(500)}>
            +500
          </button>
          <button type="button" className="quick-amount-chip" onClick={() => handleAddQuickAmount(1000)}>
            +1,000
          </button>
        </div>

        {/* Horizontal Category Chips */}
        <div className="quick-categories-scroll" role="radiogroup" aria-label="เลือกหมวดหมู่">
          {selectableCategories.map((category) => {
            const isSelected = category.id === categoryId;
            return (
              <button
                key={category.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`quick-category-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  setError('');
                }}
              >
                <span
                  className="category-dot"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                <span>{category.name}</span>
              </button>
            );
          })}
        </div>

        {/* Optional Note Field */}
        <div className="quick-note-wrap">
          <input
            type="text"
            className="quick-note-input"
            placeholder="โน้ตช่วยจำ (เช่น ลาเต้, กะเพรา)..."
            aria-label="โน้ตรายการ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Numeric Keypad Grid */}
        <div className="numpad-grid" aria-label="แป้นตัวเลข">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              className="numpad-key"
              onClick={() => appendDigit(digit)}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="numpad-key"
            onClick={() => appendDigit('.')}
          >
            .
          </button>
          <button
            type="button"
            className="numpad-key"
            onClick={() => appendDigit('0')}
          >
            0
          </button>
          <button
            type="button"
            className="numpad-key numpad-action-key"
            aria-label="ลบตัวเลข"
            onClick={handleBackspace}
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Primary Thumb-Zone Save Button */}
        <button
          type="button"
          className="primary-button quick-save-button"
          disabled={isSubmitting || currentAmountNum <= 0}
          onClick={() => handleSave()}
        >
          {isSubmitting ? 'กำลังบันทึก...' : `บันทึก ${currentAmountNum > 0 ? formatCurrency(currentAmountNum) : ''}`}
        </button>
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
