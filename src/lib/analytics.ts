import type { Category, Expense } from "./types";

export function getMonthExpenses(expenses: Expense[], month: string) {
  const start = `${month}-01`;
  const end = `${month}-31`;
  return expenses
    .filter((expense) => expense.date >= start && expense.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function total(expenses: Expense[]) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function topCategory(expenses: Expense[], categories: Category[]) {
  const totals = new Map<string, number>();
  expenses.forEach((expense) => totals.set(expense.categoryId, (totals.get(expense.categoryId) || 0) + expense.amount));
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  return {
    category: categories.find((category) => category.id === top[0]),
    amount: top[1],
  };
}

export function categoryBreakdown(expenses: Expense[], categories: Category[]) {
  const grandTotal = total(expenses);
  return categories
    .map((category) => {
      const amount = total(expenses.filter((expense) => expense.categoryId === category.id));
      return {
        category,
        amount,
        percentage: grandTotal ? Math.round((amount / grandTotal) * 100) : 0,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function dailyTrend(expenses: Expense[], month: string, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const date = `${month}-${day}`;
    return {
      day: index + 1,
      amount: total(expenses.filter((expense) => expense.date === date)),
    };
  });
}

export function groupByDate(expenses: Expense[]) {
  return expenses.reduce<Record<string, Expense[]>>((groups, expense) => {
    groups[expense.date] = groups[expense.date] || [];
    groups[expense.date].push(expense);
    return groups;
  }, {});
}
