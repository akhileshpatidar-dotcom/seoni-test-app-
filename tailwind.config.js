// ITEM-10 PHASE-1 (2026-09-16): Production Tailwind config for STAGING build only.
// content: index.html + app.js dono scan honge (dono me class="..." attributes hain
// jahan Tailwind utility classes use hoti hain - agar sirf index.html scan karte to
// app.js ke andar template-literal se render hone wale saare Tailwind classes
// missing/unstyled aa jaate).
//
// safelist: sirf un classes ke liye jo genuinely Tailwind utilities hain aur
// dynamically (JS expression se) banti hain, isliye static scanner unhe dekh
// nahi sakta:
//   - footerGridCols (app.js line ~5409) => "grid-cols-1" ya "grid-cols-2"
// Baaki saari dynamic class sources (rowClass => blue-bold/subdn-bold,
// status.className => chip-ok/chip-warn/chip-danger, stock-chip,
// stock-type-pill, pill-receive/pill-issue) CUSTOM CSS classes hain, jo
// styles.css me already defined hain (Tailwind utilities nahi) - unhe
// safelist me daalne ki zaroorat nahi hai.
module.exports = {
  content: ["./index.html", "./app.js"],
  safelist: [
    "grid-cols-1",
    "grid-cols-2"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
