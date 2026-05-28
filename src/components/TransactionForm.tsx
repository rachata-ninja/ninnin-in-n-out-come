import { Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { getSelectableCategories, todayISO, validateTransactionInput } from '../domain/finance';
import type { Category, TransactionInput, TransactionType } from '../types';

type Props = {
  categories: Category[];
  onSubmit: (input: TransactionInput) => void | Promise<void>;
};

export function TransactionForm({ categories, onSubmit }: Props) {
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const selectableCategories = useMemo(
    () => getSelectableCategories(categories, type),
    [categories, type],
  );

  function handleTypeChange(nextType: TransactionType) {
    setType(nextType);
    setCategoryId('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: TransactionInput = {
      type,
      categoryId,
      amount: Number(amount),
      date,
      note: note.trim(),
    };
    const nextErrors = validateTransactionInput(input);

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit(input);
    setAmount('');
    setNote('');
    setErrors([]);
  }

  return (
    <form className="transaction-form" onSubmit={handleSubmit} aria-label="เพิ่มรายการ" noValidate>
      <div className="segmented" aria-label="ประเภทรายการ">
        <button
          type="button"
          className={type === 'expense' ? 'active' : ''}
          aria-pressed={type === 'expense'}
          onClick={() => handleTypeChange('expense')}
        >
          รายจ่าย
        </button>
        <button
          type="button"
          className={type === 'income' ? 'active' : ''}
          aria-pressed={type === 'income'}
          onClick={() => handleTypeChange('income')}
        >
          รายรับ
        </button>
      </div>

      <label>
        หมวดหมู่
        <select
          aria-label="หมวดหมู่"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">เลือกหมวดหมู่</option>
          {selectableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        จำนวนเงิน
        <input
          aria-label="จำนวนเงิน"
          inputMode="decimal"
          min="0"
          required
          step="0.01"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
        />
      </label>

      <label>
        วันที่
        <input
          aria-label="วันที่"
          required
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>

      <label className="wide">
        โน้ต
        <input
          aria-label="โน้ต"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="เช่น ข้าวกลางวัน"
        />
      </label>

      {errors.length > 0 && (
        <div className="form-errors" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <button className="primary-button" type="submit">
        <Plus size={18} />
        เพิ่มรายการ
      </button>
    </form>
  );
}
