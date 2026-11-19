// Seoni Circle App — Service Worker
// ORIGINAL AUTHORSHIP SIGNATURE (2026-09-14) - do not remove.
// Original developer: Akhilesh Patidar (AE).
// Source repo: github.com/akhileshpatidar-dotcom/patidar-seoni-circle-app
// Build signature: SC-AKP-2026
// Purpose: app ko installable/offline-launchable banata hai.
// IMPORTANT: Google Sheets / Apps Script (revenue, consumer, submission data) ko
// YE KABHI CACHE NAHI KARTA — wo hamesha live network se hi aata hai. Sirf app
// ka apna shell (HTML/CSS/JS/icons) offline ke liye cache hota hai, taaki
// no-network me bhi app khule (blank error page na aaye) — data submit/search
// tab bhi network hi maangega, jaisa aaj hai.

const CACHE_VERSION = "seoni-app-shell-v6";

const SHELL_FILES = [
    "./index.html",
    "./styles.css",
    "./tailwind.css",
    "./app.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

// index.html/styles.css/app.js — teeno hi app ka "core code" hain (pehle sab
// index.html me hi inline the, ab teen files me split hain). In teeno ko
// network-first rakha hai taaki deploy ke turant baad latest version mile,
// CACHE_VERSION bump ka wait na karna pade.
const NETWORK_FIRST_FILES = ["/index.html", "/styles.css", "/tailwind.css", "/app.js",
    // 2026-09-29 (USER "(g) kar do"): in files ka naya version bhi upload hote hi sabko mile
    // (pehle cache-first the - ek baar phone me aane ke baad purani copy hi chalti rehti).
    "/image-to-excel.html", "/tools-tailwind.css", "/manifest.json",
    "/icon-192.png", "/icon-512.png", "/icon-512-maskable.png"];

// In-app CDN libraries (opaque/no-cors cache — cross-origin, cache-first hai
// kyunki ye rarely change hote hain aur data nahi hain)
const CDN_FILES = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            // RELIABILITY FIX (2026-09-15, USER-REQUESTED): pehle cache.addAll()
            // istemal hota tha - ye "all-or-nothing" hai: SHELL_FILES me se EK bhi
            // file fetch fail ho (404/missing), to poori list (index.html/
            // styles.css/app.js sahit) cache hone se reh jaati thi - sirf
            // .catch(()=>{}) install crash hone se bachata tha, offline support
            // silently poora fail ho jaata tha. Ab har file ALAG-ALAG fetch+cache
            // hoti hai, aur sirf successful (response.ok) response hi cache hoti
            // hai - ek file fail ho to baaki sab phir bhi cache ho jaati hain.
            const shellPromise = Promise.all(
                SHELL_FILES.map((url) =>
                    fetch(url, { cache: "no-cache" }) // 2026-10-28: HTTP cache ki purani copy nahi - hamesha taaza shell
                        .then((res) => { if (res && res.ok) return cache.put(url, res); })
                        .catch(() => {})
                )
            );
            const cdnPromise = Promise.all(
                CDN_FILES.map((url) => fetch(url, { mode: "no-cors" }).then((res) => cache.put(url, res)).catch(() => {}))
            );
            return Promise.all([shellPromise, cdnPromise]);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// In-app "Refresh" button (app.js ka refreshAppNow()) se aane wala message —
// agar kabhi koi naya SW version "waiting" me atak jaye, to usko turant
// activate karwa do taaki user ko dobara app band-open na karna pade.
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

function isDataRequest(url) {
    // Google Sheets / Apps Script / any live data source — kabhi cache/intercept nahi karna
    return url.includes("docs.google.com") ||
        url.includes("script.google.com") ||
        url.includes("googleusercontent.com");
}

function isNetworkFirstFile(url) {
    // BUG FIX (2026-09-23, USER-REPORTED - iPhone par naya update nahi dikha):
    // index.html app.js ko "app.js?v=..." (query ke saath) load karta hai, isliye
    // pehle url.endsWith("/app.js") kabhi match nahi hota tha aur app.js galti se
    // CACHE-FIRST ban jaata tha - purani cached copy hi chalti rehti thi (khaaskar
    // iPhone/Safari par). Ab query-string hata kar sirf path match karte hain.
    let path = url;
    try { path = new URL(url).pathname; } catch (_) {}
    return NETWORK_FIRST_FILES.some((suffix) => path.endsWith(suffix));
}

// 2026-10-28 (USER REPORT - mobile par app 2-5 sec leta/kabhi white screen): har shell file (index.html, styles.css,
// tailwind.css, app.js) ka alag 3 sec wait ek ke baad ek jud jaata tha (kabhi 9-12 sec). Ab ek baar network dheema
// nikle to agle 90 sec tak baaki files turant (0.3 sec wait) cache se aati hain.
let scSlowUntil = 0;

const SC_CORE_SHELL_ = ["./index.html", "./styles.css", "./tailwind.css", "./app.js"];
function scIsCoreShell_(req) {
    let path = "";
    try { path = new URL(req.url).pathname; } catch (_) { return false; }
    if (req.mode === "navigate") return path.endsWith("/") || path.endsWith("/index.html"); // image-to-excel.html jaise doosre pages nahi
    return ["/styles.css", "/tailwind.css", "/app.js"].some((f) => path.endsWith(f));
}
let scRevalPromise_ = null;
let scRevalAt_ = 0;
// Chaaron core files naye version se (ya koi ek bhi na mile to kuch nahi badalta) - aadhi-adhoori update kabhi nahi.
function scRevalidateShell_() {
    if (scRevalPromise_) return scRevalPromise_;
    if (Date.now() - scRevalAt_ < 10000) return Promise.resolve();
    scRevalAt_ = Date.now();
    scRevalPromise_ = (async () => {
        try {
            await new Promise((r) => setTimeout(r, 2500)); // app ko pehle poora khulne do
            const resps = await Promise.all(SC_CORE_SHELL_.map((u) => fetch(u, { cache: "no-cache" }).then((r) => (r && r.ok ? r : null)).catch(() => null)));
            if (resps.some((r) => !r)) return;
            const cache = await caches.open(CACHE_VERSION);
            await Promise.all(SC_CORE_SHELL_.map((u, i) => cache.put(u, resps[i])));
        } catch (_) {}
    })().finally(() => { scRevalPromise_ = null; });
    return scRevalPromise_;
}
async function scServeCoreShell_(event) {
    const req = event.request;
    let cached;
    try {
        const cache = await caches.open(CACHE_VERSION);
        cached = req.mode === "navigate" ? ((await cache.match("./index.html")) || (await cache.match(req))) : await cache.match(req);
    } catch (_) {}
    if (cached) {
        event.waitUntil(scRevalidateShell_());
        return cached;
    }
    // Phone me copy nahi (pehli baar / cache saaf) - network se (pehle jaisa)
    try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req.mode === "navigate" ? "./index.html" : req, clone)); // navigation hamesha ek hi key (index.html) par
        }
        return res;
    } catch (_) {
        return Response.error();
    }
}

