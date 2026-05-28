---
name: Money Flow
description: Local-first Thai personal finance tracker with calm task-focused reporting.
colors:
  ink: "#172033"
  muted: "#475569"
  page: "#f4f7fb"
  surface: "#ffffff"
  border: "#e2e8f0"
  control-border: "#d6dce6"
  primary: "#2563eb"
  primary-soft: "#dbeafe"
  primary-wash: "#eff6ff"
  sidebar: "#111827"
  sidebar-active: "#1f2937"
  income: "#15803d"
  income-wash: "#f0fdf4"
  expense: "#dc2626"
  expense-wash: "#fef2f2"
  balance: "#1d4ed8"
  balance-wash: "#eff6ff"
  teal-wash: "#f0fdfa"
  violet-wash: "#f5f3ff"
  danger-bg: "#fee2e2"
  danger-text: "#991b1b"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0"
rounded:
  md: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "46px"
  button-secondary:
    backgroundColor: "#e2e8f0"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "46px"
  card-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "46px"
---

# Design System: Money Flow

## 1. Overview

**Creative North Star: "The Personal Ledger Desk"**

Money Flow should feel like a clear desk with a reliable ledger open: quiet, structured, and ready for repeated use. The interface serves fast data entry and financial review, not brand spectacle.

The product is restrained but no longer monochrome. Dark surfaces are reserved for navigation, primary commands use clear blue, and content panels use soft semantic washes to guide the eye without turning the app into decoration.

**Key Characteristics:**
- Local-first, private, and practical.
- Dense enough for daily use, but never cramped below 46px primary control height.
- Thai workflow copy, predictable product UI patterns, and minimal decoration.
- Charts must have textual equivalents; visual color is never the only source of meaning.

## 2. Colors

The palette is a restrained product palette with more visible color: tinted neutral surfaces, one clear blue action color, and semantic report colors.

### Primary
- **Action Blue**: the primary action and active input/interaction color. Use it when the user is committing work.
- **Ledger Ink**: strongest page text and dark navigation context.

### Secondary
- **Income Green**: successful inflow values and income bars.
- **Expense Red**: outgoing money, warnings, delete actions, and expense bars.
- **Balance Blue**: remaining balance and neutral financial emphasis.
- **Teal Wash**: trend panels and calm analytical surfaces.
- **Violet Wash**: category breakdown panels where multiple category colors appear.

### Neutral
- **Paper Surface**: content panels and form fields.
- **Soft Page**: app background that separates panels without decoration.
- **Divider Line**: borders, table rules, and quiet separation.
- **Muted Label**: secondary labels and helper text.
- **Sidebar Night**: persistent navigation only.

### Named Rules

**The Semantic Money Rule.** Green, red, and blue are reserved for income, expense, and balance. Do not reuse them as decorative accents.

**The Soft Wash Rule.** Color may tint a whole panel or state, never a side stripe. Washes must stay pale enough for dark text and charts.

## 3. Typography

**Display Font:** Inter/system sans stack.
**Body Font:** Inter/system sans stack.
**Label/Mono Font:** Same sans stack; no mono style is currently used.

**Character:** Native, practical, and dense. Type should help users scan money, categories, and dates without calling attention to itself.

### Hierarchy
- **Display** (800, 2.6rem desktop / 1.8rem mobile, 1.1): page titles only.
- **Title** (800, 1.1rem, 1.3): panel headings and settings cards.
- **Body** (400, 1rem, 1.5): descriptions, table cells, and form values.
- **Label** (650, 0.9rem, 1.35): form labels, metric labels, and helper labels.

### Named Rules

**The Task Typography Rule.** Do not use display fonts, gradient text, or letter-spaced labels. Product clarity wins over personality.

## 4. Elevation

Money Flow uses tonal layering plus a very light ambient shadow. Depth is structural: panels sit on the page background, navigation sits in a dark rail, and interactive elements shift subtly on hover.

### Shadow Vocabulary
- **Surface Hairline** (`0 1px 2px rgb(15 23 42 / 0.04)`): default panel and metric elevation only.

### Named Rules

**The Low Lift Rule.** Surfaces are almost flat. If a shadow is visible before the border is visible, it is too strong.

## 5. Components

### Buttons
- **Shape:** gently curved rectangle (8px) with one shared control height.
- **Primary:** Action Blue background with Paper Surface text, 46px minimum height, 136px default minimum width.
- **Secondary:** soft blue background with Action Blue text.
- **Danger:** soft red background with red text, used only for destructive actions.
- **Hover / Focus:** subtle color or 1px lift; focus must use a visible outline.
- **Icon Buttons:** square 46px target.

### Chips
- **Style:** small rounded semantic pills for transaction type and category status.
- **State:** income/status active use green tint; expense/inactive use red tint.

### Cards / Containers
- **Corner Style:** 8px radius.
- **Background:** Paper Surface on Soft Page.
- **Shadow Strategy:** Surface Hairline only.
- **Border:** one-pixel Divider Line.
- **Internal Padding:** 20px panels, 16px dense grids.

### Inputs / Fields
- **Style:** Paper Surface, 1px Control Border, 8px radius, 46px minimum height.
- **Focus:** visible outline with blue-tinted ring.
- **Error / Disabled:** errors appear inline or in alert regions; disabled controls remain visible but subdued.

### Navigation
- **Desktop:** dark side rail with icon and text labels.
- **Mobile:** compact top rail with icon buttons, each retaining an accessible name.
- **Active State:** dark raised navigation item with clear contrast.

### Financial Charts
- **Trend:** compact paired bar chart with income/expense legend and screen-reader table.
- **Category Breakdown:** conic category chart with adjacent legend.
- **Budgets:** progress bars must expose progressbar semantics and visible percentages.

## 6. Do's and Don'ts

### Do:
- **Do** keep all primary controls at 46px height and all touch targets at least 44px.
- **Do** provide a text equivalent for every chart.
- **Do** keep mobile entry single-column and full-width.
- **Do** confirm destructive actions before changing local data.
- **Do** use soft full-panel washes for analytics/settings grouping when color improves scanning.

### Don't:
- **Don't** make it feel like a marketing landing page.
- **Don't** use decorative finance clichés such as navy-and-gold luxury styling, gradient hero metrics, or glassmorphism.
- **Don't** hide core functionality on mobile.
- **Don't** use side-stripe borders, gradient text, or decorative blur effects.
- **Don't** introduce cloud/account concepts into v1 screens.
