import { QS } from "./params.js";

// On-screen error log for TVs without devtools. Only active with ?debug=1
export let debugLog = () => {};
if (QS.get("debug")) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:0;top:0;right:0;z-index:9;padding:8px;background:#fff;color:#c00;font:20px monospace;white-space:pre-wrap";
  document.body.appendChild(box);
  debugLog = (m) => {
    box.textContent += m + "\n";
  };
  window.onerror = (m, src, line) => debugLog(m + " (line " + line + ")");
}
