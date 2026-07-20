const SPREADSHEET_ID = "1y0oYJYI5xpmylo9rVaMr3813PtEv1IMzKcwkwYvd3zE";

// Old common sheets are retained as backup. New paid data is stored DC-wise.
const LEGACY_COLLECTION_SHEET_NAME = "REVENUE COLLECTION";
const LEGACY_PAID_MASTER_SHEET_NAME = "REVENUE PAID MASTER";
const COLLECTION_SHEET_PREFIX = "PAID - ";
const PAID_MASTER_SHEET_PREFIX = "PAID MASTER - ";
const LINE_TD_SHEET_NAME = "LINE TD REPORT";
const MIGRATION_PROPERTY = "REVENUE_DC_WISE_MIGRATION_V1";

const DC_NAMES = [
  "ARI",
  "BADALPAR",
  "BANDOL",
  "BARGHAT",
  "DHARNA",
  "GOPALGANJ",
  "KANHIWADA",
  "KEOLARI",
  "KHAIRAPALARI",
  "KURAI",
  "MUNGWANI",
  "PANDIYA CHHAPARA",
  "SEONI (T)",
  "SEONI (RES)",
  "UGALI",
  "ADEGAON",
  "CHHAPARA-1",
  "CHHAPARA-2",
  "DHANORA",
  "DHUMA",
  "GANESHGANJ",
  "GHANSORE",
  "KEDARPUR",
  "LAKHNADON"
];

const DC_ALIAS_MAP = buildDcAliasMap_();

const COLLECTION_HEADERS = [
  "DC NAME", "IVRS NO", "CONSUMER NAME", "FATHER NAME", "VILLAGE",
  "HQ NAME", "TARRIF CATEGORY", "MOBILE NO", "ARREARS", "NET BILL",
  "AMOUNT PAID", "DATE", "TIME"
];

const PAID_MASTER_HEADERS = [
  "DC NAME", "IVRS NO", "AMOUNT PAID", "PAYMENT DATE", "PAYMENT COUNT",
  "SOURCE TYPE", "SOURCE", "PAY MODE", "UPLOADED DATE", "UPLOADED TIME",
  "PAYMENT ROWS JSON"
];

const LINE_TD_HEADERS = [
  "DC NAME", "IVRS NO", "CONSUMER NAME", "FATHER NAME", "VILLAGE",
  "HQ NAME", "TARRIF CATEGORY", "MOBILE NO", "ARREARS", "NET BILL",
  "TD DATE", "TD TIME", "PHOTO LINK", "REMARK", "PAID STATUS"
];

const STAFF_MASTER_SHEET_NAME = "STAFF MASTER";
const STAFF_SESSION_SHEET_NAME = "STAFF SESSIONS";
const MESSAGE_LOG_SHEET_NAME = "MESSAGE LOG";
const STAFF_SESSION_HOURS = 8;
const STAFF_MAX_FAILED_ATTEMPTS = 5;
const STAFF_LOCK_MINUTES = 15;

const TEST_STAFF_PROFILE = {
  staff_id: "9425805442",
  staff_name: "AKHILESH PATIDAR",
  mobile_no: "9425805442",
  division: "LAKHNADON",
  dc_name: "CHHAPARA-1",
  hq_name: "CHHAPARA",
  role: "AE"
};

const STAFF_MASTER_HEADERS = [
  "STAFF ID", "STAFF NAME", "MOBILE NO", "DIVISION", "DC NAME", "HQ NAME",
  "ROLE", "PASSWORD HASH", "PASSWORD SALT", "MUST CHANGE PIN", "STATUS",
  "FAILED ATTEMPTS", "LOCKED UNTIL", "CREATED AT", "LAST LOGIN", "DEVICE ID"
];

const STAFF_SESSION_HEADERS = [
  "SESSION HASH", "STAFF ID", "CREATED AT", "EXPIRES AT", "DEVICE ID", "STATUS"
];

const MESSAGE_LOG_HEADERS = [
  "DATE", "TIME", "STAFF ID", "STAFF NAME", "DIVISION", "DC NAME", "HQ NAME",
  "IVRS NO", "CONSUMER NAME", "MOBILE NO", "NET BILL", "CHANNEL", "STATUS", "MESSAGE"
];

