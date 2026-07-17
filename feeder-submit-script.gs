var TARGET_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1XnsLz_5643XqGgrcMzhIzI_cF4E4S6Zc1esNEQe554A/edit?gid=0#gid=0";
var TARGET_SHEET_NAME = "Feeder Reading Script";

function doPost(e) {
  try {
    if (!e || !e.parameter || !e.parameter.entries_json) {
      return jsonResponse_({
        status: "error",
        message: "entries_json missing hai"
      });
    }

    var entries = JSON.parse(e.parameter.entries_json || "[]");
    if (!Array.isArray(entries) || !entries.length) {
      return jsonResponse_({
        status: "error",
        message: "koi valid entry nahi mili"
      });
    }

    var sheet = getTargetSheet_();
    var headers = getHeaders_();

    setupSheetLayout_(sheet, headers);

    var rows = entries.map(function(entry) {
      return [
        safeValue_(entry["33/11 KV SUBSTATION"] || entry.substation),
        safeValue_(entry["33 AND 11 KV FEEDER"] || entry.feeder),
        safeValue_(entry["METER NO"] || entry.meter_no),
        safeValue_(entry["PREVIUS READING"] || entry.previous_reading),
        safeValue_(entry["CURRENT READING"] || entry.current_reading),
        safeValue_(entry["MF"] || entry.mf),
        safeValue_(entry["CONSUMPTION"] || entry.consumption),
        safeValue_(entry["DC NAME"] || entry.dc_name),
        safeValue_(entry["DATE(DD/MM/YYY)"] || entry["DATE(DD/MM/YYYY)"] || entry.date),
        safeValue_(entry["TIME(HH/MM)"] || entry["TIME(HH:MM)"] || entry.time)
      ];
    });

    var startRow = Math.max(sheet.getLastRow() + 1, 2);
    var writeRange = sheet.getRange(startRow, 1, rows.length, headers.length);

    writeRange.setValues(rows);
    writeRange.setHorizontalAlignment("center");
    writeRange.setVerticalAlignment("middle");
    writeRange.setBorder(true, true, true, true, true, true);

    applyOrRefreshFilter_(sheet, headers.length);
    sheet.autoResizeColumns(1, headers.length);

    return jsonResponse_({
      status: "success",
      message: rows.length + " rows submit ho gayi"
    });
  } catch (error) {
    return jsonResponse_({
      status: "error",
      message: error && error.message ? error.message : "unknown error"
    });
  }
}

function doGet(e) {
  try {
    var action = e && e.parameter ? String(e.parameter.action || "").trim() : "";
    if (action === "getSummary") {
      var sheet = getTargetSheet_();
      var values = sheet.getDataRange().getValues();
      if (!values || values.length < 2) {
        return jsonResponse_([]);
      }

      var headers = values[0].map(function(header) {
        return String(header || "").trim();
      });

      var rows = values.slice(1).filter(function(row) {
        return row.some(function(cell) {
          return String(cell || "").trim() !== "";
        });
      }).map(function(row) {
        var item = {};
        headers.forEach(function(header, index) {
          item[header] = normalizeSummaryValue_(header, row[index]);
        });
        return item;
      });

      return jsonResponse_(rows);
    }

    return jsonResponse_({
      status: "success",
      message: "Feeder submit script live hai"
    });
  } catch (error) {
    return jsonResponse_({
      status: "error",
      message: error && error.message ? error.message : "unknown error"
    });
  }
}

function getTargetSheet_() {
  var ss = SpreadsheetApp.openByUrl(TARGET_SPREADSHEET_URL);
  var sheet = ss.getSheetByName(TARGET_SHEET_NAME);
  if (!sheet) {
    throw new Error("target sheet nahi mili");
  }
  return sheet;
}

function getHeaders_() {
  return [
    "33/11 KV SUBSTATION",
    "33 AND 11 KV FEEDER",
    "METER NO",
    "PREVIUS READING",
    "CURRENT READING",
    "MF",
    "CONSUMPTION",
    "DC NAME",
    "DATE(DD/MM/YYY)",
    "TIME(HH/MM)"
  ];
}

function setupSheetLayout_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  var currentHeaders = headerRange.getValues()[0];

  var same = headers.every(function(header, index) {
    return String(currentHeaders[index] || "").trim() === header;
  });

  if (!same) {
    headerRange.setValues([headers]);
  }

  headerRange
    .setFontWeight("bold")
    .setBackground("#f1c232")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true);

  sheet.setFrozenRows(1);
}

function applyOrRefreshFilter_(sheet, totalColumns) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  var existingFilter = sheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }

  sheet.getRange(1, 1, lastRow, totalColumns).createFilter();
}

function safeValue_(value) {
  return value === null || value === undefined ? "" : value;
}

function normalizeSummaryValue_(header, value) {
  if (value === null || value === undefined || value === "") return "";

  var normalizedHeader = String(header || "").trim().toUpperCase();
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    var tz = Session.getScriptTimeZone() || "Asia/Kolkata";
    if (normalizedHeader.indexOf("DATE") > -1) {
      return Utilities.formatDate(value, tz, "dd/MM/yyyy");
    }
    if (normalizedHeader.indexOf("TIME") > -1) {
      return Utilities.formatDate(value, tz, "HH:mm");
    }
  }

  return value;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
