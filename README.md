# Margin — budgeting app for trades

A mobile-first budgeting app for trades contractors: job costing, a two-way
bid calculator, deposits, invoices with AR aging, a cash-flow forecast, and a
rotating motivational ticker. Built with Next.js (App Router). Runs on demo
data out of the box; switch on Supabase when you want real accounts and saved
data.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. It works immediately on built-in demo data — no
configuration needed.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, "New Project" → import the repo → Deploy. No env vars required
   for the demo to go live.

## Turn on Supabase (real data per contractor)

The app ships wired for Supabase but defaulted to demo data so it never breaks
a deploy. To make it real:

1. **Schema** — open your Supabase project → SQL editor → paste and run
   `supabase/schema.sql`. This creates every table and turns on Row Level
   Security so each contractor only sees their own rows.
2. **Env vars** — copy `.env.local.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Supabase → Project Settings → API). Add the same two in Vercel →
   Project → Settings → Environment Variables.
3. **Auth** — enable an auth method in Supabase (email/password or magic
   link). Because every row is owned by `auth.uid()`, a signed-in user is what
   makes RLS work. Add a simple sign-in page and gate the app behind it.
4. **Wire the data layer** — `lib/db.js` already has functions that read and
   write the exact shapes the UI uses (`loadAll`, `addJob`, `setDeposit`,
   `updateJobCost`, `addExpense`, `payInvoice`, `saveSettings`). Swap the
   in-memory `useReducer(reducer, seed)` in `components/Margin.jsx` to load
   from `loadAll()` on mount and route each mutation through these.

## Project structure

```
app/
  layout.jsx        root layout + fonts
  page.jsx          renders the app
  globals.css       fonts, slider, animations
components/
  Margin.jsx        the whole app (client component)
lib/
  supabaseClient.js browser client (null-safe when unconfigured)
  db.js             Supabase data layer, ready to switch on
supabase/
  schema.sql        tables + Row Level Security
```

## Notes

- Deposits are tracked per job as money collected upfront. They flow into cash
  and cash-flow, **not** into profit — a deposit is the customer pre-paying the
  quote, not extra margin. Keeping that separate is deliberate.
- The tax reserve is taken on **profit**, not revenue (built for Nevada, which
  has no state income tax). The percentage is a setting — confirm the exact
  number with an accountant.
- The motivational quotes live in a single `QUOTES` array in
  `components/Margin.jsx`. Add as many as you like; the ticker picks them up
  automatically.
