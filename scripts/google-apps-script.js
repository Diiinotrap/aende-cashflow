const SHEET_NAME = "Transaksi";
const DRIVE_FOLDER_NAME = "AENDE CASHFLOW - Nota";

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(spreadsheet);
  const receipt = saveReceiptToDrive_(data);

  sheet.appendRow([
    data.id,
    data.createdAt,
    data.date,
    data.type,
    data.category,
    data.description,
    Number(data.amount || 0),
    data.paymentMethod,
    data.receiptName || "",
    receipt.url || "",
    receipt.fileId || "",
    new Date(),
    data.syncStatus || "synced"
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: "Data masuk ke Google Sheets. Nota tersimpan di Google Drive.",
      receiptUrl: receipt.url || "",
      receiptFileId: receipt.fileId || ""
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(spreadsheet);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return json_({ ok: true, transactions: [] });
  }

  const headers = values[0];
  const transactions = values.slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = normalizeCell_(row[index]);
      });
      return {
        id: item.ID,
        createdAt: item["Created At"],
        date: item.Tanggal,
        type: item.Tipe,
        category: item.Kategori,
        description: item.Deskripsi,
        amount: item.Jumlah,
        paymentMethod: item["Metode Pembayaran"],
        receiptName: item["Nama Nota"],
        receiptUrl: item["URL Nota"],
        receiptFileId: item["Drive File ID"],
        syncedAt: item["Synced At"],
        syncStatus: item.Status
      };
    });

  return json_({ ok: true, transactions });
}

function getOrCreateSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "ID",
      "Created At",
      "Tanggal",
      "Tipe",
      "Kategori",
      "Deskripsi",
      "Jumlah",
      "Metode Pembayaran",
      "Nama Nota",
      "URL Nota",
      "Drive File ID",
      "Synced At",
      "Status"
    ]);
  }

  return sheet;
}

function saveReceiptToDrive_(data) {
  if (!data.receiptData || !data.receiptName) {
    return { url: "", fileId: "" };
  }

  const folder = getOrCreateFolder_(DRIVE_FOLDER_NAME);
  const match = String(data.receiptData).match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return { url: "", fileId: "" };
  }

  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = String(data.receiptName).replace(/[\\/:*?"<>|]/g, "-");
  const fileName = `${data.date || "tanpa-tanggal"}-${Date.now()}-${safeName}`;
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    url: file.getUrl(),
    fileId: file.getId()
  };
}

function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(name);
}

function normalizeCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return value;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
