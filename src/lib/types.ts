export type PaymentSource = "Me" | "Dad";

export type Expense = {
  id: string;
  amount: number;
  paymentSource: PaymentSource;
  categoryId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Meta = {
  key: string;
  value: unknown;
};

export type TabId = "add" | "month" | "history" | "settings";
