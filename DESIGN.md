---
name: NinJahMajod
description: Thai personal finance tracker built around one question — how much can I spend today?
colors:
  ink: "#0B0E14"
  ink-raise: "#10141D"
  ink-panel: "#151A24"
  ink-line: "#1F2736"
  paper: "#FFFFFF"
  paper-raise: "#F7F8FB"
  paper-panel: "#FFFFFF"
  paper-line: "#E4E8F0"
  text-strong: "#F4F7FB"
  text: "#E8ECF3"
  text-dim: "#8C99AE"
  text-faint: "#6E7A8F"
  blade: "#6C8FFF"
  blade-strong: "#4C6FE8"
  blade-wash: "#1A2338"
  income: "#3FBF7F"
  expense: "#FF6B6B"
  warn: "#F0A742"
typography:
  display:
    fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  figure:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Thai', ui-sans-serif, system-ui, sans-serif"
    fontVariantNumeric: "tabular-nums"
    fontWeight: 600
    letterSpacing: "-0.02em"
rounded:
  sm: "9px"
  md: "13px"
  lg: "19px"
  xl: "26px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.blade}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.ink-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "48px"
  card-panel:
    backgroundColor: "{colors.ink-raise}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  input-field:
    backgroundColor: "{colors.ink-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
---

# Design System: NinJahMajod

## 1. Overview

**Creative North Star: "Ink & Blade"**

NinJahMajod is named for a ninja who takes notes — นินจามาจด. The app should
move like one: log a transaction in three seconds, answer one question without
being asked, then get out of the way. Fast, quiet, precise. Never cute, never
chatty, never decorative for its own sake.

The whole product resolves to a single question — **ใช้ได้อีกวันละเท่าไหร่?**
Everything on the first screen either answers that question, records something
that changes the answer, or gets demoted.

**Key Characteristics:**

- Mobile is the primary surface; the laptop layout is the same product with room
  to breathe, not a different information architecture.
- One accent colour, used only where the user commits work. Everything else is
  ink and text.
- Money is set in tabular figures so columns of numbers align and scan.
- Motion is fast and decisive — a blade, not a bounce.
- Charts always have a textual equivalent; colour is never the only carrier of
  meaning.

### What changed from v1, and why

v1 was correct and unmemorable. These are the deliberate reversals:

- **v1 said "no charm".** It now allows one identity moment (first run) and one
  expressive element (the pace ring). Everything else stays quiet. Charm is
  rationed, not banned.
- **v1 put four period dropdowns above the fold.** Period selection is now a
  segmented control plus a month stepper. `paydayDay` is configuration and lives
  in Settings, not in the filter row.
- **v1 had two "add" affordances.** There is exactly one.
- **v1 filled metric cards with saturated colour.** Colour now lands on the
  number, restoring the Semantic Money Rule it wrote and then broke.

## 2. Colors

Two full palettes. Dark is the design's home key; light is a first-class
transposition, not an afterthought — it must be authored and reviewed, never
derived by inverting.

### Primary

- **Blade Blue** (`#6C8FFF` dark / `#3B5BDB` light): the only action colour.
  Primary buttons, the active tab, focus rings, the pace arc, selected chips.
  If an element is not something the user commits or navigates with, it is not
  blade blue.
- **Ink** (`#0B0E14` dark / `#FFFFFF` light): the page ground.

### Semantic money

- **Income Green** (`#3FBF7F` dark / `#15803D` light)
- **Expense Red** (`#FF6B6B` dark / `#DC2626` light)
- **Warn Amber** (`#F0A742` dark / `#B45309` light): budget between 80–100%.

### Neutral ramp

Four text weights, four surface weights. Nothing outside the ramp.

- Text: `text-strong` (page titles, money) → `text` (body) → `text-dim`
  (secondary) → `text-faint` (labels, disabled).
- Surface: `ink` (page) → `ink-raise` (panels) → `ink-panel` (inputs, chips) →
  `ink-line` (borders and rules).

### Named Rules

**The Semantic Money Rule.** Green, red and amber describe money and only money.
They colour the *number*, the bar, or a one-word status — never a whole card
background, never a nav item, never a decorative accent.

**The Single Blade Rule.** One accent colour, and it means "act here". Two
competing accents on a screen is a bug.

**The Ledger Contrast Rule.** Money text sits at `text-strong` or a semantic
colour, never at `text-dim`. If the user has to hunt for the number, the screen
has failed.

## 3. Typography

**All type:** IBM Plex Sans Thai (self-hosted, weights 400/500/600/700). Its
Latin companion is IBM Plex Sans, so Thai and Latin share one skeleton — no
mismatched fallback stack, which is what made v1 read as generic.

**Character:** Engineered and neutral, with enough personality in the numerals
to carry a ฿44px hero figure. Thai glyphs are unlooped (ไม่มีหัว) and modern.

### Hierarchy

- **Display** (700, 27px mobile / 34px desktop, 1.05, −0.02em): the hero figure
  and page title. One per screen.
