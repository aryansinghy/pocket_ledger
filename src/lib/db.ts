import Dexie, { type Table } from "dexie";
import { defaultCategories } from "./defaults";
import type { Category, Expense, Meta } from "./types";

class PocketLedgerDatabase extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("pocketLedger");
    this.version(1).stores({
      expenses: "id, date, categoryId, paymentSource, createdAt",
      categories: "id, name, archived",
      meta: "key",
    });
  }
}

export const db = new PocketLedgerDatabase();

export async function seedDefaults() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkPut(defaultCategories);
  }
}

export async function replaceAllData(categories: Category[], expenses: Expense[]) {
  await db.transaction("rw", db.categories, db.expenses, db.meta, async () => {
    await db.categories.clear();
    await db.expenses.clear();
    await db.categories.bulkPut(categories);
    await db.expenses.bulkPut(expenses);
    await db.meta.put({ key: "importedAt", value: new Date().toISOString() });
  });
}

export async function clearAllData() {
  await db.transaction("rw", db.categories, db.expenses, db.meta, async () => {
    await db.expenses.clear();
    await db.categories.clear();
    await db.meta.clear();
    await db.categories.bulkPut(defaultCategories);
  });
}
