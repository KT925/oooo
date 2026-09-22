# BodyTune

減量・ボディメイクのための記録、推移分析、翌日の調整提案を行うローカル Web アプリです。

## できること

- 体重、体脂肪率、摂取カロリー、PFC、運動消費、歩数を日別に記録
- 直近7日の体重変化、平均摂取カロリー、週間運動量を自動集計
- 目標体重、減量ペース、基準カロリー、PFC基準を設定
- 記録内容から翌日の摂取カロリー、PFC、歩数の調整案を表示
- CSV出力

## 使い方

`index.html` をブラウザで開くだけで使えます。記録はブラウザの localStorage に保存されます。

```bash
open index.html
```

サンプルデータを入れたい場合は、画面右上の「サンプル投入」を押してください。

## 調整ロジック

- 目標減量ペースから1日あたりの目標カロリー赤字を計算
- 直近7日の体重変化が速すぎる場合は翌日の摂取量を少し増やす
- 直近7日の体重変化が遅い場合は翌日の摂取量を少し下げる
- タンパク質不足、脂質不足、歩数不足がある場合は個別に提案

## 今後追加しやすい機能

- Google Sheets / Notion 連携
- 写真記録
- 週次レポートの自動生成
- 目標別の増量・維持モード
- LINE / Slack への翌日プラン通知

## Instagram Content OS

`instagram-content-os.html` は、Instagram運用のための投稿管理OSです。

5本の柱で投稿案を整理できます。

- BODY: 筋トレ、大会、食事管理、ボディメイク
- BEAUTY: 美容外科看護師としての美容医療知識
- TRAVEL: 海外旅行、ホテル、写真
- MIND: 自立、仕事観、恋愛観、人生観
- LIFE: 東京での日常、食事、ファッション

投稿案、Hook、公開予定日、制作ステータスを保存でき、CSV出力にも対応しています。

設計の全体像は `CODEX_MASTER_PROMPT.md` にまとめています。

Phase 1では、ローカルで使えるInstagram Content OSとして以下を実装しています。

- 低頻度でも続く写真メイン運用の設計
- 5本柱の世界観整理
- 投稿案の作成、編集、削除
- Hook Libraryのプレビュー
- Weekly Rhythmの表示
- Monetization Mapの表示
- 投稿ステータス管理
- CSV出力

## LINE Expense OS

`line-expense-os.html` は、LINE公式アカウントに支出メモや領収書画像を送って台帳化する仕組みのプロトタイプです。

設計書は `LINE_EXPENSE_OS.md` にまとめています。

- LINE公式アカウントのWebhook設計
- 領収書画像の取得・OCR導線
- Supabase SQLスキーマ
- 支出台帳のローカルプロトタイプ
- CSV出力

LINE Webhookの最小APIは `api/line/webhook.js` にあります。

Vercelなどにデプロイし、以下の環境変数を設定してください。

```text
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
```

Webhook URL:

```text
https://YOUR_DOMAIN.vercel.app/api/line/webhook
```
