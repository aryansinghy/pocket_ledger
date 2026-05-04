import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Download,
  Gift,
  Heart,
  Home,
  MessageSquareText,
  MoreHorizontal,
  Plane,
  Plus,
  Phone,
  Receipt,
  Repeat2,
  Settings,
  ShoppingBag,
  Sparkles,
  Trash2,
  Train,
  Upload,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryBreakdown, dailyTrend, getMonthExpenses, groupByDate, topCategory, total } from "./lib/analytics";
import { colorSwatches, iconChoices } from "./lib/defaults";
import { clearAllData, db, replaceAllData, seedDefaults } from "./lib/db";
import { createBackup, downloadFile, parseBackup, toCsv } from "./lib/export";
import { compactRupee, formatDisplayDate, formatLongDate, monthBounds, monthKey, rupee, todayISO } from "./lib/format";
import type { Category, Expense, PaymentSource, TabId } from "./lib/types";

const iconMap: Record<string, LucideIcon> = {
  Utensils,
  Coffee,
  ShoppingBag,
  Plane,
  Train,
  Car,
  Repeat2,
  Receipt,
  Home,
  Phone,
  Gift,
  Heart,
  BookOpen,
  Wallet,
  BriefcaseBusiness,
  Sparkles,
  MoreHorizontal,
};

const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "add", label: "Add", icon: Plus },
  { id: "month", label: "Month", icon: BarChart3 },
  { id: "history", label: "History", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
];

type ExpenseDraft = {
  amount: string;
  paymentSource: PaymentSource | "";
  categoryId: string;
  date: string;
  note: string;
};

type CategoryDraft = {
  id?: string;
  name: string;
  icon: string;
  color: string;
};

const emptyExpenseDraft = (): ExpenseDraft => ({
  amount: "",
  paymentSource: "",
  categoryId: "",
  date: todayISO(),
  note: "",
});