function doPost(e) {
  try {
    const data = getRequestData_(e);
    const action = clean_(data.action);

    if (action === "staffLogin") return staffLogin_(data);
    if (action === "staffChangePin") return staffChangePin_(data);
    if (action === "staffLogout") return staffLogout_(data);
    if (action === "staffLogMessage") return staffLogMessage_(data);
    if (action === "uploadPaidMaster") return uploadPaidMaster_(data);
    if (action === "submitTD") return submitLineTd_(data);
    return submitRevenuePayment_(data);
  } catch (error) {
    return jsonResponse_({
      status: "error",
      message: error && error.message ? error.message : "Unknown error"
    });
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = clean_(params.action);

    if (action === "staffValidateSession") return staffValidateSession_(params);
    if (action === "getEntries") return getRevenueEntries_(params);
    if (action === "checkPaid") return checkPaidEntry_(params);
    if (action === "checkUploadedPaid") return checkUploadedPaid_(params);
    if (action === "getUploadedPaidEntries") return getUploadedPaidEntries_(params);
    if (action === "checkTD") return checkLineTd_(params);
    if (action === "getTDEntries") return getLineTdEntries_(params);

    return jsonResponse_({
      status: "success",
      message: "Revenue Collection DC-wise Script Live Hai",
      total_dc: DC_NAMES.length
    });
  } catch (error) {
    return jsonResponse_({
      status: "error",
      message: error && error.message ? error.message : "Unknown error"
    });
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Run once from Apps Script editor for the first test account.
 * A unique temporary password is generated and shown only in Execution log.
 */
function setupStaffMessageTestMode() {
  const ss = getSpreadsheet_();
  const staffSheet = getOrCreateSheet_(ss, STAFF_MASTER_SHEET_NAME, STAFF_MASTER_HEADERS);
  getOrCreateSheet_(ss, STAFF_SESSION_SHEET_NAME, STAFF_SESSION_HEADERS);
  getOrCreateSheet_(ss, MESSAGE_LOG_SHEET_NAME, MESSAGE_LOG_HEADERS);

  const staffId = "9425805442";
  const temporaryPassword = generateStaffTemporaryPassword_();
  const salt = Utilities.getUuid();
  const now = new Date();
  const row = [
    staffId,
    "AKHILESH PATIDAR",
    "9425805442",
    "LAKHNADON",
    "CHHAPARA-1",
    "CHHAPARA",
    "AE",
    hashStaffSecret_(temporaryPassword, salt),
    salt,
    "YES",
    "ACTIVE",
    0,
    "",
    now,
    "",
    ""
  ];

  const existing = findStaffRow_(staffSheet, staffId);
  if (existing) {
    staffSheet.getRange(existing.rowNumber, 1, 1, STAFF_MASTER_HEADERS.length).setValues([row]);
  } else {
    appendRows_(staffSheet, [row], STAFF_MASTER_HEADERS.length);
  }
  deactivateStaffSessions_(ss, staffId);

  const message = "TEST STAFF READY | Staff ID: " + staffId +
    " | Temporary Password: " + temporaryPassword +
    " | First login par 6-digit PIN banana compulsory hai.";
  Logger.log(message);
  try { SpreadsheetApp.getActive().toast(message, "STAFF TEST MODE", 20); } catch (_) {}
  return message;
}

function resetTestStaffDevice() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, STAFF_MASTER_SHEET_NAME, STAFF_MASTER_HEADERS);
  const found = findStaffRow_(sheet, "9425805442");
  if (!found) throw new Error("Test staff account nahi mila");
  sheet.getRange(found.rowNumber, 16).clearContent();
  deactivateStaffSessions_(ss, "9425805442");
  return "Test staff device reset ho gaya";
}

function staffLogin_(data) {
  const loginId = normalizeStaffLoginId_(data.login_id || data.staff_id || data.mobile_no);
  const password = clean_(data.password);
  const deviceId = clean_(data.device_id);
  if (!loginId || !password || !deviceId) throw new Error("Staff ID, password aur device ID required hai");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, STAFF_MASTER_SHEET_NAME, STAFF_MASTER_HEADERS);
    const found = findStaffRow_(sheet, loginId);
    if (!found || clean_(found.values[10]).toUpperCase() !== "ACTIVE") {
      throw new Error("Staff account active nahi hai");
    }

    const lockedUntil = dateValueToMillis_(found.values[12]);
    if (lockedUntil > Date.now()) {
      throw new Error("Account temporary lock hai. 15 minute baad try kijiye");
    }

    const passwordOk = constantTimeEqual_(
      clean_(found.values[7]),
      hashStaffSecret_(password, clean_(found.values[8]))
    );
    if (!passwordOk) {
      const failures = Number(found.values[11] || 0) + 1;
      sheet.getRange(found.rowNumber, 12).setValue(failures);
      if (failures >= STAFF_MAX_FAILED_ATTEMPTS) {
        const until = new Date(Date.now() + STAFF_LOCK_MINUTES * 60 * 1000);
        sheet.getRange(found.rowNumber, 13).setValue(until);
        throw new Error("5 galat attempts ke karan account 15 minute ke liye lock ho gaya");
      }
      throw new Error("Staff ID ya password galat hai. Remaining attempts: " + (STAFF_MAX_FAILED_ATTEMPTS - failures));
    }

    repairTestStaffProfile_(sheet, found);

    const registeredDevice = clean_(found.values[15]);
    if (registeredDevice && registeredDevice !== deviceId) {
      throw new Error("Account kisi anya device par registered hai. Admin se device reset karaiye");
    }
    if (!registeredDevice) sheet.getRange(found.rowNumber, 16).setValue(deviceId);

    sheet.getRange(found.rowNumber, 12, 1, 2).setValues([[0, ""]]);
    sheet.getRange(found.rowNumber, 15).setValue(new Date());
    const token = createStaffSession_(ss, clean_(found.values[0]), deviceId);

    return jsonResponse_({
      status: "success",
      message: "Staff login successful",
      session_token: token,
      session_hours: STAFF_SESSION_HOURS,
      must_change_pin: clean_(found.values[9]).toUpperCase() === "YES",
      staff: mapSafeStaff_(found.values)
    });
  } finally {
    lock.releaseLock();
  }
}

function staffChangePin_(data) {
  const session = requireStaffSession_(data.session_token, data.device_id);
  const newPin = clean_(data.new_pin);
  const confirmPin = clean_(data.confirm_pin);
  if (newPin !== confirmPin) throw new Error("New PIN aur Confirm PIN same nahi hai");
  validateStaffPin_(newPin, session.staff.values[2]);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const salt = Utilities.getUuid();
    const rowNumber = session.staff.rowNumber;
    session.staffSheet.getRange(rowNumber, 8, 1, 3).setValues([[
      hashStaffSecret_(newPin, salt),
      salt,
      "NO"
    ]]);
    session.staff.values[9] = "NO";

    return jsonResponse_({
      status: "success",
      message: "6-digit PIN successfully set ho gaya",
      must_change_pin: false,
      staff: mapSafeStaff_(session.staff.values)
    });
  } finally {
    lock.releaseLock();
  }
}

function staffValidateSession_(params) {
  const session = requireStaffSession_(params.session_token, params.device_id);
  return jsonResponse_({
    status: "success",
    valid: true,
    must_change_pin: clean_(session.staff.values[9]).toUpperCase() === "YES",
    staff: mapSafeStaff_(session.staff.values)
  });
}

