import type { Category, TransactionType } from '../types';

interface KeywordRule {
  keywords: string[];
  categoryNames: string[];
  type?: TransactionType;
}

const DEFAULT_KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: [
      'อาหาร', 'ข้าว', 'food', 'lunch', 'dinner', 'breakfast', 'ก๋วยเตี๋ยว', 'ชาบู',
      'หมูกระทะ', 'ส้มตำ', 'mk', 'kfc', 'mcdonald', 'บุฟเฟ่ต์', 'กินข้าว', 'มื้อเย็น',
      'มื้อเที่ยง', 'มื้อเช้า', 'กับข้าว', 'จานด่วน', 'ตามสั่ง', 'ข้าวมันไก่',
    ],
    categoryNames: ['ค่าอาหาร', 'อาหาร', 'อาหารและเครื่องดื่ม', 'food', 'meal'],
    type: 'expense',
  },
  {
    keywords: [
      'กาแฟ', 'ชา', 'coffee', 'cafe', 'amazon', 'starbucks', 'ชาเขียว', 'ชานม',
      'นม', 'น้ำดื่ม', 'น้ำหวาน', 'drink', 'beverage', 'latte', 'espresso', 'คาปูชิโน่',
    ],
    categoryNames: ['กาแฟ', 'เครื่องดื่ม', 'ค่าอาหาร', 'อาหาร', 'เซเว่น', 'food', 'coffee', 'drink'],
    type: 'expense',
  },
  {
    keywords: [
      'ขนม', 'snack', 'dessert', 'เบเกอรี่', 'เค้ก', 'ไอติม', 'ไอศกรีม', 'ice cream',
      'โดนัท', 'โรตี', 'ของหวาน',
    ],
    categoryNames: ['ขนม', 'snack', 'ของหวาน', 'ค่าอาหาร', 'เซเว่น', 'food'],
    type: 'expense',
  },
  {
    keywords: ['เซเว่น', '7-11', '711', 'seven', 'lawson', 'cj', 'ร้านสะดวกซื้อ'],
    categoryNames: ['เซเว่น', 'seven', 'ของใช้', 'ค่าอาหาร', 'ขนม'],
    type: 'expense',
  },
  {
    keywords: [
      'เดินทาง', 'transport', 'bts', 'mrt', 'grab', 'bolt', 'น้ำมัน', 'ค่ารถ',
      'วิน', 'แท็กซี่', 'taxi', 'ทางด่วน', 'รถเมล์', 'เติมน้ำมัน', 'ค่าทางด่วน',
      'รถไฟฟ้า', 'ตั๋ว', 'travel',
    ],
    categoryNames: ['เดินทาง', 'ค่าเดินทาง', 'transport', 'travel', 'รถ'],
    type: 'expense',
  },
  {
    keywords: [
      'ค่าห้อง', 'rent', 'หอพัก', 'คอนโด', 'ค่าเช่า', 'ค่าน้ำ', 'ค่าไฟ', 'ค่าเน็ต',
      'wifi', 'ค่าส่วนกลาง', 'บ้าน', 'apartment',
    ],
    categoryNames: ['ค่าห้อง', 'ค่าบ้าน', 'rent', 'ที่อยู่อาศัย', 'ของใช้'],
    type: 'expense',
  },
  {
    keywords: [
      'ของใช้', 'household', 'สบู่', 'ยาสีฟัน', 'ผงซักฟอก', 'ทิชชู่', 'supermarket',
      'big c', 'lotus', 'tops', 'ของใช้ส่วนตัว', 'ของใช้ในบ้าน',
    ],
    categoryNames: ['ของใช้', 'ของใช้ส่วนตัว', 'household', 'shopping'],
    type: 'expense',
  },
  {
    keywords: [
      'สุขภาพ', 'health', 'ยา', 'หมอ', 'โรงพยาบาล', 'วิตามิน', 'คลินิก', 'hospital',
      'doctor', 'pharmacy', 'ทันตกรรม', 'ทำฟัน', 'นวด',
    ],
    categoryNames: ['สุขภาพ', 'ค่ารักษา', 'health', 'medical'],
    type: 'expense',
  },
  {
    keywords: ['เงินเดือน', 'salary', 'paycheck', 'รายรับ', 'income', 'เงินออก', 'โบนัส', 'bonus'],
    categoryNames: ['เงินเดือน', 'salary', 'รายได้หลัก'],
    type: 'income',
  },
  {
    keywords: ['รายได้อื่น', 'other income', 'freelance', 'ฟรีแลนซ์', 'ขายของ', 'ปันผล', 'cashback', 'คืนเงิน'],
    categoryNames: ['รายได้อื่น', 'other-income', 'รายรับอื่นๆ', 'เงินเดือน'],
    type: 'income',
  },
  {
    keywords: ['เงินออม', 'savings', 'ออมเงิน', 'ฝากเงิน', 'invest', 'ลงทุน', 'หุ้น', 'กองทุน', 'crypto', 'ทอง'],
    categoryNames: ['เงินออม', 'savings', 'ลงทุน'],
    type: 'savings',
  },
];

export function matchCategory(
  categories: Category[],
  input: {
    note?: string;
    categoryName?: string;
    type?: TransactionType;
  },
): Category | undefined {
  const activeCategories = categories.filter((c) => c.isActive);
  if (activeCategories.length === 0) return undefined;

  const targetType = input.type ?? 'expense';
  const matchingTypeCategories = activeCategories.filter(
    (c) => c.type === targetType || c.type === 'both',
  );
  const pool = matchingTypeCategories.length > 0 ? matchingTypeCategories : activeCategories;

  // 1. Explicit Category Name match
  if (input.categoryName) {
    const rawCategory = input.categoryName.trim().toLowerCase();
    const exact = pool.find(
      (c) => c.name.toLowerCase() === rawCategory || c.id.toLowerCase() === rawCategory,
    );
    if (exact) return exact;

    const partial = pool.find(
      (c) =>
        c.name.toLowerCase().includes(rawCategory) ||
        rawCategory.includes(c.name.toLowerCase()) ||
        c.id.toLowerCase().includes(rawCategory),
    );
    if (partial) return partial;
  }

  // 2. Note Keyword match
  const note = (input.note ?? '').trim().toLowerCase();
  if (note) {
    // Exact match note against category names
    const directMatch = pool.find(
      (c) =>
        note.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(note),
    );
    if (directMatch) return directMatch;

    // Check predefined keyword dictionary
    for (const rule of DEFAULT_KEYWORD_RULES) {
      if (rule.type && rule.type !== targetType) continue;

      const hasKeyword = rule.keywords.some((kw) => note.includes(kw.toLowerCase()));
      if (hasKeyword) {
        const found = pool.find((c) =>
          rule.categoryNames.some(
            (targetName) =>
              c.name.toLowerCase().includes(targetName.toLowerCase()) ||
              c.id.toLowerCase() === targetName.toLowerCase(),
          ),
        );
        if (found) return found;
      }
    }
  }

  // 3. Fallback to appropriate category for type
  const fallback =
    pool.find((c) => c.name.includes('อื่น') || c.name.toLowerCase().includes('other')) ??
    pool[0];

  return fallback;
}
