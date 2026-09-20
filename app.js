/**
 * =====================================================================
 * SEONI CIRCLE APP - UNIFIED SINGLE API BRIDGE & DYNAMIC CALCULATOR (app.js)
 * Master Endpoint Routing + Exact Form UI Binding + Live Reconciliation
 * =====================================================================
 */

// 1. SINGLE MASTER WEB APP URL (Yahan apna deploy kiya hua master URL rakhein)
const MASTER_SECURE_API_URL = "https://script.google.com/macros/s/AKfycbzaimPwzUYELgmujpaBbfByy0BcjOERA8e0mslNdbH5uUw2L6L24785obmdcpcDOc53Ww/exec";

// All individual script variables safely map to MASTER_SECURE_API_URL
const revenueScriptUrl = MASTER_SECURE_API_URL;
const revenueSubmitUrl = MASTER_SECURE_API_URL;
const mobileUpdateScriptUrl = MASTER_SECURE_API_URL;
const omvigScriptUrl = MASTER_SECURE_API_URL;
const shmsScriptUrl = MASTER_SECURE_API_URL;
const stmComplaintScriptUrl = MASTER_SECURE_API_URL;
const stockScriptUrl = MASTER_SECURE_API_URL;
const vrDownloadLogScriptUrl = MASTER_SECURE_API_URL;
const peakLoadScriptUrl = MASTER_SECURE_API_URL;
const feederReadingScriptUrl = MASTER_SECURE_API_URL;
const freezeTrackingScriptUrl = MASTER_SECURE_API_URL;
const meterCheckingScriptUrl = MASTER_SECURE_API_URL;

// Generic POST Dispatcher
async function postMasterApi(actionName, payloadObj) {
    const payload = Object.assign({ action: actionName }, payloadObj);
    const response = await fetch(MASTER_SECURE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload)
    });
    return await response.json();
}