function staffLogout_(data) {
  const tokenHash = hashStaffSessionToken_(clean_(data.session_token));
  if (!tokenHash) return jsonResponse_({ status: "success", message: "Logout successful" });
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, STAFF_SESSION_SHEET_NAME, STAFF_SESSION_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, STAFF_SESSION_HEADERS.length).getValues();
    values.forEach(function(row, index) {
      if (constantTimeEqual_(clean_(row[0]), tokenHash)) sheet.getRange(index + 2, 6).setValue("LOGGED OUT");
    });
  }
  return jsonResponse_({ status: "success", message: "Logout successful" });
}

function staffLogMessage_(data) {
  const session = requireStaffSession_(data.session_token, data.device_id);
  if (clean_(session.staff.values[9]).toUpperCase() === "YES") throw new Error("Pehle 6-digit PIN set kijiye");

  const staff = mapSafeStaff_(session.staff.values);
  const channel = clean_(data.channel).toUpperCase();
  const logStatus = clean_(data.log_status).toUpperCase();
  if (["SMS", "WHATSAPP"].indexOf(channel) === -1) throw new Error("Invalid message channel");
  if (["OPENED FOR SEND", "STAFF CONFIRMED SENT", "SKIPPED", "INVALID MOBILE"].indexOf(logStatus) === -1) {
    throw new Error("Invalid message status");
  }

  const targetDc = requireDcName_(data.dc_name);
  if (normalizeDcKey_(targetDc) !== normalizeDcKey_(staff.dc_name)) throw new Error("Assigned DC ke bahar message allowed nahi hai");
  const now = new Date();
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, MESSAGE_LOG_SHEET_NAME, MESSAGE_LOG_HEADERS);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    appendRows_(sheet, [[
      formatDate_(now),
      formatTime_(now),
      staff.staff_id,
      staff.staff_name,
      staff.division,
      staff.dc_name,
      staff.hq_name,
      normalizeIvrs_(data.ivrs_no),
      clean_(data.consumer_name),
      normalizeMobile_(data.mobile_no),
      clean_(data.net_bill),
      channel,
      logStatus,
      clean_(data.message)
    ]], MESSAGE_LOG_HEADERS.length);
  } finally {
    lock.releaseLock();
  }

  return jsonResponse_({ status: "success", message: "Message activity log save ho gaya" });
}

function createStaffSession_(ss, staffId, deviceId) {
  const sheet = getOrCreateSheet_(ss, STAFF_SESSION_SHEET_NAME, STAFF_SESSION_HEADERS);
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + STAFF_SESSION_HOURS * 60 * 60 * 1000);
  appendRows_(sheet, [[hashStaffSessionToken_(token), staffId, now, expiresAt, deviceId, "ACTIVE"]], STAFF_SESSION_HEADERS.length);
  return token;
}

function requireStaffSession_(rawToken, rawDeviceId) {
  const token = clean_(rawToken);
  const deviceId = clean_(rawDeviceId);
  if (!token || !deviceId) throw new Error("Staff session missing hai. Dobara login kijiye");
  const tokenHash = hashStaffSessionToken_(token);
  const ss = getSpreadsheet_();
  const sessionSheet = getOrCreateSheet_(ss, STAFF_SESSION_SHEET_NAME, STAFF_SESSION_HEADERS);
  const lastRow = sessionSheet.getLastRow();
  if (lastRow < 2) throw new Error("Session expired hai. Dobara login kijiye");

  const sessions = sessionSheet.getRange(2, 1, lastRow - 1, STAFF_SESSION_HEADERS.length).getValues();
  let sessionRow = null;
  let sessionRowNumber = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const row = sessions[i];
    if (constantTimeEqual_(clean_(row[0]), tokenHash)) {
      sessionRow = row;
      sessionRowNumber = i + 2;
      break;
    }
  }
  if (!sessionRow || clean_(sessionRow[5]).toUpperCase() !== "ACTIVE") throw new Error("Session expired hai. Dobara login kijiye");
  if (clean_(sessionRow[4]) !== deviceId) throw new Error("Session is device par valid nahi hai");
  if (dateValueToMillis_(sessionRow[3]) <= Date.now()) {
    sessionSheet.getRange(sessionRowNumber, 6).setValue("EXPIRED");
    throw new Error("Session expired hai. Dobara login kijiye");
  }

  const staffSheet = getOrCreateSheet_(ss, STAFF_MASTER_SHEET_NAME, STAFF_MASTER_HEADERS);
  const staff = findStaffRow_(staffSheet, clean_(sessionRow[1]));
  if (!staff || clean_(staff.values[10]).toUpperCase() !== "ACTIVE") throw new Error("Staff account active nahi hai");
  if (clean_(staff.values[15]) !== deviceId) throw new Error("Device verification failed");
  return { ss: ss, sessionSheet: sessionSheet, sessionRowNumber: sessionRowNumber, staffSheet: staffSheet, staff: staff };
}

function findStaffRow_(sheet, loginId) {
  const target = normalizeStaffLoginId_(loginId);
  const lastRow = sheet.getLastRow();
  if (!target || lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, STAFF_MASTER_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (normalizeStaffLoginId_(values[i][0]) === target || normalizeStaffLoginId_(values[i][2]) === target) {
      return { rowNumber: i + 2, values: values[i] };
    }
  }
  return null;
}

