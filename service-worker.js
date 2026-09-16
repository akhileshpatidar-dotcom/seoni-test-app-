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

// ITEM-10 PHASE-1 FIX (2026-09-16): yeh STAGING copy hai. Live app ka same
// origin (akhileshpatidar-dotcom.github.io) hai, bas alag path - Cache
// Storage origin-wide shared hota hai, isliye staging ka cache-name live se
// alag rakhna mandatory hai (warna dono ke cached files aapas me mix ho
// sakte hain). Yeh cache-name sirf yahi STAGING repo me hai, live
// service-worker.js kabhi nahi badla.
// ITEM-10 PHASE-1 FIX v2 (2026-09-16): naam "seoni-app-shell-STAGING-v1" se
// badal ke "seoni-staging-app-shell-v1" kiya - purana naam bhi "seoni-app-"
// se start hota tha, jo app.js ke refreshAppNow() ke "seoni-app-" prefix-match
// se collide karta tha (Refresh button dabane par staging se live ka
// "seoni-app-shell-v2" bhi delete ho sakta tha). Naya naam "seoni-app-" prefix
// se start hi nahi hota, isliye ab poori tarah isolated hai.
const CACHE_VERSION = "seoni-staging-app-shell-v1";

// ITEM-10 PHASE-1 FIX (2026-09-16): STAGING me sirf ek naya file add hua hai -
// tailwind-generated.css (Tailwind CDN ka production-build replacement). Live
// SHELL_FILES abhi bhi bilkul waisa hi hai jaisa tha.
const SHELL_FILES = [
    "./index.html",
    "./styles.css",
    "./tailwind-generated.css",
    "./app.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

// index.html/styles.css/app.js — teeno hi app ka "core code" hain (pehle sab
// index.html me hi inline the, ab teen files me split hain). In teeno ko
// network-first rakha hai taaki deploy ke turant baad latest version mile,
// CACHE_VERSION bump ka wait na karna pade.
// ITEM-10 PHASE-1 FIX (2026-09-16): tailwind-generated.css ko bhi isi list me
// daala hai (styles.css jaisa hi core-styling asset hai), taaki Tailwind CSS
// build me har naya deploy turant reflect ho, purani cached CSS na dikhe.
const NETWORK_FIRST_FILES = ["/index.html", "/styles.css", "/tailwind-generated.css", "/app.js"];

// In-app CDN libraries (opaque/no-cors cache — cross-origin, cache-first hai
// kyunki ye rarely change hote hain aur data nahi hain)
const CDN_FILES = [
    "https://cdn.tailwindcss.com",
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
                    fetch(url)
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
            // ITEM-10 PHASE-1 FIX (2026-09-16): pehle "key !== CACHE_VERSION" wali
            // saari cache-keys delete ho jaati thi - staging aur live SAME ORIGIN
            // (akhileshpatidar-dotcom.github.io) share karte hain, isliye agar
            // staging ka service-worker kabhi live ke "seoni-app-shell-v2" (ya koi
            // aur origin-wide cache) ke saath activate hota, to wo bhi delete ho
            // sakta tha - live app ke liye offline/PWA cache achanak ud sakta tha.
            // Ab sirf STAGING prefix ("seoni-staging-app-shell-") wali PURANI
            // (current CACHE_VERSION se alag) keys hi delete hoti hain - live ka
            // "seoni-app-shell-v2" ya koi bhi non-staging cache kabhi touch nahi hota.
            Promise.all(
                keys
                    .filter((key) => key.startsWith("seoni-staging-app-shell-") && key !== CACHE_VERSION)
                    .map((key) => caches.delete(key))
            )
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
    return NETWORK_FIRST_FILES.some((suffix) => url.endsWith(suffix));
}

self.addEventListener("fetch", (event) => {
    const url = event.request.url;

    // Data/API calls: seedha network se, koi caching/interception nahi (aaj jaisa hi behavior)
    if (isDataRequest(url) || event.request.method !== "GET") {
        return;
    }

    // App shell code (HTML/CSS/JS) / same-origin navigations: network-first, taaki latest
    // version hamesha mile; offline hone par hi cached (purani) copy dikhe.
    if (event.request.mode === "navigate" || isNetworkFirstFile(url) || url.endsWith("/")) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // RELIABILITY FIX (2026-09-15, USER-REQUESTED): pehle har
                    // response (chahe 404/500 transient error ho) cache ho jaata
                    // tha - ek baar ka server glitch cache me "sach" ban ke reh
                    // jaata aur baad me (offline/slow-network fallback me) dobara
                    // serve ho sakta tha. Ab sirf successful (response.ok) response
                    // hi cache hoti hai - ek failed fetch purani valid cache ko
                    // kabhi overwrite nahi karega.
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
        );
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
            }).catch(() => cached);
        })
    );
});