self.addEventListener("fetch", (event) => {
    const url = event.request.url;

    // Data/API calls: seedha network se, koi caching/interception nahi (aaj jaisa hi behavior)
    if (isDataRequest(url) || event.request.method !== "GET") {
        return;
    }

    // 2026-10-28 (USER REQUEST - "app lagbhag turant khule, nayi version peechhe aati rahe"): app ke 4 mukhya
    // files (index.html, styles.css, tailwind.css, app.js) ab phone ki copy se TURANT khulte hain; peechhe se
    // teeno-chaaron ek saath (all-or-nothing) naye version se badal jaate hain - agli baar app kholne par nayi
    // version milti hai. Phone me copy na ho (pehli baar) to network se hi aata hai. Upload ke baad nayi version
    // pehle open par nahi, DOOSRE open par dikhti hai (ya app ka Refresh button turant naya laa deta hai).
    if (url.startsWith(self.location.origin) && scIsCoreShell_(event.request)) {
        event.respondWith(scServeCoreShell_(event));
        return;
    }

    // App shell code (HTML/CSS/JS) / same-origin navigations: network-first, taaki latest
    // version hamesha mile; offline hone par hi cached (purani) copy dikhe.
    // 2026-09-25 FIX: network-first sirf apni app ki files (same-origin) ke liye.
    // Pehle "https://cdn.tailwindcss.com/" bhi "/" par khatam hone se is branch
    // me aa jaata tha; network fail hone par undefined response jaata tha
    // ("Failed to convert value to 'Response'"). Ab CDN files neeche wale
    // cache-first branch me jaati hain (install ke waqt cache ho chuki hain).
    const isSameOrigin = url.startsWith(self.location.origin);
    if (event.request.mode === "navigate" || (isSameOrigin && (isNetworkFirstFile(url) || url.endsWith("/")))) {
        // PERMANENT UPDATE FIX (2026-09-24, USER REQUEST - "iPhone ke liye baar-baar
        // version badalna na pade, Android/iPhone dono ka ek hi flow ho"): app shell
        // (index.html/styles.css/app.js) ab browser ke HTTP cache ko bhi BYPASS karke
        // hamesha server se check hota hai (cache: "no-cache" = har baar GitHub se
        // confirm, file same ho to turant). Isse GitHub par nayi file upload karte hi
        // Android + iPhone dono ko agli baar app kholne par wahi nayi file milti hai -
        // index.html me "app.js?v=..." badalne ki ab koi zaroorat NAHI hai.
        // Offline hone par pehle jaisa hi purani cached copy chalti hai.
        // 2026-10-25 (USER REPORT - mobile par app kholne me 2-5 sec lagte/kabhi khulta hi nahi): pehle network
        // dheemi/atak jaye to fetch ka koi time-limit nahi tha, isliye app tab tak nahi khulta tha. Ab network ko
        // 3 sec ka time milta hai; us se der ho aur cached copy maujood ho to turant cached copy se app khul jaati hai,
        // aur network wala fetch peechhe poora hokar cache update kar deta hai (agli baar naya version milega).
        // Network jaldi mile to pehle jaisa hi - sabse naya version. Cached copy na ho to network ka intezaar pehle jaisa.
        const SC_NET_WAIT_MS = Date.now() < scSlowUntil ? 300 : 2500;
        const netPromise = fetch(event.request, { cache: "no-cache" }).then((response) => {
            if (response && response.ok) {
                const clone = response.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
            }
            return response;
        });
        const cachedFallback = () => caches.match(event.request)
            .then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined));
        event.waitUntil(netPromise.catch(() => {}));
        event.respondWith(new Promise((resolve) => {
            let settled = false;
            const finish = (res) => { if (!settled) { settled = true; resolve(res); } };
            const timer = setTimeout(() => { cachedFallback().then((c) => { if (c) { scSlowUntil = Date.now() + 90000; finish(c); } }); }, SC_NET_WAIT_MS);
            netPromise.then((res) => { clearTimeout(timer); finish(res); })
                .catch(() => { clearTimeout(timer); cachedFallback().then((c) => finish(c || Response.error())); });
        }));
        return;
    }

    // CDN libraries / icons / manifest: cache-first (fast + rarely change), network fallback
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // RELIABILITY FIX (2026-09-15, USER-REQUESTED): sirf successful
                // (same-origin response.ok) YA opaque (cross-origin no-cors CDN,
                // jiska status introspect nahi ho sakta - response.ok isके liye
                // hamesha false dikhega chahe fetch sahi hui ho) response cache
                // hoti hai - ek confirmed error (jaise same-origin 404 on
                // icon/manifest) kabhi cache nahi hoti.
                if (response && (response.ok || response.type === "opaque")) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached || Response.error());
        })
    );
});

