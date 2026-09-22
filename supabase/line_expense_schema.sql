create extension if not exists "uuid-ossp";

create table if not exists expense_sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('line', 'manual', 'csv')),
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid references expense_sources(id) on delete set null,
  line_user_id text,
  line_message_id text unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  spent_on date,
  merchant text,
  amount integer not null check (amount >= 0),
  category text not null default '未分類',
  memo text,
  receipt_url text,
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expense_receipts (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references expenses(id) on delete cascade,
  line_message_id text,
  storage_path text,
  mime_type text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists category_rules (
  id uuid primary key default uuid_generate_v4(),
  keyword text not null,
  category text not null,
  priority int not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists expenses_spent_on_idx on expenses(spent_on desc);
create index if not exists expenses_category_idx on expenses(category);
create index if not exists expenses_line_user_status_idx on expenses(line_user_id, status, created_at desc);
create index if not exists expense_receipts_message_idx on expense_receipts(line_message_id);

insert into expense_sources (name, type)
select 'LINE Official Account', 'line'
where not exists (
  select 1 from expense_sources where name = 'LINE Official Account'
);