- **Title** (600, 15px): section headings.
- **Body** (400, 14px): rows, descriptions, form values.
- **Label** (500, 12px, +0.02em): field labels, metric labels, meta.
- **Figure**: any rendered money value. `font-variant-numeric: tabular-nums`,
  600 weight, −0.02em tracking. Non-negotiable — it is what makes lists of
  amounts readable.

### Named Rules

**The Tabular Money Rule.** Every ฿ amount uses the figure style. A money value
in proportional figures is a bug.

**The Currency Spacing Rule.** The ฿ glyph is set smaller than its number and at
`text-dim`, with 3–5px of space. In v1 it collided with the digits at display
size.

## 4. Elevation

Depth comes from tone first, border second, shadow last.

- **Panels** are `ink-raise` on `ink` with a 1px `ink-line` border. No shadow.
- **Floating elements only** (FAB, sheet, dialog) carry shadow, and it is
  coloured by the element it belongs to: `0 10px 24px rgba(108,143,255,0.34)`
  under a blade FAB, not a generic grey blur.
- **The hero** is the one panel with a gradient, and it is a 2-stop vertical
  tonal shift of ~4% lightness — depth, not decoration.

### Named Rules

**The Earned Shadow Rule.** A shadow means "this floats above the page and can be
dismissed". Static panels never cast one.

## 5. Motion

Motion is functional: it explains where a thing came from and confirms that work
landed. Built on `motion`.

- **Durations:** 140ms (state change), 220ms (enter/exit), 320ms (sheet).
  Nothing slower than 320ms.
- **Easing:** `[0.32, 0.72, 0, 1]` for enter/exit — fast out of the gate,
  settling without overshoot. No spring bounce on money or navigation.
- **Sheet:** slides from the bottom edge, 320ms, with a backdrop fade at 220ms.
- **Money:** the hero figure counts to its new value over 220ms when the period
  changes. Numbers never fade or slide.
- **Rows:** new transactions enter with an 8px rise + fade at 140ms.
- **Respect `prefers-reduced-motion`:** all of the above collapse to instant.

### Named Rules

**The No-Bounce Rule.** Nothing overshoots. This is a ledger; money that springs
past its value and settles back reads as an error.

## 6. Components

### Buttons

- **Height:** 48px primary, 44px minimum for anything tappable.
- **Primary:** blade fill, ink text, `rounded.md`, 600 weight.
- **Secondary:** `ink-panel` fill, `text` colour, 1px `ink-line` border.
- **Danger:** transparent fill, expense-red text and border.
- **Focus:** 2px blade ring at 2px offset. Always visible, never removed.

### Segmented control

Period type (วัน / เดือน / ปี) and transaction type (จ่าย / รับ / ออม). A
`ink-panel` track with 3px padding; the active segment is a raised `rounded.sm`
tile. Active segment for transaction type takes a semantic tint, not blade —
the type *is* the money meaning.

### Chips

Category selection, date shortcuts. 40–44px tall, `rounded.md`. Selected =
`blade-wash` fill with a 1.5px blade border.

### Cards / Panels

`ink-raise`, 1px `ink-line`, `rounded.lg`, 18–20px padding. The hero is
`rounded.xl`.

### Inputs

`ink-panel`, 1px `ink-line`, `rounded.md`, 48px minimum. Focus raises the border
to blade and adds the ring.

### Navigation

- **Mobile:** fixed bottom tab bar, 4 items, icon over 10px label, with safe-area
  bottom padding. The scroll container reserves space for it *and* the FAB.
- **Laptop:** persistent left rail, 240px, same 4 destinations, icon + label,
  active item on `ink-panel` with a blade icon.

### The Pace Ring

The one expressive element. A 112px SVG ring showing percent of the period's
budget consumed, with the percentage centred. Accompanied — always — by a text
line stating pace in words and baht (`เร็วกว่าแผน ฿1,240`), because the ring
alone is decoration and the sentence is the insight.

### Financial charts

- **Trend:** paired bars, income/expense legend, screen-reader table.
- **Category breakdown:** donut plus an adjacent value legend.
- **Budgets:** two-line rows — name + amounts on line one, bar + percent inline
  on line two. Must expose `progressbar` semantics.

## 7. Responsive

Two layouts, one IA. Breakpoint at 900px.

- **< 900px:** single column, 20px gutters, bottom tab bar, FAB above it.
- **≥ 900px:** left rail + content column capped at 1100px; the dashboard's
  analytics panels become a 2-up grid; the FAB becomes a labelled button in the
  rail. Nothing is hidden at either size.

## 8. Do's and Don'ts

### Do:

- **Do** keep every tap target at 44px or larger.
- **Do** give every chart a text equivalent.
- **Do** author light mode deliberately and check both themes before shipping.
- **Do** state pace in a sentence, not only as a ring or a percentage.
- **Do** confirm destructive actions.
- **Do** put configuration in Settings and leave the dashboard for looking.

### Don't:

- **Don't** add a second accent colour.
- **Don't** fill a card with a semantic colour — colour the number.
- **Don't** use proportional figures for money.
- **Don't** let a floating element cover content; reserve its space.
- **Don't** show the same affordance twice on one screen.
- **Don't** bounce, overshoot, or animate anything longer than 320ms.
- **Don't** derive light mode by inverting dark.
