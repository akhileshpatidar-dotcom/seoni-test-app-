const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSnIKsqOhnFIYJJLIcEZNHINhqrVRFAOZcyrVA0-SjbcTMmHMseF-iypVZCaisOdeu7meiyy9CPnV-E/pub?output=csv";
const GOOGLE_SHEET_GVIZ_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSnIKsqOhnFIYJJLIcEZNHINhqrVRFAOZcyrVA0-SjbcTMmHMseF-iypVZCaisOdeu7meiyy9CPnV-E/gviz/tq?gid=0&tqx=out:json";
const MOBILE_UPDATE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrTLo4cPXRS2r6uv89IqvSzIsmEB99lon9eI9MzbEtTkLWWUHHTPLzqWo6yZhmFEtXXw/exec";

const csvFileInput = document.getElementById("csvFile");
const searchForm = document.getElementById("searchForm");
const whatsappForm = document.getElementById("whatsappForm");
const ivrsInput = document.getElementById("ivrsInput");
const whatsappInput = document.getElementById("whatsappInput");
const resultGrid = document.getElementById("resultGrid");
const resultName = document.getElementById("resultName");
const resultFather = document.getElementById("resultFather");
const resultAddress = document.getElementById("resultAddress");
const resultMobile = document.getElementById("resultMobile");
const resultsWrap = document.querySelector(".results-wrap");
const submitToast = document.getElementById("submitToast");

let consumerMap = new Map();
let currentRecord = null;
let submitToastTimer = null;
let pendingSubmitButton = null;
let pendingSubmitTimer = null;
let submitRequestId = 0;
let keyboardCloseTimer = null;

