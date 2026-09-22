const contentKey = "instagram-content-os.ideas.v1";

const pillarColors = {
  BODY: "#4d6c56",
  BEAUTY: "#a64f65",
  TRAVEL: "#4e648a",
  MIND: "#a56d2b",
  LIFE: "#6b5b4b",
};

const sampleIdeas = [
  {
    pillar: "BODY",
    format: "Reel",
    publishDate: offsetDate(1),
    status: "Script",
    title: "169cm女子の大会までの体作り 30日目",
    hook: "体重より先に見るべき変化はここ",
    memo: "朝の体、食事、トレーニング、今日の気づきを15秒でテンポよく。",
  },
  {
    pillar: "BEAUTY",
    format: "Carousel",
    publishDate: offsetDate(2),
    status: "Idea",
    title: "美容医療を受ける前に確認したい3つのこと",
    hook: "施術名だけで選ぶ前に、ここを見て",
    memo: "看護師視点でカウンセリング、リスク、ダウンタイムを整理。",
  },
  {
    pillar: "MIND",
    format: "Reel",
    publishDate: offsetDate(3),
    status: "Shooting",
    title: "自分との約束を守る人になる",
    hook: "自信は気合いではなく、約束を守った回数で育つ",
    memo: "朝支度、ジム、仕事終わりのカット。短い語りで保存される投稿に。",
  },
  {
    pillar: "TRAVEL",
    format: "Photo",
    publishDate: offsetDate(5),
    status: "Editing",
    title: "シドニーで泊まってよかったホテル記録",
    hook: "旅先でも自分の機嫌を整えるホテル選び",
    memo: "写真5枚。ホテル、朝食、街歩き、鏡写真、夜景。",
  },
  {
    pillar: "LIFE",
    format: "Reel",
    publishDate: offsetDate(7),
    status: "Idea",
    title: "東京で過ごす整える休日Vlog",
    hook: "頑張るために、休む日もちゃんと選ぶ",
    memo: "カフェ、散歩、買い物、作り置き、夜のスキンケア。",
  },
];

let ideas = loadIdeas();

const $ = (id) => document.getElementById(id);

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function loadIdeas() {
  try {
    return JSON.parse(localStorage.getItem(contentKey) || "[]");
  } catch {
    return [];
  }
}

function saveIdeas() {
  localStorage.setItem(contentKey, JSON.stringify(ideas));
}

function getFormData() {
  return {
    id: $("editingId").value || crypto.randomUUID(),
    pillar: $("pillar").value,
    format: $("format").value,
    publishDate: $("publishDate").value,
    status: $("status").value,
    title: $("title").value.trim(),
    hook: $("hook").value.trim(),
    memo: $("memo").value.trim(),
    updatedAt: new Date().toISOString(),
  };
}

function setFormData(idea) {
  $("editingId").value = idea.id;
  $("pillar").value = idea.pillar;
  $("format").value = idea.format;
  $("publishDate").value = idea.publishDate;
  $("status").value = idea.status;
  $("title").value = idea.title;
  $("hook").value = idea.hook;
  $("memo").value = idea.memo;
  $("editingLabel").textContent = "編集中";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  $("ideaForm").reset();
  $("editingId").value = "";
  $("editingLabel").textContent = "新規";
}

function isThisWeek(dateString) {
  if (!dateString) return false;
  const now = new Date();
  const date = new Date(`${dateString}T00:00:00`);
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function filteredIdeas() {
  const pillar = $("pillarFilter").value;
  const status = $("statusFilter").value;
  return ideas
    .filter((idea) => pillar === "ALL" || idea.pillar === pillar)
    .filter((idea) => status === "ALL" || idea.status === status)
    .sort((a, b) => {
      if (!a.publishDate && !b.publishDate) return b.updatedAt.localeCompare(a.updatedAt);
      if (!a.publishDate) return 1;
      if (!b.publishDate) return -1;
      return a.publishDate.localeCompare(b.publishDate);
    });
}

function balanceLabel() {
  if (!ideas.length) return "--";
  const counts = ["BODY", "BEAUTY", "TRAVEL", "MIND", "LIFE"].map(
    (pillar) => ideas.filter((idea) => idea.pillar === pillar).length
  );
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (max - min <= 1) return "良好";
  if (max - min <= 3) return "調整中";
  return "偏りあり";
}

function renderStats() {
  $("totalIdeas").textContent = ideas.length;
  $("weeklyIdeas").textContent = ideas.filter((idea) => isThisWeek(idea.publishDate)).length;
  $("activeIdeas").textContent = ideas.filter((idea) => !["Posted", "Scheduled"].includes(idea.status)).length;
  $("balanceScore").textContent = balanceLabel();
}

function renderBoard() {
  const board = $("contentBoard");
  const visibleIdeas = filteredIdeas();
  if (!visibleIdeas.length) {
    board.innerHTML = `<div class="empty">投稿案がありません。「初期案を追加」または左のフォームから作成してください。</div>`;
    return;
  }

  board.innerHTML = visibleIdeas
    .map(
      (idea) => `
        <article class="idea-card">
          <div class="idea-top">
            <span class="pillar-tag" style="background:${pillarColors[idea.pillar]}">${idea.pillar}</span>
            <span class="pill">${idea.status}</span>
          </div>
          <div>
            <h3 class="idea-title">${escapeHtml(idea.title)}</h3>
            <p class="idea-hook">${escapeHtml(idea.hook || "Hook未設定")}</p>
          </div>
          <p class="idea-body">${escapeHtml(idea.memo || "メモ未設定")}</p>
          <div class="idea-meta">
            <span>${idea.format}</span>
            <span>${idea.publishDate || "日付未定"}</span>
          </div>
          <div class="idea-actions">
            <button class="small-button" type="button" data-edit="${idea.id}">編集</button>
            <button class="small-button delete-button" type="button" data-delete="${idea.id}">削除</button>
          </div>
        </article>
      `
    )
    .join("");
}

function render() {
  renderStats();
  renderBoard();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportCsv() {
  const header = ["pillar", "format", "publishDate", "status", "title", "hook", "memo"];
  const rows = ideas.map((idea) =>
    header.map((key) => `"${String(idea[key] || "").replaceAll('"', '""')}"`).join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `instagram-content-os-${offsetDate(0)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

$("ideaForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const idea = getFormData();
  ideas = ideas.filter((item) => item.id !== idea.id);
  ideas.push(idea);
  saveIdeas();
  resetForm();
  render();
});

$("resetForm").addEventListener("click", resetForm);

$("seedIdeas").addEventListener("click", () => {
  const existingTitles = new Set(ideas.map((idea) => idea.title));
  const nextIdeas = sampleIdeas
    .filter((idea) => !existingTitles.has(idea.title))
    .map((idea) => ({ ...idea, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }));
  ideas = [...ideas, ...nextIdeas];
  saveIdeas();
  render();
});

$("exportCsv").addEventListener("click", exportCsv);
$("pillarFilter").addEventListener("change", renderBoard);
$("statusFilter").addEventListener("change", renderBoard);

$("contentBoard").addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) {
    const idea = ideas.find((item) => item.id === editId);
    if (idea) setFormData(idea);
  }
  if (deleteId) {
    ideas = ideas.filter((item) => item.id !== deleteId);
    saveIdeas();
    render();
  }
});

render();
