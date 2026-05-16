const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const state = {
  transactions: [],
  sheetsConfigured: false,
  receiptData: "",
  receiptName: ""
};

const elements = {
  form: document.querySelector("#transactionForm"),
  receiptInput: document.querySelector("#receiptInput"),
  receiptName: document.querySelector("#receiptName"),
  exportButton: document.querySelector("#exportButton"),
  seedButton: document.querySelector("#seedButton"),
  resyncButton: document.querySelector("#resyncButton"),
  syncBadge: document.querySelector("#syncBadge"),
  sheetsStatus: document.querySelector("#sheetsStatus"),
  metricBalance: document.querySelector("#metricBalance"),
  metricIncome: document.querySelector("#metricIncome"),
  metricExpense: document.querySelector("#metricExpense"),
  metricWeekly: document.querySelector("#metricWeekly"),
  weeklyIncome: document.querySelector("#weeklyIncome"),
  weeklyExpense: document.querySelector("#weeklyExpense"),
  weeklyNet: document.querySelector("#weeklyNet"),
  weekRange: document.querySelector("#weekRange"),
  incomeBar: document.querySelector("#incomeBar"),
  expenseRows: document.querySelector("#expenseRows"),
  incomeRows: document.querySelector("#incomeRows"),
  expenseCount: document.querySelector("#expenseCount"),
  incomeCount: document.querySelector("#incomeCount"),
  dailyRows: document.querySelector("#dailyRows"),
  toastRegion: document.querySelector("#toastRegion")
};

function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseDate(dateString) {
  if (dateString instanceof Date) return dateString;
  const value = String(dateString || "");
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(parseDate(dateString));
}

function startOfWeek(date = new Date()) {
  const value = new Date(date);
  const day = value.getDay() || 7;
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - day + 1);
  return value;
}

function endOfWeek(date = new Date()) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
}

function isThisMonth(transaction) {
  const current = new Date();
  const date = parseDate(transaction.date);
  return current.getMonth() === date.getMonth() && current.getFullYear() === date.getFullYear();
}

function isThisWeek(transaction) {
  const date = parseDate(transaction.date);
  return date >= startOfWeek() && date <= endOfWeek();
}

function sum(transactions, type) {
  return transactions
    .filter((transaction) => !type || transaction.type === type)
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
}

function transactionRows(transactions, emptyMessage) {
  if (!transactions.length) {
    return `<tr><td colspan="5" class="empty-row">${emptyMessage}</td></tr>`;
  }

  return transactions
    .slice(0, 8)
    .map((transaction) => {
      const amountClass = transaction.type === "income" ? "positive" : "negative";
      return `
        <tr>
          <td>${formatDate(transaction.date)}</td>
          <td>${transaction.description}</td>
          <td>${transaction.category}</td>
          <td>${receiptCell(transaction)}</td>
          <td class="${amountClass}">${currency.format(Number(transaction.amount))}</td>
        </tr>
      `;
    })
    .join("");
}

function receiptCell(transaction) {
  if (transaction.receiptUrl) {
    return `<a class="receipt-chip" href="${transaction.receiptUrl}" target="_blank" rel="noreferrer">Lihat nota</a>`;
  }
  return `<span class="receipt-chip">${transaction.receiptName ? "Ada nota" : "Tanpa nota"}</span>`;
}

function showToast(title, message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  elements.toastRegion.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4200);
}

function dailySummaryRows(transactions) {
  const grouped = transactions.reduce((result, transaction) => {
    result[transaction.date] ||= { income: 0, expense: 0 };
    result[transaction.date][transaction.type] += Number(transaction.amount || 0);
    return result;
  }, {});

  const rows = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7);

  if (!rows.length) {
    return `<div class="daily-row"><strong>Belum ada transaksi</strong><span>Input transaksi pertama untuk melihat ringkasan.</span></div>`;
  }

  return rows
    .map(([date, value]) => {
      const net = value.income - value.expense;
      return `
        <div class="daily-row">
          <div>
            <strong>${formatDate(date)}</strong>
            <span>Pemasukan ${currency.format(value.income)} | Pengeluaran ${currency.format(value.expense)}</span>
          </div>
          <strong class="${net >= 0 ? "positive" : "negative"}">${currency.format(net)}</strong>
        </div>
      `;
    })
    .join("");
}

