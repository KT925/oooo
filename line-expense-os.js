const storageKey = "line-expense-os.expenses.v1";

let expenses = loadExpenses();
let receiptDataUrl = "";

const $ = (id) => document.getElementById(id);

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(storageKey, JSON.stringify(expenses));
}

function yen(value) {
  return `${Number(value || 0).toLocaleString("ja-JP")}円`;
}

function getFormData() {
  return {
    id: $("editingId").value || crypto.randomUUID(),
    spentOn: $("spentOn").value,
    amount: Number($("amount").value || 0),
    merchant: $("merchant").value.trim(),
    category: $("category").value,
    status: $("status").value,
    source: $("source").value,
    memo: $("memo").value.trim(),
    receiptDataUrl,
    updatedAt: new Date().toISOString(),
  };
}

function setFormData(expense) {
  $("editingId").value = expense.id;
  $("spentOn").value = expense.spentOn;
  $("amount").value = expense.amount;
  $("merchant").value = expense.merchant;
  $("category").value = expense.category;
  $("status").value = expense.status;
  $("source").value = expense.source;
  $("memo").value = expense.memo;
  receiptDataUrl = expense.receiptDataUrl || "";
  renderReceiptPreview();
  $("editingLabel").textContent = "編集中";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  $("expenseForm").reset();
  $("spentOn").value = today();
  $("editingId").value = "";
  $("editingLabel").textContent = "新規";
  receiptDataUrl = "";
  renderReceiptPreview();
}

function filteredExpenses() {
  const category = $("categoryFilter").value;
  return expenses
    .filter((expense) => category === "ALL" || expense.category === category)
    .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.updatedAt.localeCompare(a.updatedAt));
}

function renderStats() {
  const currentMonth = today().slice(0, 7);
  const monthExpenses = expenses.filter((expense) => expense.spentOn?.startsWith(currentMonth));
  const total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});
  const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "--";

  $("monthTotal").textContent = yen(total);
  $("pendingCount").textContent = expenses.filter((expense) => expense.status === "pending").length;
  $("receiptCount").textContent = expenses.filter((expense) => expense.receiptDataUrl).length;
  $("topCategory").textContent = top;
}

function renderTable() {
  const body = $("expenseBody");
  const rows = filteredExpenses();
  if (!rows.length) {
    body.innerHTML = `<tr><td class="empty" colspan="7">支出データがありません。</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map(
      (expense) => `
        <tr>
          <td>${escapeHtml(expense.spentOn)}</td>
          <td>${escapeHtml(expense.merchant || "未入力")}</td>
          <td>${yen(expense.amount)}</td>
          <td>${escapeHtml(expense.category)}</td>
          <td>${escapeHtml(expense.status)}</td>
          <td>${escapeHtml(expense.source)}</td>
          <td>
            <button class="small-button" type="button" data-edit="${expense.id}">編集</button>
            <button class="small-button" type="button" data-delete="${expense.id}">削除</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderReceiptPreview() {
  $("receiptPreview").innerHTML = receiptDataUrl ? `<img src="${receiptDataUrl}" alt="領収書プレビュー">` : "";
}

function render() {
  renderStats();
  renderTable();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function seedExpenses() {
  const samples = [
    { spentOn: today(), merchant: "スターバックス", amount: 680, category: "カフェ", status: "confirmed", source: "line_text", memo: "作業" },
    { spentOn: today(), merchant: "タクシー", amount: 2400, category: "交通費", status: "pending", source: "line_text", memo: "移動" },
    { spentOn: today(), merchant: "ドラッグストア", amount: 3280, category: "美容", status: "confirmed", source: "line_receipt", memo: "スキンケア" },
  ];
  expenses = [
    ...expenses,
    ...samples.map((expense) => ({
      ...expense,
      id: crypto.randomUUID(),
      receiptDataUrl: "",
      updatedAt: new Date().toISOString(),
    })),
  ];
  saveExpenses();
  render();
}

function exportCsv() {
  const header = ["spentOn", "merchant", "amount", "category", "status", "source", "memo"];
  const rows = expenses.map((expense) =>
    header.map((key) => `"${String(expense[key] || "").replaceAll('"', '""')}"`).join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `line-expenses-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

$("spentOn").value = today();
render();

$("expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const expense = getFormData();
  expenses = expenses.filter((item) => item.id !== expense.id);
  expenses.push(expense);
  saveExpenses();
  resetForm();
  render();
});

$("receiptImage").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    receiptDataUrl = "";
    renderReceiptPreview();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    receiptDataUrl = String(reader.result || "");
    renderReceiptPreview();
  };
  reader.readAsDataURL(file);
});

$("expenseBody").addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) {
    const expense = expenses.find((item) => item.id === editId);
    if (expense) setFormData(expense);
  }
  if (deleteId) {
    expenses = expenses.filter((item) => item.id !== deleteId);
    saveExpenses();
    render();
  }
});

$("resetButton").addEventListener("click", resetForm);
$("seedButton").addEventListener("click", seedExpenses);
$("exportButton").addEventListener("click", exportCsv);
$("categoryFilter").addEventListener("change", renderTable);