// Generic GET Dispatcher
async function getMasterApi(actionName, paramsObj) {
    const params = Object.assign({ action: actionName }, paramsObj);
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${MASTER_SECURE_API_URL}?${query}`);
    return await response.json();
}

// =====================================================================
// 2. BIJLEE BILL CALCULATOR DYNAMIC UI & BACKEND BRIDGE
// =====================================================================

function onBillCalculatorCategoryChange() {
    const catSelect = document.getElementById("bc-category");
    const tfWrap = document.getElementById("bc-tariffcode-wrap");
    const tfSelect = document.getElementById("bc-tariffcode");
    const fieldsDiv = document.getElementById("bc-fields");
    const resultDiv = document.getElementById("bc-result");

    if (resultDiv) resultDiv.innerHTML = "";
    const cat = catSelect ? catSelect.value : "";
    if (!cat) {
        if (tfWrap) tfWrap.style.display = "none";
        if (fieldsDiv) fieldsDiv.innerHTML = "";
        return;
    }

    if (cat === "LV1" || cat === "LV2") {
        if (tfWrap) tfWrap.style.display = "none";
        renderBillCalculatorFields();
    } else {
        if (tfWrap) tfWrap.style.display = "block";
        if (tfSelect) {
            tfSelect.innerHTML = `<option value="${cat}-STD">${cat} Standard Supply</option>`;
        }
        renderBillCalculatorFields();
    }
}

function renderBillCalculatorFields() {
    const cat = document.getElementById("bc-category") ? document.getElementById("bc-category").value : "";
    const fieldsDiv = document.getElementById("bc-fields");
    if (!fieldsDiv) return;

    if (cat === "LV1" || cat === "LV2" || cat === "LV3" || cat === "LV6") {
        fieldsDiv.innerHTML = `
            <div style="margin-top:10px;">
                <label style="display:block; font-size:0.62rem; font-weight:900; color:#1d4ed8; margin-bottom:4px;">CONSUMED UNITS (KWH)</label>
                <input id="bc-units" type="number" inputmode="numeric" class="ivrs-input" placeholder="e.g. 150" style="text-align:center;">
            </div>
            <div style="margin-top:10px;">
                <label style="display:block; font-size:0.62rem; font-weight:900; color:#1d4ed8; margin-bottom:4px;">SANCTIONED LOAD (KW)</label>
                <input id="bc-load-kw" type="number" inputmode="numeric" class="ivrs-input" placeholder="e.g. 2" value="1" style="text-align:center;">
            </div>
        `;
    } else if (cat === "LV4") {
        fieldsDiv.innerHTML = `
            <div style="margin-top:10px;">
                <label style="display:block; font-size:0.62rem; font-weight:900; color:#1d4ed8; margin-bottom:4px;">CONSUMED UNITS (KWH)</label>
                <input id="bc-units" type="number" inputmode="numeric" class="ivrs-input" placeholder="e.g. 1000" style="text-align:center;">
            </div>
            <div style="margin-top:10px;">
                <label style="display:block; font-size:0.62rem; font-weight:900; color:#1d4ed8; margin-bottom:4px;">CONTRACT DEMAND / LOAD (HP)</label>
                <input id="bc-load-hp" type="number" inputmode="numeric" class="ivrs-input" placeholder="e.g. 15" value="10" style="text-align:center;">
            </div>
        `;
    } else if (cat === "LV5") {
        fieldsDiv.innerHTML = `
            <div style="margin-top:10px;">
                <label style="display:block; font-size:0.62rem; font-weight:900; color:#1d4ed8; margin-bottom:4px;">PUMP CAPACITY (HP)</label>
                <input id="bc-load-hp" type="number" inputmode="numeric" class="ivrs-input" placeholder="e.g. 5" value="5" style="text-align:center;">
            </div>
            <div style="margin-top:10px; display:flex; align-items:center; gap:8px;">
                <input id="bc-flat-rate" type="checkbox" style="width:18px; height:18px;" onchange="toggleLv5MeteredInput(this.checked)">
                <label for="bc-flat-rate" style="font-size:0.75rem; font-weight:800; color:#1e293b;">Flat Rate Connection (Unmetered)</label>
            </div>
            <div id="bc-lv5-units-wrap" style="margin-top:10px;">
                <label style="display:block; font-size:0.62rem; font-weight:900; color:#1d4ed8; margin-bottom:4px;">CONSUMED UNITS (KWH)</label>
                <input id="bc-units" type="number" inputmode="numeric" class="ivrs-input" placeholder="e.g. 400" style="text-align:center;">
            </div>
        `;
    }
}

function toggleLv5MeteredInput(isFlat) {
    const wrap = document.getElementById("bc-lv5-units-wrap");
    if (wrap) wrap.style.display = isFlat ? "none" : "block";
}

async function calculateBillEstimate() {
    const categoryEl = document.getElementById("bc-category");
    const resultDiv = document.getElementById("bc-result");
    if (!categoryEl || !categoryEl.value) {
        alert("Kripya Category select kijiye.");
        return;
    }

    const category = categoryEl.value;
    const units = document.getElementById("bc-units") ? Number(document.getElementById("bc-units").value) || 0 : 0;
    const loadKw = document.getElementById("bc-load-kw") ? Number(document.getElementById("bc-load-kw").value) || 1 : 1;
    const loadHp = document.getElementById("bc-load-hp") ? Number(document.getElementById("bc-load-hp").value) || 1 : 1;
    const isFlat = document.getElementById("bc-flat-rate") ? document.getElementById("bc-flat-rate").checked : false;

    if (resultDiv) {
        resultDiv.innerHTML = '<div class="app-sync-spinner"></div><p style="text-align:center; font-size:12px; font-weight:800; color:#0d9488; margin-top:8px;">Calculating Bill (Server Engine)...</p>';
    }

    try {
        const res = await postMasterApi("calculateBillEstimate", {
            category: category,
            units: units,
            load_kw: loadKw,
            load_hp: loadHp,
            is_flat_rate: isFlat
        });

        if (res.status !== "success") throw new Error(res.message || "Calculation failed");

        const data = res.billing_breakdown;
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div style="background:#ffffff; border:2px solid #0d9488; border-radius:16px; padding:16px; margin-top:12px; box-shadow:0 8px 20px rgba(13,148,136,0.12);">
                    <div style="font-size:14px; font-weight:900; color:#0f766e; text-align:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">BILL ESTIMATE (MPERC TARIFF)</div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:13px; font-weight:700;"><span>Energy Charge:</span><span>₹${data.energy_charge}</span></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:13px; font-weight:700;"><span>Fixed Charge:</span><span>₹${data.fixed_charge}</span></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:13px; font-weight:700;"><span>FCA Charge:</span><span>₹${data.fca_charge}</span></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:13px; font-weight:700;"><span>Electricity Duty:</span><span>₹${data.electricity_duty}</span></div>
                    <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:16px; font-weight:900; color:#000; border-top:2px solid #0d9488; padding-top:8px;"><span>Total Payable:</span><span>₹${data.total_payable}</span></div>
                </div>
            `;
        }
    } catch (err) {
        if (resultDiv) resultDiv.innerHTML = `<p style="color:#dc2626; font-weight:800; text-align:center;">Error: ${err.message}</p>`;
    }
}