// ===== BACKGROUND SYNC (2026-09-27, USER REQUEST 6c) =====
// Android: Mobile Update / Meter Checking ki pending (offline) entry, app BAND ho tab bhi
// internet aate hi yahin se chali jaaye. App khula (screen par) ho to kuch nahi karta -
// tab app khud bhejta hai (dohri entry na jaaye). iPhone par yeh feature nahi hota - wahan
// pehle jaisa (app khulne par) hi chalega. Wahi niyam jo app me hai: "Already Submitted"
// wali entry hat-ti nahi (error ke saath rehti hai), server ki mana wali bhi rehti hai.
function scSwOffqDb_() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("seoni-offline-queue-v1", 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
function scSwTx_(db, mode, fn) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction("items", mode);
        const out = fn(tx.objectStore("items"));
        tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}
async function scSwBackgroundSync_() {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((c) => c.visibilityState === "visible")) return; // app khula hai - app khud bhejega
    const db = await scSwOffqDb_();
    const items = await new Promise((resolve, reject) => {
        const r = db.transaction("items", "readonly").objectStore("items").getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
    });
    let needRetry = false;
    for (const item of items) {
        if (item.alreadySubmitted || item.noBgSync) continue; // OFFLINE QUEUE 3: Vehicle/Court app khud check karke bhejta hai
        await scSwTx_(db, "readwrite", (st) => st.put({ ...item, bgInflightAt: Date.now() }));
        let kind = "retry", message = "";
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), item.timeoutMs || (item.type === "METER" ? 120000 : 45000));
            const res = await fetch(item.url, { method: "POST", headers: { "Content-Type": item.contentType }, body: item.body, signal: ctrl.signal });
            clearTimeout(t);
            const text = await res.text();
            let parsed = null;
            try { parsed = JSON.parse(text || "{}"); } catch (_) {}
            const isErr = parsed && (parsed.status === "error" || ((item.type === "METER" || item.strictStatus) && parsed.status && parsed.status !== "success"));
            if (isErr) {
                message = String(parsed.message || "");
                kind = /already submitted/i.test(message) ? "already" : "rejected";
            } else if (res.ok && parsed) kind = "ok";
        } catch (_) { kind = "retry"; }
        if (kind === "ok") {
            await scSwTx_(db, "readwrite", (st) => st.delete(item.id));
        } else if (kind === "already") {
            await scSwTx_(db, "readwrite", (st) => st.put({ ...item, bgInflightAt: 0, alreadySubmitted: true, lastError: "Yah consumer pehle se submit hai - ise Delete kar sakte hain" }));
        } else if (kind === "rejected") {
            await scSwTx_(db, "readwrite", (st) => st.put({ ...item, bgInflightAt: 0, lastError: message || "Server ne entry mana kar di" }));
        } else {
            await scSwTx_(db, "readwrite", (st) => st.put({ ...item, bgInflightAt: 0 }));
            needRetry = true;
        }
    }
    if (needRetry) throw new Error("retry-later"); // browser baad me dobara koshish karega
}
self.addEventListener("sync", (event) => {
    if (event.tag === "sc-offq-sync") event.waitUntil(scSwBackgroundSync_());
});
// ===== END BACKGROUND SYNC =====

// ===== PUSH NOTIFICATIONS (2026-11-19, USER REQUEST) =====
// Admin ka notice (Firebase Cloud Messaging) phone par alert ki tarah dikhta hai, app band ho tab bhi.
// Backend sirf "data" message bhejta hai (title/body/nid) - alert yahin banta hai, isliye dohra alert nahi aata.
self.addEventListener("push", (event) => {
    let p = {};
    try { p = event.data ? event.data.json() : {}; } catch (_) { try { p = { data: { body: event.data.text() } }; } catch (__) { p = {}; } }
    const n = (p && p.notification) || {};
    const d = (p && p.data) || {};
    const title = String(d.title || n.title || "Seoni Circle App");
    const body = String(d.body || n.body || "");
    event.waitUntil(self.registration.showNotification(title, {
        body,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: d.nid ? "seoni-" + d.nid : undefined,
        data: { nid: d.nid || "" }
    }));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        try {
            const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            for (const c of list) {
                if ("focus" in c) { await c.focus(); return; }
            }
            if (self.clients.openWindow) await self.clients.openWindow("./index.html");
        } catch (_) {}
    })());
});
