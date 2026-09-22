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

  if (event.message?.type === "text") {
    const parsed = parseExpenseText(event.message.text);
    const message = parsed
      ? buildExpenseConfirmation(parsed)
      : [
          "支出メモはこの形で送ってください。",
          "",
          "例:",
          "ランチ 1280 食費",
          "タクシー 2400 交通費",
          "化粧水 3980 美容",
        ].join("\n");

    await replyText(event.replyToken, message);
    return;
  }

  if (event.message?.type === "image") {
    await replyText(
      event.replyToken,
      "領収書画像を受け取りました。次のPhaseでOCR読み取りと台帳保存に対応します。"
    );
  }
}

function parseExpenseText(text) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  const amountMatch = normalized.match(/(\d{2,})(?:円)?/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  const beforeAmount = normalized.slice(0, amountMatch.index).trim();
  const afterAmount = normalized.slice(amountMatch.index + amountMatch[0].length).trim();

  return {
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

function buildExpenseConfirmation(expense) {
  return [
    "登録候補を作成しました。",
    "",
    `店名/内容: ${expense.merchant}`,
    `金額: ${expense.amount.toLocaleString("ja-JP")}円`,
    `カテゴリ: ${expense.category}`,
    "",
    "次のPhaseでSupabase保存と修正返信に対応します。",
  ].join("\n");
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