// =====================================================================
// 3. PROGRESS REPORT & REVENUE RECONCILIATION INTEGRATION
// =====================================================================
async function fetchRevenueCategoryReconciliation(dcName, periodMode, periodValue, dcNamesList) {
    try {
        const payload = {
            action: "getRevenueCategoryReconciliation",
            period_mode: periodMode || "date",
            period_value: periodValue
        };
        if (dcName) {
            payload.dc_name = dcName;
        } else if (dcNamesList && dcNamesList.length) {
            payload.dc_names = Array.isArray(dcNamesList) ? dcNamesList.join(",") : dcNamesList;
        }

        const res = await postMasterApi("getRevenueCategoryReconciliation", payload);
        if (res && res.status === "success" && Array.isArray(res.entries)) {
            return res.entries;
        }
        return [];
    } catch (err) {
        console.error("Reconciliation Fetch Error:", err);
        return [];
    }
}

async function fetchLiveRevenueDailySummary(dateStr, dcName, dcNamesList) {
    try {
        const params = { action: "getLiveRevenueDailySummary", date: dateStr };
        if (dcName) params.dc_name = dcName;
        if (dcNamesList && dcNamesList.length) params.dc_names = Array.isArray(dcNamesList) ? dcNamesList.join(",") : dcNamesList;

        const res = await postMasterApi("getLiveRevenueDailySummary", params);
        if (res && res.status === "success" && Array.isArray(res.rows)) {
            return res.rows;
        }
        return [];
    } catch (err) {
        console.error("Live Summary Fetch Error:", err);
        return [];
    }
}

// 4. VOLTAGE REGULATION SERVER BRIDGE
async function vrCalculateAndRender() {
    const nodes = (typeof vrNodes !== "undefined") ? vrNodes : [];
    const lineType = document.getElementById("vr-line-type") ? document.getElementById("vr-line-type").value : "33kv";
    const conductor = document.getElementById("vr-conductor-type") ? document.getElementById("vr-conductor-type").value : "RACCOON";

    if (!nodes || nodes.length < 2) return;

    try {
        const res = await postMasterApi("calculateVR", { line_type: lineType, conductor: conductor, nodes: nodes });
        if (res.status === "success") {
            const tableBody = document.getElementById("vr-section-rows");
            if (tableBody) {
                tableBody.innerHTML = res.sections.map((s, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td class="vr-section-name">${s.section_name}</td>
                        <td>${s.length_km}</td>
                        <td>${s.section_kva}</td>
                        <td>${res.diversity_factor}</td>
                        <td>${res.conductor_constant}</td>
                        <td>${s.kva_km}</td>
                        <td>-</td>
                    </tr>
                `).join("");
            }
            const vrValEl = document.getElementById("vr-final-vr");
            if (vrValEl) vrValEl.innerHTML = `Total VR: <strong>${res.voltage_regulation_percent}%</strong> (${res.is_within_limit ? '<span style="color:#16a34a;">WITHIN LIMIT</span>' : '<span style="color:#dc2626;">EXCEEDS LIMIT</span>'})`;
        }
    } catch (e) {
        console.error("VR Calculation Error:", e);
    }
}