function render() {
  const monthTransactions = state.transactions.filter(isThisMonth);
  const weekTransactions = state.transactions.filter(isThisWeek);
  const incomeMonth = sum(monthTransactions, "income");
  const expenseMonth = sum(monthTransactions, "expense");
  const incomeWeek = sum(weekTransactions, "income");
  const expenseWeek = sum(weekTransactions, "expense");
  const balance = sum(state.transactions, "income") - sum(state.transactions, "expense");
  const weeklyNet = incomeWeek - expenseWeek;
  const totalWeek = incomeWeek + expenseWeek;
  const incomeWidth = totalWeek ? Math.round((incomeWeek / totalWeek) * 100) : 0;
  const expenseWidth = totalWeek ? 100 - incomeWidth : 0;

  elements.metricBalance.textContent = currency.format(balance);
  elements.metricBalance.className = balance >= 0 ? "positive" : "negative";
  elements.metricIncome.textContent = currency.format(incomeMonth);
  elements.metricExpense.textContent = currency.format(expenseMonth);
  elements.metricWeekly.textContent = currency.format(weeklyNet);
  elements.metricWeekly.className = weeklyNet >= 0 ? "positive" : "negative";
  elements.weeklyIncome.textContent = currency.format(incomeWeek);
  elements.weeklyExpense.textContent = currency.format(expenseWeek);
  elements.weeklyNet.textContent = currency.format(weeklyNet);
  elements.weeklyNet.className = weeklyNet >= 0 ? "positive" : "negative";
  elements.weekRange.textContent = `${formatDate(startOfWeek())} - ${formatDate(endOfWeek())}`;
  document.documentElement.style.setProperty("--income-width", `${incomeWidth}%`);
  document.documentElement.style.setProperty("--expense-width", `${expenseWidth}%`);

  const expenses = state.transactions.filter((transaction) => transaction.type === "expense");
  const incomes = state.transactions.filter((transaction) => transaction.type === "income");
  elements.expenseRows.innerHTML = transactionRows(expenses, "Belum ada laporan pengeluaran.");
  elements.incomeRows.innerHTML = transactionRows(incomes, "Belum ada laporan pemasukan.");
  elements.expenseCount.textContent = `${expenses.length} item`;
  elements.incomeCount.textContent = `${incomes.length} item`;
  elements.dailyRows.innerHTML = dailySummaryRows(state.transactions);

  const configuredText = state.sheetsConfigured ? "Google Sheets aktif" : "Mode lokal";
  elements.syncBadge.textContent = configuredText;
  elements.sheetsStatus.textContent = state.sheetsConfigured
    ? "Data baru otomatis dikirim ke Google Spreadsheet, dan foto nota masuk ke Google Drive jika script aktif."
    : "Atur GOOGLE_SHEETS_WEBHOOK_URL atau config.local.json untuk mengaktifkan sinkron otomatis.";
}

async function loadTransactions() {
  const response = await fetch("/api/transactions");
  const payload = await response.json();
  state.transactions = payload.transactions || [];
  state.sheetsConfigured = Boolean(payload.sheetsConfigured);
  render();
}

function readReceipt(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Ukuran foto nota maksimal 5MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca foto nota."));
    reader.readAsDataURL(file);
  });
}

async function saveTransaction(data) {
  const response = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Gagal menyimpan transaksi.");
  state.transactions.unshift(payload.transaction);
  state.sheetsConfigured = Boolean(payload.sync?.configured);
  return payload;
}

function seedData() {
  const today = new Date();
  const samples = [
    ["income", "Pendapatan", "Pembayaran Project A", 10000000, 0],
    ["expense", "Operasional", "Pembelian ATK kantor", 150000, 0],
    ["expense", "Transportasi", "Transportasi Dinas", 200000, 1],
    ["income", "Penjualan", "Penjualan Produk", 5250000, 2],
    ["expense", "Konsumsi", "Makan Siang Tim", 180000, 2],
    ["income", "Project", "Uang Muka Project C", 10500000, 4]
  ];

  state.transactions = samples.map(([type, category, description, amount, daysAgo], index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    return {
      id: `sample_${index}`,
      createdAt: new Date().toISOString(),
      date: toDateInput(date),
      type,
      category,
      description,
      amount,
      paymentMethod: index % 2 ? "Transfer Bank" : "Tunai",
      receiptName: type === "expense" ? "nota-contoh.jpg" : "",
      receiptData: "",
      syncStatus: "local"
    };
  });
  render();
}

elements.form.date.value = toDateInput();

elements.receiptInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  try {
    state.receiptData = await readReceipt(file);
    state.receiptName = file?.name || "";
    elements.receiptName.textContent = state.receiptName || "Klik untuk upload JPG/PNG maks. 5MB";
  } catch (error) {
    showToast("Foto nota gagal dibaca", error.message, "error");
    event.target.value = "";
  }
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const transaction = {
    type: formData.get("type"),
    date: formData.get("date"),
    category: formData.get("category"),
    description: formData.get("description").trim(),
    amount: Number(formData.get("amount")),
    paymentMethod: formData.get("paymentMethod"),
    receiptName: state.receiptName,
    receiptData: state.receiptData
  };

  try {
    const submitButton = elements.form.querySelector("[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Menyimpan...";
    const result = await saveTransaction(transaction);
    render();
    elements.form.reset();
    elements.form.date.value = toDateInput();
    state.receiptData = "";
    state.receiptName = "";
    elements.receiptName.textContent = "Klik untuk upload JPG/PNG maks. 5MB";
    showToast("Transaksi tersimpan", result.sync?.message || "Data berhasil masuk ke laporan.", result.sync?.ok === false ? "error" : "success");
  } catch (error) {
    showToast("Transaksi gagal disimpan", error.message, "error");
  } finally {
    const submitButton = elements.form.querySelector("[type='submit']");
    submitButton.disabled = false;
    submitButton.textContent = "Simpan Transaksi";
  }
});

elements.form.addEventListener("reset", () => {
  setTimeout(() => {
    elements.form.date.value = toDateInput();
    state.receiptData = "";
    state.receiptName = "";
    elements.receiptName.textContent = "Klik untuk upload JPG/PNG maks. 5MB";
  }, 0);
});

elements.exportButton.addEventListener("click", () => {
  window.print();
});

elements.seedButton.addEventListener("click", seedData);
elements.resyncButton.addEventListener("click", loadTransactions);

loadTransactions().catch(() => {
  seedData();
});

setInterval(() => {
  loadTransactions().catch(() => {});
}, 15000);
