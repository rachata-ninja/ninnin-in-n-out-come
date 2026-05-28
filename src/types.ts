export type TransactionType = "income" | "expense";
export type CategoryType = TransactionType | "both";
export type PeriodType = "month" | "year";

export type Transaction = {
  id: string;
  type: TransactionType;
  categoryId: string;
  amount: number;
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  monthlyBudget?: number;
  isActive: boolean;
};

export type AppSettings = {
  currency: "THB";
  dateLocale: "th-TH";
  schemaVersion: 1;
};

export type AppData = {
  transactions: Transaction[];
  categories: Category[];
  settings: AppSettings;
};

export type PeriodFilter = {
  type: PeriodType;
  year: number;
  month: number;
};

export type TransactionInput = {
  type: TransactionType;
  categoryId: string;
  amount: number;
  date: string;
  note: string;
};