const newCategoryDraft = (): CategoryDraft => ({
  name: "",
  icon: "Sparkles",
  color: "#14b8a6",
});

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("add");
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [historyPayment, setHistoryPayment] = useState<PaymentSource | "All">("All");
  const [historyCategory, setHistoryCategory] = useState("All");
  const [expenseDraft, setExpenseDraft] = useState(emptyExpenseDraft);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingNote, setViewingNote] = useState<{ title: string; note: string } | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [toast, setToast] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void seedDefaults();
  }, []);

  const liveExpenses = useLiveQuery(() => db.expenses.toArray(), []);
  const liveCategories = useLiveQuery(() => db.categories.toArray(), []);
  const liveMeta = useLiveQuery(() => db.meta.toArray(), []);
  const expenses = useMemo(() => liveExpenses || [], [liveExpenses]);
  const categories = useMemo(() => liveCategories || [], [liveCategories]);
  const meta = useMemo(() => liveMeta || [], [liveMeta]);
  const activeCategories = categories.filter((category) => !category.archived);

  const monthExpenses = useMemo(() => getMonthExpenses(expenses, selectedMonth), [expenses, selectedMonth]);
  const selectedMonthInfo = monthBounds(selectedMonth);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const handleAddExpense = async () => {
    const amount = Number(expenseDraft.amount);
    if (!isValidExpenseDraft(expenseDraft)) return;

    const now = new Date().toISOString();
    await db.expenses.add({
      id: crypto.randomUUID(),
      amount,
      paymentSource: expenseDraft.paymentSource as PaymentSource,
      categoryId: expenseDraft.categoryId,
      date: expenseDraft.date,
      note: cleanNote(expenseDraft.note),
      createdAt: now,
      updatedAt: now,
    });

    setExpenseDraft(emptyExpenseDraft());
    showToast("Expense added");
  };

  const handleSaveExpense = async (draft: ExpenseDraft) => {
    if (!editingExpense || !isValidExpenseDraft(draft)) return;
    await db.expenses.update(editingExpense.id, {
      amount: Number(draft.amount),
      paymentSource: draft.paymentSource as PaymentSource,
      categoryId: draft.categoryId,
      date: draft.date,
      note: cleanNote(draft.note),
      updatedAt: new Date().toISOString(),
    });
    setEditingExpense(null);
    showToast("Expense updated");
  };

  const handleDeleteExpense = async () => {
    if (!editingExpense) return;
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    await db.expenses.delete(editingExpense.id);
    setEditingExpense(null);
    showToast("Expense deleted");
  };

  const handleSaveCategory = async () => {
    if (!categoryDraft || !categoryDraft.name.trim()) return;
    const now = new Date().toISOString();

    if (categoryDraft.id) {
      await db.categories.update(categoryDraft.id, {
        name: categoryDraft.name.trim(),
        icon: categoryDraft.icon,
        color: categoryDraft.color,
        updatedAt: now,
      });
      showToast("Category updated");
    } else {
      await db.categories.add({
        id: crypto.randomUUID(),
        name: categoryDraft.name.trim(),
        icon: categoryDraft.icon,
        color: categoryDraft.color,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });
      showToast("Category added");
    }

    setCategoryDraft(null);
  };

  const handleArchiveOrDeleteCategory = async (category: Category) => {
    const usage = expenses.filter((expense) => expense.categoryId === category.id).length;
    if (usage === 0) {
      if (!window.confirm(`Delete ${category.name}?`)) return;
      await db.categories.delete(category.id);
      showToast("Category deleted");
      return;
    }

    await db.categories.update(category.id, { archived: true, updatedAt: new Date().toISOString() });
    if (expenseDraft.categoryId === category.id) {
      setExpenseDraft((draft) => ({ ...draft, categoryId: "" }));
    }
    showToast("Category archived");
  };

  const handleRestoreCategory = async (category: Category) => {
    await db.categories.update(category.id, { archived: false, updatedAt: new Date().toISOString() });
    showToast("Category restored");
  };

  const exportBackup = async () => {
    const payload = createBackup(categories, expenses, meta);
    downloadFile(
      `pocket-ledger-backup-${todayISO()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    await db.meta.put({ key: "lastBackupAt", value: payload.exportedAt });
    showToast("Backup exported");
  };

  const exportCsv = () => {
    downloadFile(`pocket-ledger-expenses-${todayISO()}.csv`, toCsv(expenses, categories), "text/csv");
    showToast("CSV exported");
  };

  const importBackup = async (file: File) => {
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      if (!window.confirm("Importing this backup will replace all current Pocket Ledger data. Continue?")) return;
      await replaceAllData(parsed.categories, parsed.expenses);
      showToast("Backup imported");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Backup import failed");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const resetAllData = async () => {
    const confirmation = window.prompt('Type "DELETE" to clear all expenses and reset categories.');
    if (confirmation !== "DELETE") return;
    await clearAllData();
    setExpenseDraft(emptyExpenseDraft());
    showToast("Data cleared");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-ink-950 text-slate-50">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 mx-auto h-48 max-w-[480px] bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.18),transparent_68%)]" />

      <section className="relative z-10 flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
        <AppHeader activeTab={activeTab} selectedMonth={selectedMonthInfo.label} />

        <AnimatePresence mode="wait">
          {activeTab === "add" && (
            <Screen key="add">
              <AddTab
                categories={activeCategories}
                draft={expenseDraft}
                setDraft={setExpenseDraft}
                onSave={handleAddExpense}
              />
            </Screen>
          )}

          {activeTab === "month" && (
            <Screen key="month">
              <MonthTab
                categories={categories}
                expenses={monthExpenses}
                month={selectedMonth}
                monthInfo={selectedMonthInfo}
                onMonthChange={setSelectedMonth}
                onEdit={setEditingExpense}
                onShowNote={setViewingNote}
              />
            </Screen>
          )}

          {activeTab === "history" && (
            <Screen key="history">
              <HistoryTab
                categories={categories}
                expenses={monthExpenses}
                month={selectedMonth}
                monthInfo={selectedMonthInfo}
                payment={historyPayment}
                categoryId={historyCategory}
                onMonthChange={setSelectedMonth}
                onPaymentChange={setHistoryPayment}
                onCategoryChange={setHistoryCategory}
                onEdit={setEditingExpense}
                onShowNote={setViewingNote}
              />
            </Screen>
          )}

          {activeTab === "settings" && (
            <Screen key="settings">
              <SettingsTab
                categories={categories}
                expenses={expenses}
                meta={meta}
                onAddCategory={() => setCategoryDraft(newCategoryDraft())}
                onEditCategory={(category) =>
                  setCategoryDraft({
                    id: category.id,
                    name: category.name,
                    icon: category.icon,
                    color: category.color,
                  })
                }
                onArchiveOrDelete={handleArchiveOrDeleteCategory}
                onRestore={handleRestoreCategory}
                onExportBackup={exportBackup}
                onExportCsv={exportCsv}
                onImport={() => importInputRef.current?.click()}
                onClearAll={resetAllData}
              />
            </Screen>
          )}
        </AnimatePresence>
      </section>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept="application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importBackup(file);
        }}
      />

      <AnimatePresence>{toast && <Toast message={toast} />}</AnimatePresence>

      <AnimatePresence>
        {editingExpense && (
          <EditExpenseSheet
            key={editingExpense.id}
            expense={editingExpense}
            categories={categories}
            onClose={() => setEditingExpense(null)}
            onSave={handleSaveExpense}
            onDelete={handleDeleteExpense}
          />
        )}
        {viewingNote && (
          <NoteSheet
            key="note"
            title={viewingNote.title}
            note={viewingNote.note}
            onClose={() => setViewingNote(null)}
          />
        )}
        {categoryDraft && (
          <CategorySheet
            draft={categoryDraft}
            setDraft={setCategoryDraft}
            onClose={() => setCategoryDraft(null)}
            onSave={handleSaveCategory}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function AppHeader({ activeTab, selectedMonth }: { activeTab: TabId; selectedMonth: string }) {
  const title = activeTab === "add" ? "Add Expense" : activeTab === "month" ? selectedMonth : activeTab === "history" ? "History" : "Settings";
  return (
    <header className="mb-6 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Pocket Ledger</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-none text-slate-50">{title}</h1>
      </div>
      <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300">
        INR
      </div>
    </header>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function AddTab({
  categories,
  draft,
  setDraft,
  onSave,
}: {
  categories: Category[];
  draft: ExpenseDraft;
  setDraft: React.Dispatch<React.SetStateAction<ExpenseDraft>>;
  onSave: () => void;
}) {
  const isValid = isValidExpenseDraft(draft);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-ink-850 p-5 shadow-glow">
        <label className="block">
          <span className="text-sm font-medium text-slate-400">Amount</span>
          <div className="mt-2 flex items-end gap-2">
            <span className="pb-3 text-3xl font-semibold text-slate-500">₹</span>
            <input
              className="w-full bg-transparent text-[4.4rem] font-semibold leading-none text-slate-50 outline-none placeholder:text-slate-700"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={draft.amount}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "");
                setDraft((current) => ({ ...current, amount: value }));
              }}
            />
          </div>
        </label>
      </section>

      <section className="space-y-3">
        <FieldLabel>Paid With</FieldLabel>
        <div className="grid grid-cols-2 gap-3">
          {(["Me", "Dad"] as PaymentSource[]).map((source) => (
            <ChoiceButton
              key={source}
              selected={draft.paymentSource === source}
              onClick={() => setDraft((current) => ({ ...current, paymentSource: source }))}
            >
              <Wallet className="h-5 w-5" />
              {source}
            </ChoiceButton>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <FieldLabel>Category</FieldLabel>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => (
            <CategoryButton
              key={category.id}
              category={category}
              selected={draft.categoryId === category.id}
              onClick={() => setDraft((current) => ({ ...current, categoryId: category.id }))}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="block">
          <FieldLabel>Date</FieldLabel>
          <input
            className="mt-3 h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-base font-semibold text-slate-100 outline-none focus:border-accent"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
          />
        </label>
        <button className="h-14 rounded-2xl border border-white/10 px-4 text-sm font-semibold text-slate-300" onClick={() => setDraft((current) => ({ ...current, date: todayISO() }))}>
          Today
        </button>
      </section>

      <label className="block">
        <FieldLabel>Note</FieldLabel>
        <input
          className="input-control mt-3"
          value={draft.note}
          maxLength={120}
          onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
        />
      </label>

      <motion.button
        whileTap={isValid ? { scale: 0.98 } : undefined}
        className="h-[60px] w-full rounded-[22px] bg-accent px-5 py-4 text-base font-bold text-ink-950 shadow-lift transition disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
        disabled={!isValid}
        onClick={onSave}
      >
        Save Expense
      </motion.button>
    </div>
  );
}

function MonthTab({
  categories,
  expenses,
  month,
  monthInfo,
  onMonthChange,
  onEdit,
  onShowNote,
}: {
  categories: Category[];
  expenses: Expense[];
  month: string;
  monthInfo: ReturnType<typeof monthBounds>;
  onMonthChange: (month: string) => void;
  onEdit: (expense: Expense) => void;
  onShowNote: (note: { title: string; note: string }) => void;
}) {
  const spent = total(expenses);
  const meTotal = total(expenses.filter((expense) => expense.paymentSource === "Me"));
  const dadTotal = total(expenses.filter((expense) => expense.paymentSource === "Dad"));
  const top = topCategory(expenses, categories);
  const breakdown = categoryBreakdown(expenses, categories);
  const trend = dailyTrend(expenses, month, monthInfo.days);
  const average = Math.round(spent / monthInfo.days);

  return (
    <div className="space-y-5">
      <MonthSwitcher month={month} onChange={onMonthChange} />

      <section className="rounded-[30px] border border-white/10 bg-ink-850 p-5 shadow-glow">
        <p className="text-sm font-medium text-slate-400">Total spent</p>
        <p className="mt-2 text-5xl font-semibold tracking-tight">{rupee.format(spent)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Me card" value={rupee.format(meTotal)} />
          <Stat label="Dad card" value={rupee.format(dadTotal)} />
          <Stat label="Daily avg" value={rupee.format(average)} />
          <Stat label="Top category" value={top?.category?.name || "None"} />
        </div>
      </section>

      <Card title="Daily Trend">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="trend" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.12)" }}
                contentStyle={{
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 16,
                  color: "#f8fafc",
                }}
                formatter={(value) => rupee.format(Number(value))}
                labelFormatter={(day) => `Day ${day}`}
              />
              <Area type="monotone" dataKey="amount" stroke="#14b8a6" strokeWidth={3} fill="url(#trend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Category Breakdown">
        <div className="space-y-4">
          {breakdown.length ? (
            breakdown.map((item) => <BreakdownRow key={item.category.id} {...item} total={spent} />)
          ) : (
            <EmptyState>No spending yet this month.</EmptyState>
          )}
        </div>
      </Card>

      <Card title="Recent Expenses">
        <ExpenseList
          expenses={expenses.slice(0, 6)}
          categories={categories}
          onEdit={onEdit}
          onShowNote={onShowNote}
          empty="No recent expenses."
        />
      </Card>
    </div>
  );
}

function HistoryTab({
  categories,
  expenses,
  month,
  monthInfo,
  payment,
  categoryId,
  onMonthChange,
  onPaymentChange,
  onCategoryChange,
  onEdit,
  onShowNote,
}: {
  categories: Category[];
  expenses: Expense[];
  month: string;
  monthInfo: ReturnType<typeof monthBounds>;
  payment: PaymentSource | "All";
  categoryId: string;
  onMonthChange: (month: string) => void;
  onPaymentChange: (payment: PaymentSource | "All") => void;
  onCategoryChange: (categoryId: string) => void;
  onEdit: (expense: Expense) => void;
  onShowNote: (note: { title: string; note: string }) => void;
}) {
  const filtered = expenses.filter((expense) => {
    const paymentMatches = payment === "All" || expense.paymentSource === payment;
    const categoryMatches = categoryId === "All" || expense.categoryId === categoryId;
    return paymentMatches && categoryMatches;
  });
  const grouped = groupByDate(filtered);

  return (
    <div className="space-y-5">
      <MonthSwitcher month={month} onChange={onMonthChange} />
      <div className="grid grid-cols-2 gap-3">
        <select className="select-control" value={payment} onChange={(event) => onPaymentChange(event.target.value as PaymentSource | "All")}>
          <option>All</option>
          <option>Me</option>
          <option>Dad</option>
        </select>
        <select className="select-control" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="All">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <Card title={`${filtered.length} in ${monthInfo.label}`}>
        {Object.keys(grouped).length ? (
          <div className="space-y-5">
            {Object.entries(grouped).map(([date, dateExpenses]) => (
              <div key={date}>
                <p className="mb-2 text-sm font-semibold text-slate-400">{formatLongDate(date)}</p>
                <ExpenseList expenses={dateExpenses} categories={categories} onEdit={onEdit} onShowNote={onShowNote} empty="" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No expenses match these filters.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function SettingsTab({
  categories,
  expenses,
  meta,
  onAddCategory,
  onEditCategory,
  onArchiveOrDelete,
  onRestore,
  onExportBackup,
  onExportCsv,
  onImport,
  onClearAll,
}: {
  categories: Category[];
  expenses: Expense[];
  meta: Array<{ key: string; value: unknown }>;
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onArchiveOrDelete: (category: Category) => void;
  onRestore: (category: Category) => void;
  onExportBackup: () => void;
  onExportCsv: () => void;
  onImport: () => void;
  onClearAll: () => void;
}) {
  const lastBackup = meta.find((item) => item.key === "lastBackupAt")?.value;

  return (
    <div className="space-y-5">
      <Card
        title="Categories"
        action={
          <button className="icon-action" onClick={onAddCategory} aria-label="Add category">
            <Plus className="h-5 w-5" />
          </button>
        }
      >
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <CategoryIcon category={category} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{category.name}</p>
                <p className="text-sm text-slate-500">{category.archived ? "Archived" : "Active"}</p>
              </div>
              <button className="text-sm font-semibold text-slate-300" onClick={() => onEditCategory(category)}>
                Edit
              </button>
              {category.archived ? (
                <button className="text-sm font-semibold text-accent" onClick={() => onRestore(category)}>
                  Restore
                </button>
              ) : (
                <button className="text-sm font-semibold text-rose-400" onClick={() => onArchiveOrDelete(category)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Data">
        <div className="space-y-3">
          <SettingsButton icon={Download} label="Export JSON backup" detail={formatMetaDate(lastBackup)} onClick={onExportBackup} />
          <SettingsButton icon={Upload} label="Import JSON backup" detail="Replaces current data" onClick={onImport} />
          <SettingsButton icon={Download} label="Export CSV" detail={`${expenses.length} expenses`} onClick={onExportCsv} />
          <SettingsButton icon={Trash2} label="Clear all data" detail="Requires confirmation" danger onClick={onClearAll} />
        </div>
      </Card>
    </div>
  );
}

function EditExpenseSheet({
  expense,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  expense: Expense;
  categories: Category[];
  onClose: () => void;
  onSave: (draft: ExpenseDraft) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<ExpenseDraft>({
    amount: String(expense.amount),
    paymentSource: expense.paymentSource,
    categoryId: expense.categoryId,
    date: expense.date,
    note: expense.note || "",
  });
  const availableCategories = categories.filter((category) => !category.archived || category.id === expense.categoryId);

  return (
    <BottomSheet title="Edit Expense" onClose={onClose}>
      <div className="space-y-4">
        <input
          className="input-control text-2xl font-semibold"
          inputMode="numeric"
          value={draft.amount}
          onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value.replace(/\D/g, "") }))}
        />
        <div className="grid grid-cols-2 gap-3">
          {(["Me", "Dad"] as PaymentSource[]).map((source) => (
            <ChoiceButton key={source} selected={draft.paymentSource === source} onClick={() => setDraft((current) => ({ ...current, paymentSource: source }))}>
              <Wallet className="h-5 w-5" />
              {source}
            </ChoiceButton>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {availableCategories.map((category) => (
            <CategoryButton key={category.id} category={category} selected={draft.categoryId === category.id} onClick={() => setDraft((current) => ({ ...current, categoryId: category.id }))} />
          ))}
        </div>
        <input className="input-control" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
        <label className="block">
          <FieldLabel>Note</FieldLabel>
          <input
            className="input-control mt-3"
            value={draft.note}
            maxLength={120}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
          />
        </label>
        <button className="primary-action" disabled={!isValidExpenseDraft(draft)} onClick={() => onSave(draft)}>
          Save Changes
        </button>
        <button className="danger-action" onClick={onDelete}>
          Delete Expense
        </button>
      </div>
    </BottomSheet>
  );
}

function NoteSheet({ title, note, onClose }: { title: string; note: string; onClose: () => void }) {
  return (
    <BottomSheet title="Note" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        </div>
        <p className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.04] p-4 leading-relaxed text-slate-200">
          {note}
        </p>
      </div>
    </BottomSheet>
  );
}

function CategorySheet({
  draft,
  setDraft,
  onClose,
  onSave,
}: {
  draft: CategoryDraft;
  setDraft: React.Dispatch<React.SetStateAction<CategoryDraft | null>>;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <BottomSheet title={draft.id ? "Edit Category" : "Add Category"} onClose={onClose}>
      <div className="space-y-5">
        <input
          className="input-control"
          placeholder="Category name"
          value={draft.name}
          onChange={(event) => setDraft((current) => current && { ...current, name: event.target.value })}
        />
        <div>
          <FieldLabel>Icon</FieldLabel>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {iconChoices.map((icon) => {
              const Icon = iconMap[icon] || Sparkles;
              return (
                <button
                  key={icon}
                  className={`grid aspect-square place-items-center rounded-2xl border ${draft.icon === icon ? "border-accent bg-accent/15 text-accent" : "border-white/10 bg-white/[0.03] text-slate-400"}`}
                  onClick={() => setDraft((current) => current && { ...current, icon })}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <FieldLabel>Color</FieldLabel>
          <div className="mt-3 grid grid-cols-9 gap-2">
            {colorSwatches.map((swatch) => (
              <button
                key={swatch.value}
                className="grid aspect-square place-items-center rounded-full border border-white/10"
                style={{ backgroundColor: swatch.value }}
                aria-label={swatch.name}
                onClick={() => setDraft((current) => current && { ...current, color: swatch.value })}
              >
                {draft.color === swatch.value && <Check className="h-4 w-4 text-ink-950" />}
              </button>
            ))}
          </div>
        </div>
        <button className="primary-action" disabled={!draft.name.trim()} onClick={onSave}>
          Save Category
        </button>
      </div>
    </BottomSheet>
  );
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 mx-auto max-w-[480px] bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="absolute inset-0 h-full w-full" aria-label="Close sheet" onClick={onClose} />
      <motion.section
        className="absolute inset-x-0 bottom-0 rounded-t-[32px] border border-white/10 bg-ink-900 p-4 pb-[calc(22px+env(safe-area-inset-bottom))] shadow-glow"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 360 }}
      >
        <div className="relative">
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/15" />
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-slate-300" onClick={onClose}>
              Close
            </button>
          </div>
          {children}
        </div>
      </motion.section>
    </motion.div>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-white/10 bg-ink-900/92 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      <div className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button key={tab.id} className={`relative flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition ${selected ? "text-accent" : "text-slate-500"}`} onClick={() => onChange(tab.id)}>
              {selected && <motion.span layoutId="active-tab" className="absolute inset-1 rounded-2xl bg-accent/10" />}
              <Icon className="relative h-5 w-5" />
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ExpenseList({
  expenses,
  categories,
  onEdit,
  onShowNote,
  empty,
}: {
  expenses: Expense[];
  categories: Category[];
  onEdit: (expense: Expense) => void;
  onShowNote: (note: { title: string; note: string }) => void;
  empty: string;
}) {
  if (!expenses.length) return empty ? <EmptyState>{empty}</EmptyState> : null;
  return (
    <div className="space-y-3">
      {expenses.map((expense) => {
        const category = categories.find((item) => item.id === expense.categoryId);
        const title = category?.name || "Unknown";
        return (
          <motion.article
            key={expense.id}
            layout
            whileTap={{ scale: 0.985 }}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-left"
          >
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onEdit(expense)}>
              {category ? <CategoryIcon category={category} /> : <div className="h-11 w-11 rounded-2xl bg-slate-700" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{title}</span>
                <span className="block text-sm text-slate-500">
                  {formatDisplayDate(expense.date)} · {expense.paymentSource} card
                </span>
              </span>
            </button>
            {expense.note && (
              <button
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400"
                aria-label="View note"
                onClick={() => onShowNote({ title, note: expense.note || "" })}
              >
                <MessageSquareText className="h-4 w-4" />
              </button>
            )}
            <p className="shrink-0 font-semibold">{rupee.format(expense.amount)}</p>
          </motion.article>
        );
      })}
    </div>
  );
}

function CategoryButton({ category, selected, onClick }: { category: Category; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.04]"}`}
      onClick={onClick}
    >
      <CategoryIcon category={category} />
      <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{category.name}</span>
    </motion.button>
  );
}

