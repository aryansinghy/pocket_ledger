# Pocket Ledger Spec

## Product Intent

Pocket Ledger is a personal, phone-only expense tracker for iPhone home-screen use. It should feel like a polished dark-mode mobile finance app, not a demo or generic form. The app is local-only, free to run, and optimized for quick daily expense entry plus calendar-month spending insight.

## Non-Goals

- No backend.
- No login or accounts.
- No cloud sync.
- No custom domain requirement.
- No budgets.
- No notes, merchants, tags, receipts, OCR, or recurring expenses in v1.
- No light mode in v1.
- No multi-currency support.

## Target Platform

- Primary device: iPhone 17 Pro.
- App type: installable Progressive Web App.
- Browser/runtime: Safari PWA on iOS.
- Layout: mobile-first, safe-area aware, thumb-friendly.
- Hosting: GitHub Pages from a public repository using a static Vite build and GitHub Actions.

## Technology Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Dexie / IndexedDB
- Framer Motion
- Lucide React
- Recharts
- PWA manifest and iOS home-screen metadata

## Visual Direction

- Dark-only.
- Premium, calm, modern, mobile-native feel.
- Near-black app background.
- Charcoal elevated surfaces.
- Soft white primary text.
- Muted gray secondary text.
- Teal primary accent.
- Category colors used as controlled accents.
- No neon/gamer aesthetic.
- No busy gradients or decorative clutter.
- Motion should be subtle, fast, and functional.

## App Identity

- Full name: Pocket Ledger.
- Home-screen short name: Ledger.
- Icon direction: dark rounded square with a minimal ledger/card motif and teal accent.

## Navigation

The app uses bottom tab navigation:

1. Add
2. Month
3. History
4. Settings

Default tab on launch: Add.

## Expense Model

Each expense contains:

```ts
type PaymentSource = "Me" | "Dad";

type Expense = {
  id: string;
  amount: number;
  paymentSource: PaymentSource;
  categoryId: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};
```

Amount rules:

- INR only.
- Whole rupees only.
- Positive integer.
- Minimum amount: 1.

Payment source semantics:

- `Me` means the user paid using their own card.
- `Dad` means the user paid using Dad's card.

## Category Model

Each category contains:

```ts
type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Default categories:

| Name | Icon | Color |
| --- | --- | --- |
| Dining & Drinks | Utensils | Teal |
| Coffee | Coffee | Amber |
| Shopping | Shopping Bag | Rose |
| Travel | Plane | Blue |
| Subscriptions | Repeat | Violet |
| Work | Briefcase | Emerald |
| Misc | Sparkles | Slate |

Category management:

- Add category.
- Edit category name, icon, and color.
- Archive category.
- Restore archived category.
- If a category has no expenses, deleting it may be allowed.
- If a category has expenses, it should be archived rather than hard-deleted.
- Archived categories do not appear in the Add screen.
- Archived categories still appear in historical expenses and analytics.

Icon selection:

- Use a curated icon picker, not arbitrary icon name entry.
- Include at least: Utensils, Coffee, Shopping Bag, Plane, Train, Car, Repeat, Receipt, Home, Phone, Gift, Heart, Book, Wallet, Briefcase, Sparkles, More.

Color selection:

- Use curated dark-mode-friendly color swatches.
- Include at least: Teal, Blue, Rose, Violet, Amber, Emerald, Cyan, Orange, Slate.

## Add Tab

Purpose: fastest possible intentional expense entry.

Fields:

- Amount
- Paid With: Me / Dad
- Category
- Date

Defaults:

- Amount: empty.
- Paid With: no selection.
- Category: no selection.
- Date: today.

Validation:

- Save is disabled until amount, paid with, category, and date are valid.
- Amount must be a positive whole rupee amount.

After successful save:

- Create expense.
- Clear amount.
- Clear paid-with selection.
- Clear category selection.
- Reset date to today.
- Stay on Add tab.
- Show subtle success feedback.

## Month Tab

Purpose: calendar-month insight.

Scope:

- Uses the calendar month only: 1st through last day of selected/current month.

Required content:

- Current month header.
- Total spent.
- Me card total.
- Dad card total.
- Average per day.
- Top category.
- Daily spending trend chart.
- Category breakdown.
- Recent expenses.

Interactions:

- Tap an expense to open edit bottom sheet.

## History Tab

Purpose: browse, filter, edit, and delete past expenses.

Filters:

- Month selector.
- Paid With: All / Me / Dad.
- Category: All / category.

List:

- Group expenses by date.
- Each row shows category icon/color, category name, payment source, date context, and amount.

Interactions:

- Tap an expense to open edit bottom sheet.

## Edit Expense

Entry points:

- Month recent expenses.
- History expense list.

Presentation:

- Bottom sheet/modal optimized for phone use.

Fields:

- Amount
- Paid With: Me / Dad
- Category
- Date

Actions:

- Save Changes
- Delete Expense
- Cancel/close

Behavior:

- Save updates `updatedAt`.
- Delete requires confirmation.
- Cancel closes without changes.

## Settings Tab

Required sections:

- Manage categories.
- Export JSON backup.
- Import JSON backup.
- Export CSV.
- Last backup date.
- Clear all data.

Clear all data:

- Requires strong confirmation.
- Should be difficult to trigger accidentally.

## Backup and Export

JSON backup:

- Used for restoring app data.
- Includes version, exportedAt, categories, expenses, and relevant meta.
- Import validates shape.
- Import replaces current local data after confirmation.

CSV export:

- Used for spreadsheet viewing.
- Required columns: Date, Amount, Paid With, Category.

Last backup:

- Store and display last successful JSON backup timestamp.

## Storage

Use IndexedDB through Dexie.

Database name:

```txt
pocketLedger
```

Tables:

- expenses
- categories
- meta

Recommended indexes:

```txt
expenses: id, date, categoryId, paymentSource, createdAt
categories: id, name, archived
meta: key
```

Initial seed:

- On first launch, seed default categories.

## PWA and iOS Requirements

Required:

- `manifest.webmanifest`
- app icons
- `apple-touch-icon`
- iOS standalone metadata
- dark status bar styling
- safe-area padding for notch and home indicator
- offline support through a service worker or Vite PWA integration

iOS install flow:

- User opens deployed URL in Safari.
- User taps Share.
- User selects Add to Home Screen.
- App appears as Ledger.

## Deployment

Host on GitHub Pages from a public repository.

Deployment method:

- GitHub Actions.
- Build command: `npm run build`.
- Static output directory: `dist`.

Cost:

- Free.

## Open Questions

None currently. If a product decision arises during implementation that is not covered here, pause and ask before proceeding.
