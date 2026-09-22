const storageKey = "bodytune.entries.v1";
const settingsKey = "bodytune.settings.v1";

const defaultSettings = {
  targetWeight: 68,
  weeklyPace: 0.5,
  baseCalories: 2200,
  proteinPerKg: 2,
  minFat: 45,
  targetSteps: 9000,
};

const fields = [
  "date",
  "weight",
  "bodyFat",
  "calories",
  "protein",
  "fat",
  "carbs",
  "exerciseCalories",
  "steps",
  "note",
];

const settingFields = Object.keys(defaultSettings);

let entries = loadEntries();
let settings = loadSettings();

const $ = (id) => document.getElementById(id);

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(settingsKey) || "{}") };
  } catch {
    return { ...defaultSettings };
  }
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fmt(value, suffix = "", digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function todayString() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function sortedEntries() {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function lastDays(days) {
  return sortedEntries().slice(-days);
}

function average(items, key) {
  const values = items.map((item) => item[key]).filter((value) => value !== null && value !== undefined);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(items, key) {
  return items.reduce((total, item) => total + (item[key] || 0), 0);
}

function getAnalysis() {
  const ordered = sortedEntries();
  const recent = ordered.slice(-7);
  const previous = ordered.slice(-14, -7);
  const latest = ordered.at(-1) || null;
  const firstRecentWeight = recent.find((entry) => entry.weight !== null)?.weight ?? null;
  const latestWeight = [...recent].reverse().find((entry) => entry.weight !== null)?.weight ?? null;
  const previousAvgWeight = average(previous, "weight");
  const recentAvgWeight = average(recent, "weight");
  const weightChange7 = firstRecentWeight !== null && latestWeight !== null ? latestWeight - firstRecentWeight : null;
  const trendVsPrevious = recentAvgWeight !== null && previousAvgWeight !== null ? recentAvgWeight - previousAvgWeight : null;
  const avgCalories = average(recent, "calories");
  const avgProtein = average(recent, "protein");
  const avgFat = average(recent, "fat");
  const avgCarbs = average(recent, "carbs");
  const avgSteps = average(recent, "steps");
  const weeklyExercise = sum(recent, "exerciseCalories");
  const targetDailyDeficit = (settings.weeklyPace * 7700) / 7;
  const targetCalories = Math.max(1200, settings.baseCalories - targetDailyDeficit);

  return {
    ordered,
    recent,
    latest,
    latestWeight,
    weightChange7,
    trendVsPrevious,
    avgCalories,
    avgProtein,
    avgFat,
    avgCarbs,
    avgSteps,
    weeklyExercise,
    targetCalories,
  };
}

function buildRecommendations(analysis) {
  if (!analysis.recent.length) {
    return [
      {
        type: "info",
        title: "まず3日分の記録を作る",
        body: "体重、食事、PFC、運動を入力すると、摂取量と活動量のズレから翌日の調整案を出します。",
      },
    ];
  }

  const currentWeight = analysis.latestWeight || analysis.latest?.weight || settings.targetWeight;
  const proteinTarget = Math.round(currentWeight * settings.proteinPerKg);
  const caloriesGap = analysis.avgCalories !== null ? analysis.avgCalories - analysis.targetCalories : null;
  const losingTooFast = analysis.weightChange7 !== null && analysis.weightChange7 < -settings.weeklyPace * 1.4;
  const losingTooSlow = analysis.weightChange7 !== null && analysis.weightChange7 > -settings.weeklyPace * 0.45;
  const recommendations = [];

  let calorieAdjustment = 0;
  if (losingTooFast) calorieAdjustment = 120;
  if (losingTooSlow) calorieAdjustment = -150;
  if (!losingTooFast && !losingTooSlow && caloriesGap !== null && Math.abs(caloriesGap) > 180) {
    calorieAdjustment = caloriesGap > 0 ? -100 : 100;
  }

  const tomorrowCalories = Math.round(analysis.targetCalories + calorieAdjustment);
  const fatTarget = Math.max(settings.minFat, Math.round(tomorrowCalories * 0.22 / 9));
  const carbTarget = Math.max(60, Math.round((tomorrowCalories - proteinTarget * 4 - fatTarget * 9) / 4));

  recommendations.push({
    type: calorieAdjustment < 0 ? "warn" : "info",
    title: `明日の摂取目安: ${tomorrowCalories} kcal`,
    body: `P ${proteinTarget}g / F ${fatTarget}g / C ${carbTarget}g を目安にします。直近7日の平均摂取は ${fmt(analysis.avgCalories, " kcal")} です。`,
  });

  if (analysis.avgProtein !== null && analysis.avgProtein < proteinTarget * 0.9) {
    recommendations.push({
      type: "warn",
      title: "タンパク質を優先",
      body: `直近平均が ${fmt(analysis.avgProtein, "g")} なので、明日は ${proteinTarget}g 近くまで上げると筋量維持に寄せやすいです。`,
    });
  }

  if (analysis.avgFat !== null && analysis.avgFat < settings.minFat) {
    recommendations.push({
      type: "warn",
      title: "脂質を下げすぎない",
      body: `脂質平均が ${fmt(analysis.avgFat, "g")} です。最低 ${settings.minFat}g は確保して、調子と継続性を守ります。`,
    });
  }

  if (analysis.avgSteps !== null && analysis.avgSteps < settings.targetSteps) {
    const addSteps = Math.ceil((settings.targetSteps - analysis.avgSteps) / 500) * 500;
    recommendations.push({
      type: "info",
      title: `歩数を +${addSteps} 歩`,
      body: `食事を大きく削る前に、日常活動を目標 ${settings.targetSteps} 歩へ近づけます。`,
    });
  }

  if (recommendations.length === 1 && !losingTooFast && !losingTooSlow) {
    recommendations.push({
      type: "good",
      title: "現状維持で観察",
      body: "体重変化が目標ペース付近です。明日は同じ設計で続け、週平均で判断します。",
    });
  }

  return recommendations;
}

function renderSummary() {
  const analysis = getAnalysis();
  $("currentWeight").textContent = analysis.latestWeight !== null ? fmt(analysis.latestWeight, " kg", 1) : "-- kg";
  $("weightDelta").textContent =
    analysis.weightChange7 !== null ? `7日変化 ${analysis.weightChange7 > 0 ? "+" : ""}${fmt(analysis.weightChange7, " kg", 1)}` : "記録待ち";
  $("avgCalories").textContent = analysis.avgCalories !== null ? fmt(analysis.avgCalories, " kcal") : "-- kcal";
  $("calorieBalance").textContent = `目安 ${fmt(analysis.targetCalories, " kcal")}`;
  $("weeklyExercise").textContent = analysis.recent.length ? fmt(analysis.weeklyExercise, " kcal") : "-- kcal";
  $("exerciseTrend").textContent = analysis.avgSteps !== null ? `平均 ${fmt(analysis.avgSteps, "歩")}` : "運動入力待ち";

  const recommendations = buildRecommendations(analysis);
  $("tomorrowFocus").textContent = recommendations[0]?.title.replace("明日の摂取目安: ", "") || "--";
  $("tomorrowSummary").textContent = analysis.recent.length >= 3 ? "直近7日から算出" : "記録を増やすと精度向上";
  $("recordCount").textContent = `${entries.length}件`;
  $("confidence").textContent = entries.length >= 7 ? "7日分析" : entries.length >= 3 ? "暫定分析" : "初期分析";

  $("recommendations").innerHTML = recommendations
    .map(
      (item) => `
        <article class="recommendation ${item.type}">
          <strong>${item.title}</strong>
          <p>${item.body}</p>
        </article>
      `
    )
    .join("");
}

function renderHistory() {
  const body = $("historyBody");
  const ordered = sortedEntries().reverse();
  if (!ordered.length) {
    body.innerHTML = `<tr><td class="empty-state" colspan="7">まだ記録がありません。</td></tr>`;
    return;
  }

  body.innerHTML = ordered
    .map(
      (entry) => `
        <tr>
          <td>${entry.date}</td>
          <td>${fmt(entry.weight, "kg", 1)}</td>
          <td>${fmt(entry.calories, "kcal")}</td>
          <td>${fmt(entry.protein, "g")} / ${fmt(entry.fat, "g")} / ${fmt(entry.carbs, "g")}</td>
          <td>${fmt(entry.exerciseCalories, "kcal")}</td>
          <td>${fmt(entry.steps, "歩")}</td>
          <td><button class="icon-button" type="button" data-delete="${entry.date}" aria-label="${entry.date}を削除">x</button></td>
        </tr>
      `
    )
    .join("");
}

function drawChart() {
  const canvas = $("trendChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = 42;
  const data = sortedEntries().slice(-21);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfa";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d9dfd3";
  ctx.lineWidth = 1;

  for (let i = 0; i < 4; i += 1) {
    const y = pad + ((height - pad * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  if (data.length < 2) {
    ctx.fillStyle = "#607066";
    ctx.font = "16px system-ui";
    ctx.fillText("2件以上の記録でグラフを表示します", pad, height / 2);
    return;
  }

  const weights = data.map((entry) => entry.weight).filter((value) => value !== null);
  const calories = data.map((entry) => entry.calories).filter((value) => value !== null);
  const minWeight = Math.min(...weights) - 0.5;
  const maxWeight = Math.max(...weights) + 0.5;
  const minCalories = Math.min(...calories, getAnalysis().targetCalories) - 150;
  const maxCalories = Math.max(...calories, getAnalysis().targetCalories) + 150;
  const xFor = (index) => pad + ((width - pad * 2) / Math.max(1, data.length - 1)) * index;
  const yWeight = (value) => height - pad - ((value - minWeight) / Math.max(1, maxWeight - minWeight)) * (height - pad * 2);
  const yCalories = (value) => height - pad - ((value - minCalories) / Math.max(1, maxCalories - minCalories)) * (height - pad * 2);

  drawLine(ctx, data, "weight", xFor, yWeight, "#276b55");
  drawLine(ctx, data, "calories", xFor, yCalories, "#c26a3a");

  ctx.fillStyle = "#276b55";
  ctx.fillRect(pad, 14, 12, 12);
  ctx.fillStyle = "#17211b";
  ctx.font = "13px system-ui";
  ctx.fillText("体重", pad + 18, 25);
  ctx.fillStyle = "#c26a3a";
  ctx.fillRect(pad + 70, 14, 12, 12);
  ctx.fillStyle = "#17211b";
  ctx.fillText("摂取kcal", pad + 88, 25);
}

function drawLine(ctx, data, key, xFor, yFor, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  let started = false;
  data.forEach((entry, index) => {
    if (entry[key] === null || entry[key] === undefined) return;
    const x = xFor(index);
    const y = yFor(entry[key]);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  data.forEach((entry, index) => {
    if (entry[key] === null || entry[key] === undefined) return;
    ctx.beginPath();
    ctx.arc(xFor(index), yFor(entry[key]), 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function render() {
  renderSummary();
  renderHistory();
  drawChart();
}

function fillSettings() {
  settingFields.forEach((key) => {
    $(key).value = settings[key];
  });
}

function upsertEntry(entry) {
  entries = entries.filter((item) => item.date !== entry.date);
  entries.push(entry);
  saveEntries();
}

function exportCsv() {
  const header = ["date", "weight", "bodyFat", "calories", "protein", "fat", "carbs", "exerciseCalories", "steps", "note"];
  const rows = sortedEntries().map((entry) =>
    header.map((key) => `"${String(entry[key] ?? "").replaceAll('"', '""')}"`).join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bodytune-${todayString()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function seedData() {
  const start = new Date();
  start.setDate(start.getDate() - 13);
  entries = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      date: iso,
      weight: Number((72.6 - index * 0.08 + Math.sin(index) * 0.18).toFixed(1)),
      bodyFat: Number((19.5 - index * 0.05).toFixed(1)),
      calories: 2110 + Math.round(Math.sin(index * 1.7) * 140),
      protein: 135 + (index % 4) * 4,
      fat: 48 + (index % 3) * 5,
      carbs: 230 + (index % 5) * 12,
      exerciseCalories: index % 3 === 0 ? 420 : index % 2 === 0 ? 260 : 120,
      steps: 7600 + (index % 6) * 650,
      note: index % 4 === 0 ? "筋トレあり" : "",
    };
  });
  saveEntries();
  render();
}

$("date").value = todayString();
fillSettings();
render();

$("entryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const entry = Object.fromEntries(fields.map((key) => [key, key === "date" || key === "note" ? form.get(key) : toNumber(form.get(key))]));
  upsertEntry(entry);
  event.currentTarget.reset();
  $("date").value = todayString();
  render();
});

$("saveSettings").addEventListener("click", () => {
  settings = Object.fromEntries(settingFields.map((key) => [key, toNumber($(key).value) ?? defaultSettings[key]]));
  saveSettings();
  render();
});

$("historyBody").addEventListener("click", (event) => {
  const date = event.target.dataset.delete;
  if (!date) return;
  entries = entries.filter((entry) => entry.date !== date);
  saveEntries();
  render();
});

$("clearButton").addEventListener("click", () => {
  if (!confirm("すべての記録を削除しますか？")) return;
  entries = [];
  saveEntries();
  render();
});

$("seedButton").addEventListener("click", seedData);
$("exportButton").addEventListener("click", exportCsv);
