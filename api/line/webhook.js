import crypto from "node:crypto";

const lineReplyEndpoint = "https://api.line.me/v2/bot/message/reply";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = await readRawBody(request);
  if (!verifyLineSignature(body, request.headers["x-line-signature"])) {
    response.status(401).json({ error: "Invalid LINE signature" });
    return;
  }

  const payload = JSON.parse(body);
  await Promise.all((payload.events || []).map(handleEvent));
  response.status(200).json({ ok: true });
}

async function handleEvent(event) {
  if (event.type !== "message" || !event.replyToken) return;
  const lineUserId = event.source?.userId || event.source?.groupId || event.source?.roomId || "unknown";

  if (event.message?.type === "text") {
    const text = event.message.text;
    const commandResult = await handleTextCommand(text, lineUserId);
    if (commandResult) {
      await replyText(event.replyToken, commandResult);
      return;
    }

    const parsed = parseExpenseText(text);
    if (!parsed) {
      await replyText(event.replyToken, buildUsageMessage());
      return;
    }

    const savedExpense = await createExpense({
      ...parsed,
      lineUserId,
      lineMessageId: event.message.id,
      status: "pending",
    });

    await replyText(event.replyToken, buildExpenseConfirmation(savedExpense || parsed));
    return;
  }

  if (event.message?.type === "image") {
    await createExpense({
      lineUserId,
      lineMessageId: event.message.id,
      status: "pending",
      spentOn: todayInTokyo(),
      merchant: "領収書画像",
      amount: 0,
      category: "未分類",
      rawText: "image message",
      memo: "OCR未処理の領収書画像",
    });

    await replyText(
      event.replyToken,
      "領収書画像を受け取りました。\n\n今はOCR前なので、続けて金額メモを送ってください。\n例: スタバ 680 カフェ"
    );
  }
}

async function handleTextCommand(text, lineUserId) {
  const normalized = String(text || "").trim();
  if (/^(ok|OK|ＯＫ|おけ|オッケー|確定)$/i.test(normalized)) {
    const pending = await findLatestPendingExpense(lineUserId);
    if (!pending) return "未確定の支出がありません。";
    const updated = await updateExpense(pending.id, { status: "confirmed" });
    return [
      "保存しました。",
      "",
      `内容: ${updated?.merchant || pending.merchant}`,
      `金額: ${Number(updated?.amount || pending.amount || 0).toLocaleString("ja-JP")}円`,
      `カテゴリ: ${updated?.category || pending.category}`,
    ].join("\n");
  }

  const correction = parseCorrection(normalized);
  if (correction) {
    const pending = await findLatestPendingExpense(lineUserId);
    if (!pending) return "修正できる未確定の支出がありません。";
    const updated = await updateExpense(pending.id, correction);
    return [
      "修正しました。OKなら「OK」と送ってください。",
      "",
      `内容: ${updated?.merchant || pending.merchant}`,
      `金額: ${Number(updated?.amount || pending.amount || 0).toLocaleString("ja-JP")}円`,
      `カテゴリ: ${updated?.category || pending.category}`,
    ].join("\n");
  }

  return null;
}

function parseExpenseText(text) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  const amountMatch = normalized.match(/(\d{2,})(?:円)?/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  const dateMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})\s+/);
  const spentOn = dateMatch ? dateInCurrentYear(dateMatch[1], dateMatch[2]) : todayInTokyo();
  const bodyText = dateMatch ? normalized.slice(dateMatch[0].length).trim() : normalized;
  const bodyAmountMatch = bodyText.match(/(\d{2,})(?:円)?/);
  const beforeAmount = bodyText.slice(0, bodyAmountMatch.index).trim();
  const afterAmount = bodyText.slice(bodyAmountMatch.index + bodyAmountMatch[0].length).trim();

  return {
    spentOn,
    merchant: beforeAmount || "未入力",
    amount,
    category: afterAmount || inferCategory(beforeAmount),
    rawText: normalized,
  };
}

function inferCategory(text) {
  const rules = [
    ["タクシー", "交通費"],
    ["電車", "交通費"],
    ["ランチ", "食費"],
    ["ご飯", "食費"],
    ["カフェ", "カフェ"],
    ["スタバ", "カフェ"],
    ["美容", "美容"],
    ["化粧", "美容"],
    ["ホテル", "旅行"],
    ["服", "衣服"],
  ];
  return rules.find(([keyword]) => text.includes(keyword))?.[1] || "未分類";
}

