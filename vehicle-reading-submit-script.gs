const TARGET_SHEET_NAME = "VEHICLE READING";
const SPREADSHEET_ID = "1osWQoSwAPk6XbkkdlaNNswHXAp8AJMX-k2PmxG_opU8";
const TOTAL_COLS = 7;

function doPost(e) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const data = getRequestData_(e);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!ss) throw new Error("Spreadsheet open nahi ho rahi");

    const sheet = getOrCreateTargetSheet_(ss, TARGET_SHEET_NAME);
    const headers = getHeaders_();
    setupSheetLayout_(sheet, headers);

    const date = clean_(data.date);
    const time = clean_(data.time);
    const vehicleNo = clean_(data.vehicle_no);
    const previousReading = clean_(data.previous_reading);
    const currentReading = clean_(data.current_reading);
    const differenceReading = clean_(data.difference_reading);

    if (!date) throw new Error("Date missing hai");
    if (!time) throw new Error("Time missing hai");
    if (!vehicleNo) throw new Error("Vehicle no missing hai");
    if (!currentReading) throw new Error("Current reading missing hai");
    if (isAlreadySubmitted_(sheet, date, vehicleNo)) {
      throw new Error("Already submitted");
    }

    const photoLink = savePhotoIfProvided_(data);

    const row = [[
      date,
      time,
      vehicleNo,
      previousReading,
      currentReading,
      differenceReading,
      photoLink
    ]];

    const startRow = Math.max(sheet.getLastRow() + 1, 2);
    const range = sheet.getRange(startRow, 1, 1, TOTAL_COLS);
    range.setValues(row);
    range.setHorizontalAlignment("center");
    range.setVerticalAlignment("middle");
    range.setBorder(true, true, true, true, true, true);

    return jsonResponse_({
      status: "success",
      message: "Vehicle reading submit ho gayi"
    });
  } catch (error) {
    return jsonResponse_({
      status: "error",
      message: error && error.message ? error.message : "unknown error"
    });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (_) {}
    }
  }
}

function doGet() {
  return jsonResponse_({
    status: "success",
    message: "Vehicle Reading Script Live Hai"
  });
}

function getRequestData_(e) {
  if (!e) throw new Error("Request missing hai");

  if (e.postData && e.postData.contents) {
    const type = String(e.postData.type || "").toLowerCase();
    if (type.indexOf("application/json") > -1) {
      return JSON.parse(e.postData.contents);
    }
  }

  const p = e.parameter || {};
  return {
    date: p.date || "",
    time: p.time || "",
    vehicle_no: p.vehicle_no || "",
    previous_reading: p.previous_reading || "",
    current_reading: p.current_reading || "",
    difference_reading: p.difference_reading || "",
    photo_base64: p.photo_base64 || "",
    photo_name: p.photo_name || ""
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
    "DATE (DD-MM-YYYY)",
    "TIME (HH:MM)",
    "VEHICLE NO",
    "PREVIOUS READING",
    "CURRENT READING",
    "DIFFERENCE READING",
    "PHOTO LINK"
  ];
}

function setupSheetLayout_(sheet, headers) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];
  const mismatch = headers.some(function(header, index) {
    return String(currentHeaders[index] || "").trim() !== header;
  });

  if (sheet.getLastRow() === 0 || mismatch) {
    headerRange.setValues([headers]);
  }

  headerRange
    .setFontWeight("bold")
    .setBackground("#fecaca")
    .setFontColor("#991b1b")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  const filter = sheet.getFilter();
  if (!filter) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), headers.length).createFilter();
  }

  protectSheetAndHeader_(sheet, headerRange);
}

function protectSheetAndHeader_(sheet, headerRange) {
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  if (!protections.length) {
    const sheetProtection = sheet.protect();
    sheetProtection.setDescription("VEHICLE READING sheet locked");
    sheetProtection.setWarningOnly(false);
  }

  const headerProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter(function(protection) {
      return protection.getDescription() === "VEHICLE READING header locked";
    });

  if (!headerProtections.length) {
    const headerProtection = headerRange.protect();
    headerProtection.setDescription("VEHICLE READING header locked");
    headerProtection.setWarningOnly(false);
  }
}

function savePhotoIfProvided_(data) {
  const base64 = clean_(data.photo_base64);
  const fileName = clean_(data.photo_name) || ("vehicle-reading-" + Date.now() + ".jpg");

  if (!base64) return "";

  const pureBase64 = base64.indexOf(",") > -1 ? base64.split(",")[1] : base64;
  const bytes = Utilities.base64Decode(pureBase64);
  const blob = Utilities.newBlob(bytes, "image/jpeg", fileName);
  const file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function isAlreadySubmitted_(sheet, date, vehicleNo) {
  const targetDate = normalizeDate_(date);
  const targetVehicle = normalizeText_(vehicleNo);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  return values.some(function(row) {
    return normalizeDate_(row[0]) === targetDate && normalizeText_(row[2]) === targetVehicle;
  });
}

function normalizeDate_(value) {
  const raw = clean_(value);
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return raw;
  return [
    match[1].padStart(2, "0"),
    match[2].padStart(2, "0"),
    match[3]
  ].join("-");
}

function normalizeText_(value) {
  return clean_(value).toUpperCase();
}

function clean_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
