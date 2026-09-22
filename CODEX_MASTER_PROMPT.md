# CODEX MASTER PROMPT

## Product

Instagram Content OS is a lightweight operating system for running a lifestyle Instagram account around one worldview:

> 自分を磨きながら、自分の人生を自分で選んでいく女性のLifestyle

The product helps plan, write, schedule, review, and eventually monetize Instagram content across five pillars.

- BODY: 筋トレ、大会、食事管理、ボディメイク
- BEAUTY: 美容外科看護師としての知識、美容医療、コスメ、普段使いアイテム
- TRAVEL: 海外旅行、ホテル、写真
- MIND: 自立、仕事観、恋愛観、人生観
- LIFE: 東京での日常、食事、ファッション、愛用品

## 1. Repository Structure

Current Phase 1 is static and local-first. Future phases can migrate the same data model to Supabase.

```text
oooo/
  CODEX_MASTER_PROMPT.md
  README.md
  index.html
  styles.css
  app.js
  instagram-content-os.html
  instagram-content-os.css
  instagram-content-os.js
```

Target structure for later phases:

```text
oooo/
  docs/
    product.md
    content-strategy.md
    monetization.md
  supabase/
    schema.sql
    seed.sql
    policies.sql
  src/
    app/
      dashboard/
      content/
      calendar/
      analytics/
      settings/
    components/
    lib/
    styles/
  tests/
```

## 2. Supabase SQL Schema

Use this schema when moving from localStorage to Supabase.

```sql
create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  handle text,
  bio text,
  worldview text not null default '自分を磨きながら、自分の人生を自分で選んでいく女性のLifestyle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pillars (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  key text not null check (key in ('BODY', 'BEAUTY', 'TRAVEL', 'MIND', 'LIFE')),
  name text not null,
  description text not null,
  color text not null,
  sort_order int not null,
  created_at timestamptz not null default now(),
  unique (profile_id, key)
);

create table content_ideas (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  pillar_key text not null check (pillar_key in ('BODY', 'BEAUTY', 'TRAVEL', 'MIND', 'LIFE')),
  format text not null check (format in ('Reel', 'Carousel', 'Story', 'Live', 'Photo')),
  status text not null check (status in ('Idea', 'Script', 'Shooting', 'Editing', 'Scheduled', 'Posted')),
  title text not null,
  hook text,
  memo text,
  publish_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table content_metrics (
  id uuid primary key default uuid_generate_v4(),
  content_id uuid not null references content_ideas(id) on delete cascade,
  reach int default 0,
  likes int default 0,
  comments int default 0,
  saves int default 0,
  shares int default 0,
  profile_visits int default 0,
  follows int default 0,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table monetization_assets (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('affiliate', 'pr', 'product', 'service', 'media')),
  name text not null,
  url text,
  pillar_key text check (pillar_key in ('BODY', 'BEAUTY', 'TRAVEL', 'MIND', 'LIFE')),
  notes text,
  created_at timestamptz not null default now()
);

create index content_ideas_profile_date_idx on content_ideas(profile_id, publish_date);
create index content_ideas_pillar_status_idx on content_ideas(pillar_key, status);
create index content_metrics_content_idx on content_metrics(content_id);
```

Row level security for production:

```sql
alter table profiles enable row level security;
alter table pillars enable row level security;
alter table content_ideas enable row level security;
alter table content_metrics enable row level security;
alter table monetization_assets enable row level security;
```

Add user ownership before enabling multi-user access.

## 3. Screen Wireframes

### Dashboard

```text
[Hero: Worldview + quick actions]
[Brand strip: audience / promise / tone]
[5 pillar cards]
[Stats: total ideas / this week / active / balance]
[Content board: filters + cards]
```

### Content Editor

```text
[Pillar select] [Format select]
[Publish date] [Status]
[Title]
[Hook]
[Memo / structure / CTA]
[Save] [Reset]
```

### Weekly Calendar

```text
Mon BODY      planned card
Tue BEAUTY    planned card
Wed MIND      planned card
Thu Story     light touch
Fri TRAVEL    planned card
Sat LIFE      optional
Sun Recap     weekly recap
```

### Monetization Map

```text
BODY    protein / supplements / gym wear / food tools
BEAUTY  cosmetics / skincare / clinic knowledge / PR
TRAVEL  hotels / travel goods / photo spots
MIND    note / PDF / consultation / community
LIFE    fashion / restaurants / daily favorites
```

## 4. Design System

### Brand Attributes

- Elegant, realistic, warm, disciplined.
- Lifestyle-first, not hard-sell.
- Professional enough for beauty knowledge, personal enough for bodymake and daily life.

### Colors

- Background: `#f7f3ef`
- Ink: `#1e1b19`
- Muted: `#766d66`
- Rose: `#a64f65`
- Green: `#4d6c56`
- Blue: `#4e648a`
- Gold: `#a56d2b`
- Line: `#ded4cb`

### Components

- Hero section for worldview.
- Pillar cards for strategy overview.
- Panel for input/edit forms.
- Stat cards for planning health.
- Idea cards for content board.
- Pill tags for pillar/status.

### UX Rules

- A user should be able to add a content idea in under 60 seconds.
- The board must make the next production action obvious.
- The language should support a creator who is busy and not posting daily.
- Do not force Reel-first operation; support photo, carousel, story, and low-effort content.

## 5. Implementation Order

### Phase 1: Local Content OS

- Keep the app static and dependency-free.
- Store ideas in localStorage.
- Provide the five-pillar strategy overview.
- Add content idea CRUD.
- Add filters, stats, CSV export, sample ideas.
- Add operation guidance for low-frequency posting.
- Add navigation from BodyTune to Instagram Content OS.

### Phase 2: Content Strategy Expansion

- Add hook library by pillar.
- Add script templates for photo, carousel, Reel, story.
- Add Summer Style Award campaign board.
- Add monetization map and favorite item database.

### Phase 3: Analytics

- Add manual input of reach, saves, follows, profile visits.
- Add pillar performance view.
- Add next-week recommendations.

### Phase 4: Supabase Migration

- Add Supabase schema.
- Replace localStorage repository with Supabase client.
- Add auth.
- Add RLS policies.

### Phase 5: Publishing Workflow

- Add calendar.
- Add asset checklist.
- Add export for captions and hashtags.
- Add weekly review report.

## 6. Test Conditions

### Functional

- A user can create, edit, delete, and filter content ideas.
- A user can add sample ideas without creating duplicates.
- A user can export CSV.
- Stats update after every create, edit, delete, and seed action.
- Empty state appears when there are no matching ideas.

### Content Strategy

- All five pillars are visible.
- BODY, BEAUTY, TRAVEL, MIND, and LIFE each have a clear role.
- The worldview appears above the pillar system.
- The app supports low-frequency posting and photo-first operation.

### Technical

- `node --check app.js` passes.
- `node --check instagram-content-os.js` passes.
- The app opens directly from `instagram-content-os.html`.
- No external build step is required.

### Visual

- Mobile width does not overlap text or controls.
- Buttons and inputs remain tappable.
- Pillar cards retain readable hierarchy.
- Content cards show pillar, status, title, hook, memo, format, and date.

## Current Phase

Phase 1 is active.

The next implementation task is to strengthen the local Instagram Content OS with:

- low-frequency operation guidance,
- hook library preview,
- monetization pathway preview,
- and a clearer weekly content rhythm.
