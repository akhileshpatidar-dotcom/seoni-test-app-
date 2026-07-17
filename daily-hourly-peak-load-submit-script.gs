const SPREADSHEET_ID = "1dae1E0gTkwsKY3y-PgfFvBf_bHe0TS0YXAW7M3gzgEc";
const TARGET_SHEET_NAME = "DAILY HOURLY PEAK LOAD";
const TOTAL_COLS = 9;

function doPost(e) {
  try {
    const data = getRequestData_(e);
    const entries = Array.isArray(data.entries_json) ? data.entries_json : [];

    if (!entries.length) {
      throw new Error("Peak load entries missing hai");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateTargetSheet_(ss, TARGET_SHEET_NAME);
    const headers = getHeaders_();
    setupSheetLayout_(sheet, headers);

    const rows = entries.map(function(entry) {
      return [
        clean_(entry["33/11 KV SUBSTATION"] || entry.substation),
        clean_(entry["11 KV FEEDER"] || entry.feeder),
        clean_(entry["METER NO"] || entry.meter_no),
        clean_(entry["DATE (DD-MM-YYYY)"] || entry.date),
        clean_(entry["TIME (HH:MM)"] || entry.time),
        clean_(entry["PEAK LOAD (A)"] || entry.peak_load),
        clean_(entry["NAME OF OPERATOR"] || entry.operator_name),
        clean_(entry["SUBMISSION DATE"] || entry.submission_date),
        clean_(entry["SUBMISSION TIME"] || entry.submission_time)
      ];
    }).filter(function(row) {
      return row[0] && row[1] && row[3] && row[4];
    });

    if (!rows.length) {
      throw new Error("Valid peak load rows nahi mile");
    }

    const startRow = Math.max(sheet.getLastRow() + 1, 2);
    const range = sheet.getRange(startRow, 1, rows.length, TOTAL_COLS);
    range.setValues(rows);
    range
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

    ensureFilterIfMissing_(sheet, TOTAL_COLS);

    return jsonResponse_({
      status: "success",
      message: "Daily hourly peak load submit ho gaya",
      rows_saved: rows.length
    });
  } catch (error) {
    return jsonResponse_({
      status: "error",
      message: error && error.message ? error.message : "Unknown error"
    });
  }
}

function doGet(e) {
  const action = e && e.parameter ? clean_(e.parameter.action) : "";

  if (action === "getSummary") {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateTargetSheet_(ss, TARGET_SHEET_NAME);
    const headers = getHeaders_();
    setupSheetLayout_(sheet, headers);

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonResponse_([]);

    const values = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getDisplayValues();
    const rows = values.map(function(row) {
      return {
        substation: clean_(row[0]),
        feeder: clean_(row[1]),
        meter_no: clean_(row[2]),
        date: clean_(row[3]),
        time: clean_(row[4]),
        peak_load: clean_(row[5]),
        operator_name: clean_(row[6]),
        submission_date: clean_(row[7]),
        submission_time: clean_(row[8])
      };
    }).filter(function(row) {
      return row.substation && row.date;
    });

    return jsonResponse_(rows);
  }

  return jsonResponse_({
    status: "success",
    message: "Daily Hourly Peak Load Script Live Hai"
  });
}

function getRequestData_(e) {
  if (!e) return {};

  if (e.postData && e.postData.contents) {
    const type = String(e.postData.type || "").toLowerCase();
    if (type.indexOf("application/json") > -1) {
      const data = JSON.parse(e.postData.contents);
      if (typeof data.entries_json === "string") {
        data.entries_json = JSON.parse(data.entries_json);
      }
      return data;
    }
  }

  const p = e.parameter || {};
  return {
    entries_json: p.entries_json ? JSON.parse(p.entries_json) : []
  };
}

function getOrCreateTargetSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function getHeaders_() {
  return [
    "33/11 KV SUBSTATION",
    "11 KV FEEDER",
    "METER NO",
    "DATE (DD-MM-YYYY)",
    "TIME (HH:MM)",
    "PEAK LOAD (A)",
    "NAME OF OPERATOR",
    "SUBMISSION DATE",
    "SUBMISSION TIME"
  ];
}

function setupSheetLayout_(sheet, headers) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];

  const mismatch = headers.some(function(header, index) {
    return clean_(currentHeaders[index]) !== header;
  });

  if (sheet.getLastRow() === 0 || mismatch) {
    headerRange.setValues([headers]);
  }

  headerRange
    .setFontWeight("bold")
    .setBackground("#15803d")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

  sheet.setFrozenRows(1);
  ensureFilterIfMissing_(sheet, headers.length);
}

function ensureFilterIfMissing_(sheet, totalCols) {
  sheet.setFrozenRows(1);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), totalCols).createFilter();
  }
}

function clean_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
