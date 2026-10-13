# UI foundation (Tailwind + shadcn/ui)

- **Date:** 2026-10-13
- **Status:** Implemented in the same change
- **Part of:** `2026-10-13-monorepo-migration.md`, phase 4

## Goal

Tailwind CSS v4 for public pages, shadcn/ui components for admin pages, shared through `@easyrms/ui`.

## Design

- Tailwind v4 via `@tailwindcss/postcss` in `packages/app`; `globals.css` imports Tailwind, the shadcn theme tokens from `@easyrms/ui/styles.css`, and `@source`s the `ui` package.
- `packages/ui/src/lib/utils.ts` (`cn`), `src/admin/*` (shadcn components: Button, Card, Badge, Table, Input, Label, Select-less forms), `src/public/*` (plain Tailwind components, e.g. the return request form).
- `components.json` in `packages/ui` for adding further shadcn components with the CLI.
- Pages: `/` (public: request a return) and `/admin/returns` (admin: list + change status).

## Out of scope

Dark-mode toggle, auth, i18n.
