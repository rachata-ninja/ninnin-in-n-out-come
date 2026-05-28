---
name: NinJahMajod
register: product
---

# NinJahMajod Product Context

## Product Purpose

NinJahMajod is a local-first personal income and expense tracker for one person who wants quick clarity without a spreadsheet. The app helps users record transactions, keep categories and monthly budgets tidy, and understand monthly or yearly cash flow at a glance.

## Users

- Thai-speaking individual users managing daily personal spending.
- Users who enter transactions manually and need a fast form that works well on mobile.
- Users who value privacy and simple local storage over cloud sync in v1.

## Core Jobs

- Record income or expenses with category, amount, date, and note.
- Review recent transactions in date order, including backdated entries.
- Compare income, expense, remaining balance, category spend, and budget usage.
- Maintain categories and budgets without needing account setup.
- Export and import JSON backups.

## Product Principles

- Keep the task surface quiet and work-focused.
- Make mobile entry reliable: one-handed, readable, no hidden overflow.
- Favor explicit confirmation for destructive actions.
- Use Thai copy for user-facing workflow language; English may remain for technical nouns such as JSON.
- Keep business logic testable and independent from the React UI.

## Anti-References

- Do not make it feel like a marketing landing page.
- Do not use decorative finance clichés such as navy-and-gold luxury styling, gradient hero metrics, or glassmorphism.
- Do not hide core functionality on mobile.
- Do not require login, cloud sync, or backend infrastructure in v1.
