const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "transactions.json");
const CONFIG_FILE = path.join(__dirname, "config.local.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function getSheetsWebhookUrl() {
  const config = readConfig();
  return process.env.GOOGLE_SHEETS_WEBHOOK_URL || config.googleSheetsWebhookUrl || "";
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]\n", "utf8");
}

function readTransactions() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeTransactions(transactions) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(transactions, null, 2), "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error("Payload terlalu besar."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function syncToGoogleSheets(transaction) {
  const SHEETS_WEBHOOK_URL = getSheetsWebhookUrl();
  if (!SHEETS_WEBHOOK_URL) {
    return {
      configured: false,
      ok: true,
      message: "GOOGLE_SHEETS_WEBHOOK_URL belum diatur. Data tersimpan lokal."
    };
  }

  const response = await fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transaction)
  });

  if (!response.ok) {
    throw new Error(`Google Sheets webhook merespons ${response.status}`);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return {
    configured: true,
    ok: true,
    message: payload.message || "Tersinkron ke Google Sheets dan Google Drive.",
    receiptUrl: payload.receiptUrl || "",
    receiptFileId: payload.receiptFileId || ""
  };
}

function mapRemoteTransaction(row) {
  return {
    id: row.id || row.ID || `sheet_${row.createdAt || row["Created At"] || Math.random()}`,
    createdAt: row.createdAt || row["Created At"] || new Date().toISOString(),
    date: row.date || row.Tanggal || "",
    type: row.type || row.Tipe || "expense",
    category: row.category || row.Kategori || "",
    description: row.description || row.Deskripsi || "",
    amount: Number(row.amount || row.Jumlah || 0),
    paymentMethod: row.paymentMethod || row["Metode Pembayaran"] || "",
    receiptName: row.receiptName || row["Nama Nota"] || "",
    receiptUrl: row.receiptUrl || row["URL Nota"] || "",
    receiptFileId: row.receiptFileId || row["Drive File ID"] || "",
    syncedAt: row.syncedAt || row["Synced At"] || null,
    syncStatus: row.syncStatus || row.Status || "synced"
  };
}

async function readRemoteTransactions() {
  const SHEETS_WEBHOOK_URL = getSheetsWebhookUrl();
  if (!SHEETS_WEBHOOK_URL) return null;

  const response = await fetch(SHEETS_WEBHOOK_URL);
  if (!response.ok) {
    throw new Error(`Google Sheets webhook merespons ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.transactions)) return null;
  return payload.transactions.map(mapRemoteTransaction).filter((transaction) => transaction.date && transaction.description);
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/transactions") {
    const sheetsConfigured = Boolean(getSheetsWebhookUrl());
    if (sheetsConfigured) {
      try {
        const remoteTransactions = await readRemoteTransactions();
        if (remoteTransactions) {
          writeTransactions(remoteTransactions);
          sendJson(res, 200, { transactions: remoteTransactions, sheetsConfigured, source: "google-sheets" });
          return;
        }
      } catch {
        // Local cache remains useful when the spreadsheet is temporarily unreachable.
      }
    }
    sendJson(res, 200, { transactions: readTransactions(), sheetsConfigured, source: "local" });
    return;
  }

  if (req.method === "POST" && req.url === "/api/transactions") {
    try {
      const payload = JSON.parse(await readBody(req));
      const transactions = readTransactions();
      const transaction = {
        id: `trx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        syncedAt: null,
        syncStatus: "pending",
        ...payload
      };

      let syncResult;
      try {
        syncResult = await syncToGoogleSheets(transaction);
        transaction.syncStatus = syncResult.configured ? "synced" : "local";
        transaction.syncedAt = syncResult.configured ? new Date().toISOString() : null;
        transaction.receiptUrl = syncResult.receiptUrl || "";
        transaction.receiptFileId = syncResult.receiptFileId || "";
      } catch (error) {
        syncResult = { ok: false, message: error.message };
        transaction.syncStatus = "failed";
      }

      transactions.unshift(transaction);
      writeTransactions(transactions);
      sendJson(res, 201, { transaction, sync: syncResult });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Input tidak valid." });
    }
    return;
  }

  sendJson(res, 404, { error: "Endpoint tidak ditemukan." });
}

function serveStatic(req, res) {
  const cleanUrl = decodeURIComponent(req.url.split("?")[0]);
  const safePath = cleanUrl === "/" ? "/index.html" : cleanUrl;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`AENDE CASHFLOW berjalan di http://localhost:${PORT}`);
  console.log(getSheetsWebhookUrl() ? "Google Sheets webhook aktif." : "Mode lokal: GOOGLE_SHEETS_WEBHOOK_URL belum diatur.");
});
