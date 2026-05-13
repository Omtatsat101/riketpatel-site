# Supabase setup — `leads` table

All four forms across the three sites write a row into a single `public.leads` table in your Supabase project (`doxmbwizpsyqruyrmffs`). Once the SQL below has run, everything just works.

Forms wired:

| Site | Form | `source` value | `domain` value |
|---|---|---|---|
| riketpatel.com | Contact modal | `contact_riketpatel` | `riketpatel.com` |
| riketpatel.com | Résumé gate (`/resume/`) | `resume_download` | `riketpatel.com` |
| mettalegacypartners.com | Contact form | `contact_legacy` | `mettalegacypartners.com` |
| mettarealtypartners.com | Contact form | `contact_realty` | `mettarealtypartners.com` |

## How to run

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project (`doxmbwizpsyqruyrmffs`) → **SQL Editor**
2. Paste the block below
3. Click **Run**

That's it. The anon key in the published `config.js` files can only INSERT into this table — no read, no update, no delete — so the public exposure is safe.

## SQL

```sql
-- ────────────────────────────────────────────────────────────────────────────
-- leads table — single capture surface for all site forms.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  source       text not null,                  -- e.g. 'resume_download', 'contact_riketpatel'
  domain       text not null,                  -- which site captured this lead
  name         text,
  email        text not null,
  phone        text,
  company      text,
  role         text,
  message      text,
  user_agent   text,
  referrer     text,
  metadata     jsonb default '{}'::jsonb
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx      on public.leads (email);
create index if not exists leads_source_idx     on public.leads (source);
create index if not exists leads_domain_idx     on public.leads (domain);

-- ────────────────────────────────────────────────────────────────────────────
-- Row-level security: anon role can INSERT only; reads/updates are service-only.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.leads enable row level security;

-- Anyone (the public anon key from config.js) can insert.
create policy "anon can insert leads"
  on public.leads
  for insert
  to anon
  with check (true);

-- (Optional) — let your own authenticated user read leads from the dashboard.
-- Uncomment + replace <your-uuid> with your auth.users.id after you sign in.
-- create policy "owner can read leads"
--   on public.leads
--   for select
--   to authenticated
--   using (auth.uid() = '<your-uuid>'::uuid);

-- Service-role (server-side, full access) is exempt from RLS automatically.
```

## How to view incoming leads

In Supabase dashboard:
- **Table Editor → leads** — see every row
- **SQL Editor** — for custom queries

A useful daily summary:

```sql
select source, domain, count(*) as leads_today
from public.leads
where created_at >= current_date
group by source, domain
order by leads_today desc;
```

A useful weekly summary:

```sql
select date_trunc('day', created_at) as day, source, count(*) as n
from public.leads
where created_at >= now() - interval '7 days'
group by 1, 2
order by 1 desc, 2;
```

## Optional: auto-notify when a lead lands

Supabase can fire a Database Webhook on insert. To pipe new leads into Make.com (or Slack, or email):

1. Supabase dashboard → **Database → Webhooks** → **Create a new hook**
2. Table: `public.leads` · Events: `INSERT`
3. Type: **HTTP Request**
4. URL: your Make.com webhook URL (or a Slack incoming webhook)
5. Method: POST · Headers: `Content-Type: application/json`

Make.com then handles the notification + can also write to Google Sheets, send a digest, etc. — using your existing toolbox.

## What the anon key can and cannot do

Reminder of the data-sovereignty model:

- The anon key in `config.js` is **public on purpose** — it's the only way a browser can talk to Supabase without proxying through a server.
- The `leads` table's RLS policy lets the anon key **insert only**. Reads, updates, and deletes are blocked.
- Your `service_role` key (NOT in any client file) is the one you'd use server-side for analysis. Keep that in `projects/API-KEYS.env` only.
