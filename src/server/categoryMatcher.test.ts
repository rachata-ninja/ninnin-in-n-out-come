import { describe, expect, it } from 'vitest';
import { defaultCategories } from '../data/defaultData';
import { matchCategory } from './categoryMatcher';

describe('categoryMatcher', () => {
  it('matches category by explicit name', () => {
    const matched = matchCategory(defaultCategories, { categoryName: 'ค่าอาหาร' });
    expect(matched?.id).toBe('food');
  });

  it('matches category by english keyword "food"', () => {
    const matched = matchCategory(defaultCategories, { note: 'Paid food for 60 baht' });
    expect(matched?.id).toBe('food');
  });

  it('matches coffee / drink keywords to food or snack', () => {
    const matched = matchCategory(defaultCategories, { note: 'Starbucks iced latte' });
    expect(['food', 'seven', 'snack']).toContain(matched?.id);
  });

  it('matches thai keyword ข้าวมันไก่ to food category', () => {
    const matched = matchCategory(defaultCategories, { note: 'ข้าวมันไก่ตอนเที่ยง' });
    expect(matched?.id).toBe('food');
  });

  it('matches bts / transport keywords to transport category', () => {
    const matched = matchCategory(defaultCategories, { note: 'นั่ง bts ไปสยาม' });
    expect(matched?.id).toBe('transport');
  });

  it('matches salary keyword to income category', () => {
    const matched = matchCategory(defaultCategories, {
      note: 'เงินเดือนเข้า',
      type: 'income',
    });
    expect(matched?.id).toBe('salary');
  });
});
