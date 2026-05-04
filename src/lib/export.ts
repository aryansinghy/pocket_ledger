import type { Category, Expense, Meta } from "./types";

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  categories: Category[];
  expenses: Expense[];
  meta: Meta[];
};

export function createBackup(categories: Category[], expenses: Expense[], meta: Meta[]): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    expenses,
    meta,
  };
}

export function parseBackup(value: unknown): BackupPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Backup file is not valid JSON.");
  }

  const payload = value as Partial<BackupPayload>;
  if (payload.version !== 1 || !Array.isArray(payload.categories) || !Array.isArray(payload.expenses)) {
    throw new Error("Backup file does not match Pocket Ledger format.");
  }

  payload.expenses.forEach((expense) => {
    if (
      typeof expense.id !== "string" ||
      typeof expense.amount !== "number" ||
      !["Me", "Dad"].includes(expense.paymentSource) ||
      typeof expense.categoryId !== "string" ||
      typeof expense.date !== "string" ||
      (expense.note !== undefined && typeof expense.note !== "string")
    ) {
      throw new Error("Backup contains an invalid expense.");
    }
  });

  payload.categories.forEach((category) => {
    if (
      typeof category.id !== "string" ||
      typeof category.name !== "string" ||
      typeof category.icon !== "string" ||
      typeof category.color !== "string" ||
      typeof category.archived !== "boolean"
    ) {
      throw new Error("Backup contains an invalid category.");
    }
  });

  return {
    version: 1,
    exportedAt: payload.exportedAt || new Date().toISOString(),
    categories: payload.categories,
    expenses: payload.expenses,
    meta: Array.isArray(payload.meta) ? payload.meta : [],
  };
}

export function downloadFile(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function toCsv(expenses: Expense[], categories: Category[]) {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const rows = [["Date", "Amount", "Paid With", "Category", "Note"]];

  expenses
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((expense) => {
      rows.push([
        expense.date,
        String(expense.amount),
        expense.paymentSource,
        categoryName.get(expense.categoryId) || "Unknown",
        expense.note || "",
      ]);
    });

  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}
