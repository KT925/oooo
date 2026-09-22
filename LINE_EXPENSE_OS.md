# LINE Expense OS

## Goal

LINE公式アカウントに、支出メモや領収書画像を送るだけで、支出台帳に自動登録できる仕組みを作る。

## User Flow

```text
1. LINE公式アカウントに領収書画像を送る
2. Webhookが画像メッセージを受信
3. Bot serverがLINEのmessage content APIで画像を取得
4. OCR/AIで日付、店名、金額、税区分、カテゴリ候補を抽出
5. Supabaseに保存
6. LINEに確認メッセージを返信
7. 必要ならユーザーが「交通費」「食費」などを返信して修正
```

テキスト入力も対応する。

```text
ランチ 1280 食費
タクシー 2400 交通費
スタバ 680 打ち合わせ
```

## LINE Messaging API

LINE公式アカウントにユーザーがメッセージを送ると、LINE Developers Consoleで設定したWebhook URLへPOSTリクエストが送られる。

画像や動画はWebhookのmessage idを使って、コンテンツ取得APIから取得する。

Required settings:

- LINE Official Account
- Messaging API channel
- Webhook URL
- Channel secret
- Channel access token
- Use webhook: enabled

## Phase 1 Webhook Endpoint

This repository includes a Vercel-compatible webhook endpoint:

```text
/api/line/webhook
```

Required environment variables:

```text
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

After deploying to Vercel, set the LINE webhook URL to:

```text
https://YOUR_DOMAIN.vercel.app/api/line/webhook
```

Phase 1 supports text messages such as:

```text
ランチ 1280 食費
タクシー 2400 交通費
化粧水 3980 美容
```

The bot replies with a registration candidate. Supabase persistence and OCR are handled in later phases.

## Architecture

```text
LINE Official Account
  ↓ webhook
API Server
  ↓ verify signature
LINE Message Content API
  ↓ image binary
OCR / AI Extractor
  ↓ structured JSON
Supabase
  ↓ confirmation
LINE Reply Message
```

## Suggested Stack

Phase 1:

- Static local dashboard
- CSV export
- Manual confirmation flow design

Phase 2:

- Supabase database
- Vercel / Cloudflare Workers / Railway webhook endpoint
- LINE signature validation
- Image storage

Phase 3:

- OCR/AI extraction
- Auto category rules
- Monthly report
- Tax/accounting export

## Supabase Schema

```sql
create extension if not exists "uuid-ossp";

create table expense_sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('line', 'manual', 'csv')),
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid references expense_sources(id) on delete set null,
  line_user_id text,
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

create table expense_receipts (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references expenses(id) on delete cascade,
  line_message_id text,
  storage_path text,
  mime_type text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);

create table category_rules (
  id uuid primary key default uuid_generate_v4(),
  keyword text not null,
  category text not null,
  priority int not null default 100,
  created_at timestamptz not null default now()
);

create index expenses_spent_on_idx on expenses(spent_on desc);
create index expenses_category_idx on expenses(category);
create index expense_receipts_message_idx on expense_receipts(line_message_id);
```

## Webhook Pseudocode

```ts
post('/api/line/webhook', async (req, res) => {
  verifyLineSignature(req);

  for (const event of req.body.events) {
    if (event.type !== 'message') continue;

    if (event.message.type === 'text') {
      const expense = parseTextExpense(event.message.text);
      await saveExpense(expense);
      await reply(event.replyToken, buildConfirmMessage(expense));
    }

    if (event.message.type === 'image') {
      const image = await getLineMessageContent(event.message.id);
      const receiptUrl = await uploadReceipt(image);
      const extracted = await extractReceipt(image);
      await saveExpense({ ...extracted, receiptUrl, status: 'pending' });
      await reply(event.replyToken, buildConfirmMessage(extracted));
    }
  }

  res.status(200).end();
});
```

## Confirmation Message

```text
領収書を読み取りました。

日付: 2026-09-22
店名: スターバックス
金額: 680円
カテゴリ: カフェ

OKなら「OK」
修正する場合は「カテゴリ 食費」や「金額 720」のように送ってください。
```

## Categories

- 食費
- カフェ
- 交通費
- 美容
- 医療
- 衣服
- 旅行
- 仕事
- 消耗品
- 家賃/固定費
- 未分類

## Test Conditions

- Text message `ランチ 1280 食費` is parsed into amount 1280 and category 食費.
- Image message event can fetch binary content by message id.
- Invalid LINE signature is rejected.
- Duplicate webhook delivery does not duplicate an expense.
- User can confirm or correct pending expenses.
- CSV export includes date, merchant, amount, category, memo, receipt URL.