const columnAliases = {
  dc: ["dc name", "dc", "dcname"],
  ivrs: ["ivrs no", "ivrsno", "ivrs", "ivrs number", "ivrs_number", "consumer ivrs"],
  name: ["consumer name", "name", "customer name"],
  father: ["father name", "fathername", "fname"],
  address: ["address", "consumer address", "location"],
  mobile: ["mobile no", "mobile number", "mobile", "phone", "phone number", "contact"]
};

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumnIndex(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function showResult(record) {
  currentRecord = record;
  resultGrid.classList.remove("hidden");
  resultName.textContent = record.name || "-";
  resultFather.textContent = record.father || "-";
  resultAddress.textContent = record.address || "-";
  resultMobile.textContent = record.mobile || "-";
  whatsappForm.classList.remove("hidden");
  if (resultsWrap) {
    resultsWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function resetResult() {
  currentRecord = null;
  resultGrid.classList.add("hidden");
  whatsappForm.classList.add("hidden");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function loadCsvData(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV me data rows nahi mile.");
  }

  const headers = parseCsvLine(lines[0]);
  const dcIndex = findColumnIndex(headers, columnAliases.dc);
  const ivrsIndex = findColumnIndex(headers, columnAliases.ivrs);
  const nameIndex = findColumnIndex(headers, columnAliases.name);
  const fatherIndex = findColumnIndex(headers, columnAliases.father);
  const addressIndex = findColumnIndex(headers, columnAliases.address);
  const mobileIndex = findColumnIndex(headers, columnAliases.mobile);

  if ([dcIndex, ivrsIndex, nameIndex, fatherIndex, addressIndex, mobileIndex].includes(-1)) {
    throw new Error("CSV columns match nahi hui. DC NAME, IVRS NO, CONSUMER NAME, FATHER NAME, ADDRESS, MOBILE NO required hain.");
  }

  const nextMap = new Map();

  lines.slice(1).forEach((line) => {
    const columns = parseCsvLine(line);
    const ivrs = (columns[ivrsIndex] || "").replace(/\D/g, "");

    if (ivrs.length === 10) {
      nextMap.set(ivrs, {
        dc: columns[dcIndex] || "-",
        ivrs,
        name: columns[nameIndex] || "-",
        father: columns[fatherIndex] || "-",
        address: columns[addressIndex] || "-",
        mobile: columns[mobileIndex] || "-"
      });
    }
  });

  if (nextMap.size === 0) {
    throw new Error("Valid 10 digit IVRS data CSV me nahi mila.");
  }

  consumerMap = nextMap;
}

function loadTabularData(headers, rows) {
  const dcIndex = findColumnIndex(headers, columnAliases.dc);
  const ivrsIndex = findColumnIndex(headers, columnAliases.ivrs);
  const nameIndex = findColumnIndex(headers, columnAliases.name);
  const fatherIndex = findColumnIndex(headers, columnAliases.father);
  const addressIndex = findColumnIndex(headers, columnAliases.address);
  const mobileIndex = findColumnIndex(headers, columnAliases.mobile);

  if ([dcIndex, ivrsIndex, nameIndex, fatherIndex, addressIndex, mobileIndex].includes(-1)) {
    throw new Error("Sheet columns match nahi hui. DC NAME, IVRS NO, CONSUMER NAME, FATHER NAME, ADDRESS, MOBILE NO required hain.");
  }

  const nextMap = new Map();

  rows.forEach((columns) => {
    const ivrs = String(columns[ivrsIndex] ?? "").replace(/\D/g, "");

    if (ivrs.length === 10) {
      nextMap.set(ivrs, {
        dc: String(columns[dcIndex] ?? "-"),
        ivrs,
        name: String(columns[nameIndex] ?? "-"),
        father: String(columns[fatherIndex] ?? "-"),
        address: String(columns[addressIndex] ?? "-"),
        mobile: String(columns[mobileIndex] ?? "-")
      });
    }
  });

  if (nextMap.size === 0) {
    throw new Error("Valid 10 digit IVRS data sheet me nahi mila.");
  }

  consumerMap = nextMap;
}

function loadRemoteCsv() {
  if (window.EMBEDDED_CONSUMER_MAP && typeof window.EMBEDDED_CONSUMER_MAP === "object") {
    try {
      consumerMap = new Map(Object.entries(window.EMBEDDED_CONSUMER_MAP));
      resetResult();
      return;
    } catch (_) {
      consumerMap = new Map();
      resetResult();
    }
  }

  const previousHandler = window.google?.visualization?.Query?.setResponse;

  window.google = window.google || {};
  window.google.visualization = window.google.visualization || {};
  window.google.visualization.Query = window.google.visualization.Query || {};

  window.google.visualization.Query.setResponse = (response) => {
    try {
      const headers = (response.table?.cols || []).map((col) => col.label || col.id || "");
      const rows = (response.table?.rows || []).map((row) =>
        (row.c || []).map((cell) => {
          if (!cell || cell.v === null || cell.v === undefined) {
            return "";
          }
          return cell.v;
        })
      );

      loadTabularData(headers, rows);
      resetResult();
    } catch (error) {
      consumerMap = new Map();
      resetResult();
    } finally {
      window.google.visualization.Query.setResponse = previousHandler || function () {};
    }
  };

  const script = document.createElement("script");
  script.src = `${GOOGLE_SHEET_GVIZ_URL}&_=${Date.now()}`;
  script.async = true;
  script.onerror = () => {
    consumerMap = new Map();
    resetResult();
    window.google.visualization.Query.setResponse = previousHandler || function () {};
  };

  document.head.appendChild(script);
}

function showSubmitToast(message) {
  submitToast.textContent = message;
  submitToast.classList.remove("hidden");
  clearTimeout(submitToastTimer);
  submitToastTimer = setTimeout(() => {
    submitToast.classList.add("hidden");
  }, 3000);
}

function setKeyboardState(isOpen) {
  document.body.classList.toggle("keyboard-open", isOpen);
}

function closeKeyboardAndRevealHeader() {
  clearTimeout(keyboardCloseTimer);

  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }

  setKeyboardState(false);

  keyboardCloseTimer = setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 180);
}

function releaseSubmitButton() {
  clearTimeout(pendingSubmitTimer);
  pendingSubmitTimer = null;

  if (!pendingSubmitButton) {
    return;
  }

  pendingSubmitButton.textContent = "Submit";
  pendingSubmitButton.disabled = false;
  pendingSubmitButton = null;
}

function buildSubmitPayload(whatsappNo) {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB");
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return {
    "DC NAME": currentRecord.dc || "",
    "IVRS NO": currentRecord.ivrs || "",
    "CONSUMER NAME": currentRecord.name || "",
    "FATHER NAME": currentRecord.father || "",
    "ADDRESS": currentRecord.address || "",
    "MOBILE NO": currentRecord.mobile || "",
    "Correct Mobile No": whatsappNo,
    "Date-(dd/mm/yyyy)": date,
    "Time (hh:mm)": time
  };
}

csvFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const csvText = await file.text();
    loadCsvData(csvText);
    resetResult();
  } catch (error) {
    consumerMap = new Map();
    resetResult();
  }
});