function mapSafeStaff_(row) {
  const staffId = clean_(row[0]);
  const isTestStaff = normalizeStaffLoginId_(staffId) === TEST_STAFF_PROFILE.staff_id;
  return {
    staff_id: staffId,
    staff_name: clean_(row[1]) || (isTestStaff ? TEST_STAFF_PROFILE.staff_name : ""),
    mobile_no: normalizeMobile_(row[2]) || (isTestStaff ? TEST_STAFF_PROFILE.mobile_no : ""),
    division: clean_(row[3]) || (isTestStaff ? TEST_STAFF_PROFILE.division : ""),
    dc_name: requireDcName_(clean_(row[4]) || (isTestStaff ? TEST_STAFF_PROFILE.dc_name : "")),
    hq_name: clean_(row[5]) || (isTestStaff ? TEST_STAFF_PROFILE.hq_name : ""),
    role: (clean_(row[6]) || (isTestStaff ? TEST_STAFF_PROFILE.role : "")).toUpperCase(),
    status: clean_(row[10]).toUpperCase()
  };
}

function repairTestStaffProfile_(sheet, found) {
  if (normalizeStaffLoginId_(found.values[0]) !== TEST_STAFF_PROFILE.staff_id) return;
  const profileValues = [
    TEST_STAFF_PROFILE.staff_id,
    TEST_STAFF_PROFILE.staff_name,
    TEST_STAFF_PROFILE.mobile_no,
    TEST_STAFF_PROFILE.division,
    TEST_STAFF_PROFILE.dc_name,
    TEST_STAFF_PROFILE.hq_name,
    TEST_STAFF_PROFILE.role
  ];
  let changed = false;
  profileValues.forEach(function(value, index) {
    if (clean_(found.values[index]) !== value) {
      found.values[index] = value;
      changed = true;
    }
  });
  if (changed) sheet.getRange(found.rowNumber, 1, 1, profileValues.length).setValues([profileValues]);
}

function deactivateStaffSessions_(ss, staffId) {
  const sheet = getOrCreateSheet_(ss, STAFF_SESSION_SHEET_NAME, STAFF_SESSION_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 1, lastRow - 1, STAFF_SESSION_HEADERS.length).getValues();
  const statusRange = sheet.getRange(2, 6, lastRow - 1, 1);
  const statuses = statusRange.getValues();
  let changed = false;
  values.forEach(function(row, index) {
    if (normalizeStaffLoginId_(row[1]) === normalizeStaffLoginId_(staffId) && clean_(row[5]).toUpperCase() === "ACTIVE") {
      statuses[index][0] = "RESET";
      changed = true;
    }
  });
  if (changed) statusRange.setValues(statuses);
}

function generateStaffTemporaryPassword_() {
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  return "T" + digits;
}

function validateStaffPin_(pin, mobileNo) {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN exactly 6 digit ka hona chahiye");
  if (/^(\d)\1{5}$/.test(pin)) throw new Error("Same digit wala easy PIN allowed nahi hai");
  if (["123456", "654321", "012345", "543210"].indexOf(pin) > -1) throw new Error("Sequential easy PIN allowed nahi hai");
  const mobile = normalizeMobile_(mobileNo);
  if (mobile && mobile.slice(-6) === pin) throw new Error("Mobile number ke last 6 digit PIN nahi rakh sakte");
}

function normalizeStaffLoginId_(value) {
  return clean_(value).toUpperCase().replace(/\s+/g, "");
}

function normalizeMobile_(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function getStaffPepper_() {
  const properties = PropertiesService.getScriptProperties();
  let pepper = properties.getProperty("STAFF_AUTH_PEPPER_V1");
  if (!pepper) {
    pepper = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty("STAFF_AUTH_PEPPER_V1", pepper);
  }
  return pepper;
}

function hashStaffSecret_(secret, salt) {
  let value = clean_(secret) + "|" + clean_(salt);
  const pepper = getStaffPepper_();
  for (let i = 0; i < 1200; i++) {
    value = bytesToHex_(Utilities.computeHmacSha256Signature(value, pepper, Utilities.Charset.UTF_8));
  }
  return value;
}

function hashStaffSessionToken_(token) {
  if (!clean_(token)) return "";
  return bytesToHex_(Utilities.computeHmacSha256Signature(clean_(token), getStaffPepper_(), Utilities.Charset.UTF_8));
}

function bytesToHex_(bytes) {
  return (bytes || []).map(function(byte) {
    return ((byte + 256) % 256).toString(16).padStart(2, "0");
  }).join("");
}

function constantTimeEqual_(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function dateValueToMillis_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value.getTime();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function submitRevenuePayment_(data) {
  const dcName = requireDcName_(data.dc_name);
  const ivrsNo = normalizeIvrs_(data.ivrs_no);
  const amountPaid = clean_(data.amount_paid);

  if (!ivrsNo) throw new Error("IVRS No missing hai");
  if (!amountPaid) throw new Error("Amount Paid missing hai");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getSpreadsheet_();
    const sheet = getPaidSheet_(ss, dcName, true);
    const existingPayments = findCollectionPayments_(sheet, ivrsNo, dcName);

    if (existingPayments.length >= 2) {
      throw new Error("Already submitted 2 times");
    }

    const now = new Date();
    const date = formatDate_(now);
    const time = formatTime_(now);
    const row = [[
      dcName,
      ivrsNo,
      clean_(data.consumer_name),
      clean_(data.father_name),
      clean_(data.village),
      clean_(data.hq_name),
      clean_(data.tarrif_category),
      clean_(data.mobile_no),
      clean_(data.arrears),
      clean_(data.net_bill),
      amountPaid,
      date,
      time
    ]];

    appendRows_(sheet, row, COLLECTION_HEADERS.length);
    updateLineTdPaidStatus_(ss, dcName, ivrsNo, amountPaid, date, time);

    return jsonResponse_({
      status: "success",
      message: "Revenue paid amount submit ho gaya",
      payment_count: existingPayments.length + 1,
      sheet_name: sheet.getName()
    });
  } finally {
    lock.releaseLock();
  }
}

function submitLineTd_(data) {
  const dcName = requireDcName_(data.dc_name);
  const ivrsNo = normalizeIvrs_(data.ivrs_no);
  if (!ivrsNo) throw new Error("IVRS No missing hai");

  const photoResult = saveTdPhotoIfProvided_(data);
  const photoLink = photoResult.link || clean_(data.photo_link);
  const now = new Date();
  const tdDate = formatDate_(now);
  const tdTime = formatTime_(now);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, LINE_TD_SHEET_NAME, LINE_TD_HEADERS);
    const paidStatus = getPaidStatusText_(ss, dcName, ivrsNo);
    const row = [[
      dcName,
      ivrsNo,
      clean_(data.consumer_name),
      clean_(data.father_name),
      clean_(data.village),
      clean_(data.hq_name),
      clean_(data.tarrif_category),
      clean_(data.mobile_no),
      clean_(data.arrears),
      clean_(data.net_bill),
      tdDate,
      tdTime,
      photoLink,
      clean_(data.remark),
      paidStatus
    ]];

    appendRows_(sheet, row, LINE_TD_HEADERS.length);
    return jsonResponse_({
      status: "success",
      message: "Line TD submit ho gaya",
      td_date: tdDate,
      td_time: tdTime,
      photo_link: photoLink,
      paid_status: paidStatus
    });
  } finally {
    lock.releaseLock();
  }
}