function parseCorrection(text) {
  const category = text.match(/^カテゴリ\s+(.+)$/);
  if (category) return { category: category[1].trim() };

  const amount = text.match(/^金額\s+(\d{2,})(?:円)?$/);
  if (amount) return { amount: Number(amount[1]) };

  const merchant = text.match(/^(内容|店名)\s+(.+)$/);
  if (merchant) return { merchant: merchant[2].trim() };

  const memo = text.match(/^メモ\s+(.+)$/);
  if (memo) return { memo: memo[1].trim() };

  return null;
}

function buildExpenseConfirmation(expense) {
  return [
    "登録候補を作成しました。OKなら「OK」と送ってください。",
    "",
    `日付: ${expense.spentOn || expense.spent_on || todayInTokyo()}`,
    `店名/内容: ${expense.merchant}`,
    `金額: ${expense.amount.toLocaleString("ja-JP")}円`,
    `カテゴリ: ${expense.category}`,
    "",
    "修正する場合: 「カテゴリ 美容」「金額 720」「店名 スタバ」のように送ってください。",
  ].join("\n");
}

function buildUsageMessage() {
  return [
    "支出メモはこの形で送ってください。",
    "",
    "例:",
    "ランチ 1280 食費",
    "9/22 タクシー 2400 交通費",
    "化粧水 3980 美容",
    "",
    "直前の支出は「OK」で確定できます。",
  ].join("\n");
}

async function createExpense(expense) {
  if (!hasSupabaseConfig()) return null;

  if (expense.lineMessageId) {
    const existing = await findExpenseByLineMessageId(expense.lineMessageId);
    if (existing) return existing;
  }

  const payload = {
    line_user_id: expense.lineUserId,
    line_message_id: expense.lineMessageId,
    status: expense.status || "pending",
    spent_on: expense.spentOn || todayInTokyo(),
    merchant: expense.merchant || "未入力",
    amount: Number(expense.amount || 0),
    category: expense.category || "未分類",
    memo: expense.memo || null,
    raw_text: expense.rawText || null,
  };

  const rows = await supabaseRequest("/rest/v1/expenses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return normalizeExpense(rows?.[0]);
}

async function findExpenseByLineMessageId(lineMessageId) {
  if (!hasSupabaseConfig()) return null;

  const query = new URLSearchParams({
    line_message_id: `eq.${lineMessageId}`,
    limit: "1",
  });
  const rows = await supabaseRequest(`/rest/v1/expenses?${query.toString()}`);
  return normalizeExpense(rows?.[0]);
}

async function findLatestPendingExpense(lineUserId) {
  if (!hasSupabaseConfig()) return null;

  const query = new URLSearchParams({
    line_user_id: `eq.${lineUserId}`,
    status: "eq.pending",
    order: "created_at.desc",
    limit: "1",
  });
  const rows = await supabaseRequest(`/rest/v1/expenses?${query.toString()}`);
  return normalizeExpense(rows?.[0]);
}

async function updateExpense(id, patch) {
  if (!hasSupabaseConfig()) return null;

  const payload = {};
  if (patch.status) payload.status = patch.status;
  if (patch.category) payload.category = patch.category;
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.merchant) payload.merchant = patch.merchant;
  if (patch.memo) payload.memo = patch.memo;
  payload.updated_at = new Date().toISOString();

  const rows = await supabaseRequest(`/rest/v1/expenses?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return normalizeExpense(rows?.[0]);
}

async function supabaseRequest(path, options = {}) {
  const url = `${process.env.SUPABASE_URL}${path}`;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const result = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body,
  });

  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(`Supabase request failed: ${result.status} ${errorText}`);
  }

  if (result.status === 204) return null;
  return result.json();
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

function normalizeExpense(expense) {
  if (!expense) return null;
  return {
    ...expense,
    spentOn: expense.spent_on,
    lineUserId: expense.line_user_id,
    lineMessageId: expense.line_message_id,
  };
}

function todayInTokyo() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  const day = parts.find((part) => part.type === "day").value;
  return `${year}-${month}-${day}`;
}

function dateInCurrentYear(month, day) {
  const year = todayInTokyo().slice(0, 4);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function replyText(replyToken, text) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    console.log("LINE_CHANNEL_ACCESS_TOKEN is not set. Reply skipped:", text);
    return;
  }

  const result = await fetch(lineReplyEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(`LINE reply failed: ${result.status} ${errorText}`);
  }
}

function verifyLineSignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac("sha256", secret).update(body).digest("base64");
  if (hash.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}