ivrsInput.addEventListener("input", () => {
  ivrsInput.value = ivrsInput.value.replace(/\D/g, "").slice(0, 10);
});

whatsappInput.addEventListener("input", () => {
  whatsappInput.value = whatsappInput.value.replace(/\D/g, "").slice(0, 10);
});

[ivrsInput, whatsappInput].forEach((input) => {
  input.addEventListener("focus", () => {
    setKeyboardState(true);
  });

  input.addEventListener("blur", () => {
    clearTimeout(keyboardCloseTimer);
    keyboardCloseTimer = setTimeout(() => {
      setKeyboardState(false);
    }, 120);
  });
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const ivrs = ivrsInput.value.trim();

  if (consumerMap.size === 0) {
    resetResult();
    return;
  }

  if (!/^\d{10}$/.test(ivrs)) {
    resetResult();
    return;
  }

  const record = consumerMap.get(ivrs);

  if (!record) {
    resetResult();
    return;
  }

  showResult(record);
});

whatsappForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const whatsappNo = whatsappInput.value.trim();

  if (!currentRecord) {
    return;
  }

  if (!/^\d{10}$/.test(whatsappNo)) {
    whatsappInput.focus();
    return;
  }

  submitWhatsAppUpdate(whatsappNo);
});

async function submitWhatsAppUpdate(whatsappNo) {
  const submitButton = whatsappForm.querySelector('button[type="submit"]');

  try {
    submitButton.textContent = "Submitting...";
    submitButton.disabled = true;
    pendingSubmitButton = submitButton;
    submitRequestId += 1;
    const currentRequestId = submitRequestId;
    const payload = buildSubmitPayload(whatsappNo);

    const response = await new Promise((resolve) => {
      const callbackName = `whatsappSubmitCallback${currentRequestId}`;
      const scriptTag = document.createElement("script");

      const timeout = window.setTimeout(() => {
        cleanup();
        resolve({ status: "error", message: "Submit Failed" });
      }, 15000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        if (scriptTag.parentNode) {
          scriptTag.parentNode.removeChild(scriptTag);
        }
        try {
          delete window[callbackName];
        } catch (_) {
          window[callbackName] = undefined;
        }
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data || { status: "error", message: "Submit Failed" });
      };

      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        params.append(key, value);
      });
      params.append("callback", callbackName);
      scriptTag.src = `${MOBILE_UPDATE_SCRIPT_URL}?${params.toString()}`;
      scriptTag.async = true;
      scriptTag.onerror = () => {
        cleanup();
        resolve({ status: "error", message: "Submit Failed" });
      };

      document.body.appendChild(scriptTag);
    });

    const submitStatus = String(response.status || "");
    const submitMessage = response.message || "Submit Failed";
    const submitOk = submitStatus === "success";

    showSubmitToast(submitMessage);

    if (submitOk) {
      closeKeyboardAndRevealHeader();
      whatsappInput.value = "";
      resetResult();
      ivrsInput.value = "";
    }

    releaseSubmitButton();

  } catch (_) {
    showSubmitToast("Submit Failed");
    releaseSubmitButton();
  }
}

loadRemoteCsv();