function uploadPaidMaster_(data) {
  const dcName = requireDcName_(data.dc_name);
  const entries = parseEntries_(data.entries_json);
  if (!entries.length) throw new Error("Paid entries missing hai");

  const now = new Date();
  const uploadDate = formatDate_(now);
  const uploadTime = formatTime_(now);
  const rows = entries.map(function(entry) {
    const ivrsNo = normalizeIvrs_(entry.ivrs_no || entry.ivrsNo);
    if (!ivrsNo) return null;

    const paymentRows = entry.payment_rows || entry.paymentRows || [];
    return [
      dcName,
      ivrsNo,
      clean_(entry.amount_paid || entry.amountPaid),
      clean_(entry.payment_date || entry.paymentDate),
      clean_(entry.payment_count || entry.paymentCount),
      clean_(entry.source_type || entry.sourceType),
      clean_(entry.source),
      clean_(entry.pay_mode || entry.payMode),
      uploadDate,
      uploadTime,
      stringifyPaymentRows_(paymentRows)
    ];
  }).filter(Boolean);

  if (!rows.length) throw new Error("Valid IVRS No missing hai");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getSpreadsheet_();
    const sheet = getPaidMasterSheet_(ss, dcName, true);
    replaceSheetData_(sheet, rows, PAID_MASTER_HEADERS);
    updateLineTdStatusesFromPaidMaster_(ss, dcName, rows);

    return jsonResponse_({
      status: "success",
      message: "Paid master successfully upload ho gaya",
      upload_complete: true,
      progress: 100,
      rows_saved: rows.length,
      sheet_name: sheet.getName()
    });
  } finally {
    lock.releaseLock();
  }
}

function getRevenueEntries_(params) {
  const requestedDc = clean_(params.dc_name);
  const ss = getSpreadsheet_();
  const dcList = requestedDc ? [requireDcName_(requestedDc)] : DC_NAMES;
  let entries = [];

  dcList.forEach(function(dcName) {
    const sheet = getPaidSheet_(ss, dcName, false);
    if (!sheet || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, COLLECTION_HEADERS.length).getValues();
    entries = entries.concat(values.map(mapCollectionRow_).filter(hasIvrs_));
  });

  return jsonResponse_({ status: "success", entries: entries });
}

function checkPaidEntry_(params) {
  const requestedDc = clean_(params.dc_name);
  const ivrsNo = normalizeIvrs_(params.ivrs_no);
  if (!ivrsNo) throw new Error("IVRS No missing hai");

  const ss = getSpreadsheet_();
  const dcList = requestedDc ? [requireDcName_(requestedDc)] : DC_NAMES;
  let payments = [];

  dcList.forEach(function(dcName) {
    const sheet = getPaidSheet_(ss, dcName, false);
    if (sheet) payments = payments.concat(findCollectionPayments_(sheet, ivrsNo, dcName));
  });

  return jsonResponse_({
    status: "success",
    paid: payments.length > 0,
    payments: payments
  });
}

function checkUploadedPaid_(params) {
  const requestedDc = clean_(params.dc_name);
  const ivrsNo = normalizeIvrs_(params.ivrs_no);
  if (!ivrsNo) throw new Error("IVRS No missing hai");

  const ss = getSpreadsheet_();
  const dcList = requestedDc ? [requireDcName_(requestedDc)] : DC_NAMES;

  for (let d = 0; d < dcList.length; d++) {
    const sheet = getPaidMasterSheet_(ss, dcList[d], false);
    const found = sheet ? findUploadedPaid_(sheet, ivrsNo, dcList[d]) : null;
    if (found) return jsonResponse_({ status: "success", paid: true, data: found });
  }

  return jsonResponse_({ status: "success", paid: false });
}

function getUploadedPaidEntries_(params) {
  const requestedDc = clean_(params.dc_name);
  const ss = getSpreadsheet_();
  const dcList = requestedDc ? [requireDcName_(requestedDc)] : DC_NAMES;
  let entries = [];

  dcList.forEach(function(dcName) {
    const sheet = getPaidMasterSheet_(ss, dcName, false);
    if (!sheet || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, PAID_MASTER_HEADERS.length).getValues();
    entries = entries.concat(values.map(mapPaidMasterRow_).filter(hasIvrs_));
  });

  return jsonResponse_({ status: "success", entries: entries });
}

