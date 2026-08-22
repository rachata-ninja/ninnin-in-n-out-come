import { describe, expect, it } from 'vitest';
import { defaultCategories } from '../data/defaultData';
import { matchCategory } from '../../api/mcp';

describe('categoryMatcher in api/mcp', () => {
  it('matches category by explicit name hint', () => {
    const matched = matchCategory(defaultCategories, '', 'ค่าอาหาร');
    expect(matched?.id).toBe('food');
  });

  it('matches category by english keyword "food"', () => {
    const matched = matchCategory(defaultCategories, 'Paid food for 60 baht');
    expect(matched?.id).toBe('food');
  });

  it('matches coffee / drink keywords to food, seven, or snack', () => {
    const matched = matchCategory(defaultCategories, 'Starbucks iced latte');
    expect(['food', 'seven', 'snack']).toContain(matched?.id);
  });

  it('matches thai keyword ข้าวมันไก่ to food category', () => {
    const matched = matchCategory(defaultCategories, 'ข้าวมันไก่ตอนเที่ยง');
    expect(matched?.id).toBe('food');
  });

  it('matches bts / transport keywords to transport category', () => {
    const matched = matchCategory(defaultCategories, 'นั่ง bts ไปสยาม');
    expect(matched?.id).toBe('transport');
  });

  it('matches salary keyword to income category', () => {
    const matched = matchCategory(defaultCategories, 'เงินเดือนเข้า', undefined, 'income');
    expect(matched?.id).toBe('salary');
  });
});
