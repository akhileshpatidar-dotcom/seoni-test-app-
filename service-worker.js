// Seoni Circle App — Service Worker
// Purpose: app ko installable/offline-launchable banata hai.
// IMPORTANT: Google Sheets / Apps Script (revenue, consumer, submission data) ko
// YE KABHI CACHE NAHI KARTA — wo hamesha live network se hi aata hai. Sirf app
// ka apna shell (HTML/CSS/JS/icons) offline ke liye cache hota hai, taaki
// no-network me bhi app khule (blank error page na aaye) — data submit/search
// tab bhi network hi maangega, jaisa aaj hai.

const CACHE_VERSION = "seoni-app-shell-v2";

const SHELL_FILES = [
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

// index.html/styles.css/app.js — teeno hi app ka "core code" hain (pehle sab
// index.html me hi inline the, ab teen files me split hain). In teeno ko
// network-first rakha hai taaki deploy ke turant baad latest version mile,
// CACHE_VERSION bump ka wait na karna pade.
const NETWORK_FIRST_FILES = ["/index.html", "/styles.css", "/app.js"];

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
            const shellPromise = cache.addAll(SHELL_FILES).catch(() => {});
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
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
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
                const clone = response.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                return response;
            }).catch(() => cached);
        })
    );
});