function checkLineTd_(params) {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, LINE_TD_SHEET_NAME, LINE_TD_HEADERS);
  const dcName = clean_(params.dc_name) ? requireDcName_(params.dc_name) : "";
  const ivrsNo = normalizeIvrs_(params.ivrs_no);
  const entries = findLineTdEntries_(sheet, ivrsNo, dcName);

  return jsonResponse_({
    status: "success",
    td_done: entries.length > 0,
    entries: entries
  });
}

function getLineTdEntries_(params) {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, LINE_TD_SHEET_NAME, LINE_TD_HEADERS);
  const dcName = clean_(params.dc_name) ? requireDcName_(params.dc_name) : "";
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse_({ status: "success", entries: [] });

  const values = sheet.getRange(2, 1, lastRow - 1, LINE_TD_HEADERS.length).getValues();
  const entries = values.filter(function(row) {
    return !dcName || safeDcName_(row[0]) === dcName;
  }).map(mapLineTdRow_).filter(hasIvrs_);

  return jsonResponse_({ status: "success", entries: entries });
}

function findCollectionPayments_(sheet, ivrsNo, dcName) {
  const targetIvrs = normalizeIvrs_(ivrsNo);
  const targetDc = clean_(dcName) ? requireDcName_(dcName) : "";
  const lastRow = sheet.getLastRow();
  if (!targetIvrs || lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, COLLECTION_HEADERS.length).getValues()
    .filter(function(row) {
      return normalizeIvrs_(row[1]) === targetIvrs && (!targetDc || safeDcName_(row[0]) === targetDc);
    })
    .map(mapCollectionRow_);
}

function findUploadedPaid_(sheet, ivrsNo, dcName) {
  const targetIvrs = normalizeIvrs_(ivrsNo);
  const targetDc = clean_(dcName) ? requireDcName_(dcName) : "";
  const lastRow = sheet.getLastRow();
  if (!targetIvrs || lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, PAID_MASTER_HEADERS.length).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (normalizeIvrs_(values[i][1]) === targetIvrs && (!targetDc || safeDcName_(values[i][0]) === targetDc)) {
      return mapPaidMasterRow_(values[i]);
    }
  }
  return null;
}

function findLineTdEntries_(sheet, ivrsNo, dcName) {
  const targetIvrs = normalizeIvrs_(ivrsNo);
  const targetDc = clean_(dcName) ? requireDcName_(dcName) : "";
  const lastRow = sheet.getLastRow();
  if (!targetIvrs || lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, LINE_TD_HEADERS.length).getValues()
    .filter(function(row) {
      return normalizeIvrs_(row[1]) === targetIvrs && (!targetDc || safeDcName_(row[0]) === targetDc);
    })
    .map(mapLineTdRow_);
}

function getPaidStatusText_(ss, dcName, ivrsNo) {
  const collectionSheet = getPaidSheet_(ss, dcName, false);
  const manualPayments = collectionSheet ? findCollectionPayments_(collectionSheet, ivrsNo, dcName) : [];

  if (manualPayments.length) {
    const last = manualPayments[manualPayments.length - 1];
    return "Paid By Staff: Rs " + clean_(last.amount_paid) + " | Date: " + formatDateValue_(last.date) + " | Time: " + formatTime_(last.time);
  }

  const paidSheet = getPaidMasterSheet_(ss, dcName, false);
  const uploaded = paidSheet ? findUploadedPaid_(paidSheet, ivrsNo, dcName) : null;
  if (uploaded) {
    return "NGB Cashlist: Rs " + clean_(uploaded.amount_paid) + " | Date: " + formatDateValue_(uploaded.payment_date);
  }

  return "";
}

function updateLineTdPaidStatus_(ss, dcName, ivrsNo, amountPaid, date, time) {
  const sheet = getOrCreateSheet_(ss, LINE_TD_SHEET_NAME, LINE_TD_HEADERS);
  const targetDc = requireDcName_(dcName);
  const targetIvrs = normalizeIvrs_(ivrsNo);
  const lastRow = sheet.getLastRow();
  if (!targetIvrs || lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, LINE_TD_HEADERS.length).getValues();
  const statusRange = sheet.getRange(2, LINE_TD_HEADERS.length, lastRow - 1, 1);
  const statuses = statusRange.getDisplayValues();
  let changed = false;
  const status = time
    ? "Paid By Staff: Rs " + clean_(amountPaid) + " | Date: " + formatDateValue_(date) + " | Time: " + formatTime_(time)
    : "NGB Cashlist: Rs " + clean_(amountPaid) + " | Date: " + formatDateValue_(date);

  values.forEach(function(row, index) {
    if (safeDcName_(row[0]) === targetDc && normalizeIvrs_(row[1]) === targetIvrs) {
      statuses[index][0] = status;
      changed = true;
    }
  });

  if (changed) statusRange.setValues(statuses);
}