function CategoryIcon({ category }: { category: Category }) {
  const Icon = iconMap[category.icon] || Sparkles;
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${category.color}22`, color: category.color }}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`flex h-14 items-center justify-center gap-2 rounded-2xl border text-base font-semibold transition ${selected ? "border-accent bg-accent/10 text-accent" : "border-white/10 bg-white/[0.04] text-slate-300"}`}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const shift = (amount: number) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(year, monthNumber - 1 + amount, 1);
    onChange(monthKey(next));
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-2">
      <button className="icon-action" onClick={() => shift(-1)} aria-label="Previous month">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <p className="font-semibold text-slate-200">{monthBounds(month).label}</p>
      <button className="icon-action" onClick={() => shift(1)} aria-label="Next month">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-ink-850 p-4 shadow-glow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-20 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 overflow-hidden text-ellipsis text-lg font-semibold leading-tight text-slate-100">{value}</p>
    </div>
  );
}

function BreakdownRow({ category, amount, percentage }: ReturnType<typeof categoryBreakdown>[number] & { total: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <CategoryIcon category={category} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{category.name}</p>
          <p className="text-sm text-slate-500">{percentage}% of month</p>
        </div>
        <p className="font-semibold">{compactRupee.format(amount)}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: category.color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function SettingsButton({ icon: Icon, label, detail, danger, onClick }: { icon: LucideIcon; label: string; detail: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left" onClick={onClick}>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${danger ? "bg-rose-500/10 text-rose-400" : "bg-accent/10 text-accent"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-slate-400">{children}</p>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">{children}</p>;
}

function Toast({ message }: { message: string }) {
  return (
    <motion.div
      className="fixed inset-x-0 bottom-[calc(94px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[480px] justify-center px-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-100 px-4 py-3 text-sm font-semibold text-ink-950 shadow-lift">
        <motion.span
          className="grid h-5 w-5 place-items-center rounded-full bg-accent text-ink-950 shadow-[0_0_18px_rgba(20,184,166,0.55)]"
          initial={{ scale: 0.4, rotate: -18 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 18 }}
        >
          <Check className="h-3.5 w-3.5" />
        </motion.span>
        {message}
      </div>
    </motion.div>
  );
}

function cleanNote(note: string) {
  const trimmed = note.trim();
  return trimmed ? trimmed : undefined;
}

function isValidExpenseDraft(draft: ExpenseDraft) {
  const amount = Number(draft.amount);
  return Number.isInteger(amount) && amount > 0 && Boolean(draft.paymentSource) && Boolean(draft.categoryId) && Boolean(draft.date);
}

function formatMetaDate(value: unknown) {
  if (typeof value !== "string") return "Last backup: never";
  return `Last backup: ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value))}`;
}