function updateLineTdStatusesFromPaidMaster_(ss, dcName, paidRows) {
  const sheet = getOrCreateSheet_(ss, LINE_TD_SHEET_NAME, LINE_TD_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const latestByIvrs = {};
  paidRows.forEach(function(row) {
    latestByIvrs[normalizeIvrs_(row[1])] = row;
  });

  const values = sheet.getRange(2, 1, lastRow - 1, LINE_TD_HEADERS.length).getValues();
  const statusRange = sheet.getRange(2, LINE_TD_HEADERS.length, lastRow - 1, 1);
  const statuses = statusRange.getDisplayValues();
  let changed = false;

  values.forEach(function(row, index) {
    if (safeDcName_(row[0]) !== dcName) return;
    const paid = latestByIvrs[normalizeIvrs_(row[1])];
    if (!paid) return;
    statuses[index][0] = "NGB Cashlist: Rs " + clean_(paid[2]) + " | Date: " + formatDateValue_(paid[3]);
    changed = true;
  });

  if (changed) statusRange.setValues(statuses);
}

function mapCollectionRow_(row) {
  return {
    dc_name: row[0], ivrs_no: row[1], consumer_name: row[2], father_name: row[3],
    village: row[4], hq_name: row[5], tarrif_category: row[6], mobile_no: row[7],
    arrears: row[8], net_bill: row[9], amount_paid: row[10],
    date: formatDateValue_(row[11]), time: formatTime_(row[12])
  };
}

function mapPaidMasterRow_(row) {
  return {
    dc_name: row[0],
    ivrs_no: row[1],
    amount_paid: row[2],
    payment_date: formatDateValue_(row[3]),
    payment_count: row[4],
    source_type: row[5],
    source: row[6],
    pay_mode: row[7],
    uploaded_date: formatDateValue_(row[8]),
    uploaded_time: formatTime_(row[9]),
    payment_rows: parsePaymentRows_(row[10])
  };
}

function mapLineTdRow_(row) {
  return {
    dc_name: row[0], ivrs_no: row[1], consumer_name: row[2], father_name: row[3],
    village: row[4], hq_name: row[5], tarrif_category: row[6], mobile_no: row[7],
    arrears: row[8], net_bill: row[9], td_date: formatDateValue_(row[10]),
    td_time: formatTime_(row[11]), photo_link: row[12], remark: row[13], paid_status: row[14]
  };
}

function hasIvrs_(row) {
  return !!normalizeIvrs_(row.ivrs_no);
}

function getPaidSheet_(ss, dcName, create) {
  return getDcSheet_(ss, COLLECTION_SHEET_PREFIX, dcName, COLLECTION_HEADERS, create);
}

function getPaidMasterSheet_(ss, dcName, create) {
  return getDcSheet_(ss, PAID_MASTER_SHEET_PREFIX, dcName, PAID_MASTER_HEADERS, create);
}

function getDcSheet_(ss, prefix, dcName, headers, create) {
  const canonicalDc = requireDcName_(dcName);
  const sheetName = prefix + canonicalDc;
  const existing = ss.getSheetByName(sheetName);
  if (existing) {
    ensureSheetHeaders_(existing, headers);
    return existing;
  }
  return create ? getOrCreateSheet_(ss, sheetName, headers) : null;
}

function appendRows_(sheet, rows, columnCount) {
  if (!rows.length) return;
  const startRow = Math.max(sheet.getLastRow() + 1, 2);
  const range = sheet.getRange(startRow, 1, rows.length, columnCount);
  range.setValues(rows);
  styleDataRange_(range);
}

function replaceSheetData_(sheet, rows, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  if (rows.length) appendRows_(sheet, rows, headers.length);
}

/**
 * ONE-TIME MANUAL MIGRATION.
 * Run this once before deploying the new web-app version.
 * Old common sheets are never deleted. Exact duplicate rows are not copied twice.
 */
function migrateLegacyRevenueDataToDcSheets() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(MIGRATION_PROPERTY) === "DONE") {
    const alreadyDone = "Migration pehle hi successfully complete ho chuki hai";
    Logger.log(alreadyDone);
    return alreadyDone;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getSpreadsheet_();
    const collectionResult = migrateLegacySheet_(
      ss,
      LEGACY_COLLECTION_SHEET_NAME,
      COLLECTION_SHEET_PREFIX,
      COLLECTION_HEADERS,
      COLLECTION_HEADERS.length
    );
    const paidMasterResult = migrateLegacySheet_(
      ss,
      LEGACY_PAID_MASTER_SHEET_NAME,
      PAID_MASTER_SHEET_PREFIX,
      PAID_MASTER_HEADERS,
      PAID_MASTER_HEADERS.length
    );

    properties.setProperty(MIGRATION_PROPERTY, "DONE");
    const message = "Migration successful: Staff Paid " + collectionResult.copied +
      " rows, Paid Master " + paidMasterResult.copied + " rows. Old common sheets safe hain.";
    Logger.log(message);
    return message;
  } finally {
    lock.releaseLock();
  }
}

function migrateLegacySheet_(ss, legacyName, targetPrefix, targetHeaders, targetColumnCount) {
  const legacy = ss.getSheetByName(legacyName);
  if (!legacy || legacy.getLastRow() < 2) return { copied: 0, skipped: 0 };

  const legacyColumnCount = Math.min(legacy.getLastColumn(), targetColumnCount);
  const sourceRows = legacy.getRange(2, 1, legacy.getLastRow() - 1, legacyColumnCount).getValues();
  const grouped = {};
  let skipped = 0;

  sourceRows.forEach(function(sourceRow) {
    const dcName = safeDcName_(sourceRow[0]);
    if (!dcName || !normalizeIvrs_(sourceRow[1])) {
      skipped += 1;
      return;
    }
    const row = new Array(targetColumnCount).fill("");
    for (let i = 0; i < Math.min(sourceRow.length, targetColumnCount); i++) row[i] = sourceRow[i];
    row[0] = dcName;
    if (!grouped[dcName]) grouped[dcName] = [];
    grouped[dcName].push(row);
  });

  let copied = 0;
  Object.keys(grouped).forEach(function(dcName) {
    const target = getDcSheet_(ss, targetPrefix, dcName, targetHeaders, true);
    copied += appendUniqueRows_(target, grouped[dcName], targetColumnCount);
  });

  return { copied: copied, skipped: skipped };
}

function appendUniqueRows_(sheet, rows, columnCount) {
  const existingSignatures = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, columnCount).getValues().forEach(function(row) {
      existingSignatures[rowSignature_(row)] = true;
    });
  }

  const missing = rows.filter(function(row) {
    const signature = rowSignature_(row);
    if (existingSignatures[signature]) return false;
    existingSignatures[signature] = true;
    return true;
  });

  appendRows_(sheet, missing, columnCount);
  return missing.length;
}

function rowSignature_(row) {
  return row.map(function(value) {
    if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
      return value.getTime();
    }
    return clean_(value);
  }).join("\u001f");
}

function createAllDcSheets() {
  const ss = getSpreadsheet_();
  DC_NAMES.forEach(function(dcName) {
    getPaidSheet_(ss, dcName, true);
    getPaidMasterSheet_(ss, dcName, true);
  });
  getOrCreateSheet_(ss, LINE_TD_SHEET_NAME, LINE_TD_HEADERS);
  return DC_NAMES.length + " DC ke sheets ready hain";
}

// Run this single function once from the Apps Script editor before deployment.
function setupDcWiseRevenueSheets() {
  const setupMessage = createAllDcSheets();
  const migrationMessage = migrateLegacyRevenueDataToDcSheets();
  return setupMessage + ". " + migrationMessage;
}

function repairLineTdPaidStatusTimes() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, LINE_TD_SHEET_NAME, LINE_TD_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const statusRange = sheet.getRange(2, LINE_TD_HEADERS.length, lastRow - 1, 1);
  const values = statusRange.getDisplayValues();
  let fixedCount = 0;
  const fixedValues = values.map(function(row) {
    const status = clean_(row[0]);
    if (!status || status.indexOf("Time:") === -1) return [status];
    const prefix = status.split("Time:")[0] + "Time: ";
    const timePart = status.substring(status.indexOf("Time:") + 5);
    const match = timePart.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!match) return [status];
    const corrected = prefix + String(match[1]).padStart(2, "0") + ":" + match[2];
    if (corrected !== status) fixedCount += 1;
    return [corrected];
  });

  statusRange.setValues(fixedValues);
  SpreadsheetApp.getActive().toast(fixedCount + " PAID STATUS time fixed", LINE_TD_SHEET_NAME);
}

function saveTdPhotoIfProvided_(data) {
  const base64 = clean_(data.photo_base64);
  const fileName = clean_(data.photo_name) || ("line-td-photo-" + Date.now() + ".jpg");
  const mimeType = clean_(data.photo_mime_type) || "image/jpeg";
  if (!base64) return { link: "", blob: null };

  const pureBase64 = base64.indexOf(",") > -1 ? base64.split(",")[1] : base64;
  const blob = Utilities.newBlob(Utilities.base64Decode(pureBase64), mimeType, fileName);
  const file = DriveApp.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (_) {}
  return { link: file.getUrl(), blob: blob };
}

function getOrCreateSheet_(ss, sheetName, headers) {
  if (!ss) throw new Error("Spreadsheet open nahi ho rahi");
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  setupSheetLayout_(sheet, headers);
  return sheet;
}

function ensureSheetHeaders_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const mismatch = headers.some(function(header, index) { return clean_(current[index]) !== header; });
  if (mismatch) setupSheetLayout_(sheet, headers);
}

function setupSheetLayout_(sheet, headers) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold").setBackground("#bfdbfe").setFontColor("#1e3a8a")
    .setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true);
  sheet.setFrozenRows(1);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), headers.length).createFilter();
  }
  protectHeader_(sheet, headers.length);
}

function protectHeader_(sheet, totalCols) {
  try {
    const headerRange = sheet.getRange(1, 1, 1, totalCols);
    const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function(protection) {
      return protection.getRange().getA1Notation() === headerRange.getA1Notation();
    });
    if (!existing) {
      const protection = headerRange.protect();
      protection.setDescription(sheet.getName() + " header locked");
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    }
  } catch (_) {}
}

function styleDataRange_(range) {
  range.setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true);
}

function getRequestData_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    const type = String(e.postData.type || "").toLowerCase();
    if (type.indexOf("application/json") > -1 || raw.trim().charAt(0) === "{") return JSON.parse(raw);
  }
  return e.parameter || {};
}

function parseEntries_(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return JSON.parse(value);
  return [];
}

function stringifyPaymentRows_(value) {
  if (!value) return "[]";
  if (typeof value === "string") {
    try { return JSON.stringify(JSON.parse(value)); } catch (_) { return "[]"; }
  }
  try { return JSON.stringify(Array.isArray(value) ? value : []); } catch (_) { return "[]"; }
}

function parsePaymentRows_(value) {
  if (Array.isArray(value)) return value;
  const raw = clean_(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function requireDcName_(value) {
  const key = normalizeDcKey_(value);
  if (!key || !DC_ALIAS_MAP[key]) throw new Error("Invalid DC Name: " + clean_(value));
  return DC_ALIAS_MAP[key];
}

function safeDcName_(value) {
  try { return requireDcName_(value); } catch (_) { return ""; }
}

function buildDcAliasMap_() {
  const map = {};
  DC_NAMES.forEach(function(name) { map[normalizeDcKey_(name)] = name; });
  map.SEONIT = "SEONI (T)";
  map.SEONIRES = "SEONI (RES)";
  map.CHHAPARA1 = "CHHAPARA-1";
  map.CHHAPARA2 = "CHHAPARA-2";
  map.PANDIYACHHAPARA = "PANDIYA CHHAPARA";
  map.KHAIRAPALARI = "KHAIRAPALARI";
  return map;
}

function normalizeDcKey_(value) {
  return clean_(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeIvrs_(value) {
  return String(value || "").replace(/[^0-9]/g, "").trim();
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || "Asia/Kolkata", "dd/MM/yyyy");
}

function formatDateValue_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return formatDate_(value);
  return clean_(value);
}

function formatTime_(value) {
  const tz = Session.getScriptTimeZone() || "Asia/Kolkata";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, tz, "HH:mm");
  }
  const raw = clean_(value);
  const match = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  return match ? String(match[1]).padStart(2, "0") + ":" + match[2] : raw;
}

function clean_(value) {
  return String(value === null || value === undefined ? "" : value).replace(/\s+/g, " ").trim();
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
