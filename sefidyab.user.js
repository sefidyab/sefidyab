// ==UserScript==
// @name         X Iran OSINT Extractor
// @namespace    sefidyab.network.osint
// @version      0.7.3
// @description  Promoting transparency on X. Identifies location & risk factors for verified accounts.
// @author       Sefid Yab Security Team
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    /***************
     * 1. CONFIG & STYLES
     ***************/
    const STORAGE_KEY = "tn_osint_db_v1";
    const SCAN_INTERVAL_MS = 1200;
    const TIMELINE_SCAN_MS = 2000;

    const AUTO_FETCH_ABOUT = true;
    const ABOUT_FETCH_DELAY_MS = 3000;
    const ABOUT_FETCH_MAX_PER_MIN = 15;

    // Regex Patterns
    const BASED_IN_REGEX = /Account based in\s+([A-Za-z ]+)|Based in\s+([A-Za-z ]+)|اکانت\s+مستقر\s+در\s+([^\n]+)/i;
    const VPN_WARN_REGEX = /(may not be accurate|vpn|proxy|location may be approximate|ممکن است دقیق نباشد|فیلترشکن|پروکسی)/i;
    const CONNECTED_VIA_REGEX = /(Connected via|Connection via|اتصال از طریق)\s+([^\n]+)/i;
    const JOINED_REGEX = /(Joined|تاریخ پیوستن)\s+([A-Za-z]+\s+\d{4}|\d{4})/i;

    // Inject CSS (Modern Service Theme - Light)
    const STYLE = `
    :root {
      --tn-bg: #ffffff;
      --tn-bg-glass: rgba(255, 255, 255, 0.95);
      --tn-border: #eff3f4;
      --tn-text: #0f1419;
      --tn-text-dim: #536471;
      --tn-accent: #1d9bf0;
      --tn-danger: #f91880;
      --tn-warn: #ffd400;
      --tn-success: #00ba7c;
      --tn-font: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --tn-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .tn-badge {
      font-family: var(--tn-font); font-size: 11px; font-weight: 700;
      margin-left: 6px; padding: 2px 8px; border-radius: 999px;
      border: 1px solid transparent; cursor: pointer; user-select: none;
      display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
      transition: all 0.2s ease; line-height: 1.2;
    }
    .tn-badge:hover { transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    
    .tn-badge-default { background: #eff3f4; color: var(--tn-text-dim); }
    .tn-badge-extract { background: #e8f5fd; color: var(--tn-accent); }
    .tn-badge-danger  { background: #ffe9f0; color: var(--tn-danger); }
    
    .tn-panel {
      position: fixed; z-index: 999999; background: var(--tn-bg-glass);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--tn-border); border-radius: 16px; color: var(--tn-text);
      font-family: var(--tn-font); box-shadow: var(--tn-shadow);
      font-size: 13px; opacity: 0; transform: translateY(10px);
      transition: opacity 0.2s, transform 0.2s; pointer-events: none;
    }
    .tn-panel.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
    
    .tn-row { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
    .tn-btn { border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s; }
    .tn-btn:hover { opacity:0.9; transform:scale(1.02); }
    .tn-val { font-family: monospace; background: #eff3f4; padding: 2px 6px; border-radius: 4px; color: var(--tn-text); }
  `;

    const styleEl = document.createElement("style");
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    /***************
     * 2. DATABASE
     ***************/
    let db = {};
    try { db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { db = {}; }
    function saveDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

    /***************
     * 3. EXPORT PANEL
     ***************/
    let panelEl;
    function initPanel() {
        if (panelEl) return;
        panelEl = document.createElement("div");
        panelEl.className = "tn-panel visible";
        panelEl.style.bottom = "20px";
        panelEl.style.right = "20px";
        panelEl.style.width = "300px";
        panelEl.style.padding = "20px";

        panelEl.innerHTML = `
      <div class="tn-row" style="margin-bottom:16px; border-bottom:1px solid var(--tn-border); padding-bottom:10px;">
        <div style="font-weight:800; font-size:14px; display:flex; gap:6px; align-items:center;">
             <span>SY</span> Sefid Yab
        </div>
        <div id="tn-close-panel" style="cursor:pointer; font-size:18px; line-height:1; opacity:0.6;">×</div>
      </div>
      <div id="tn-last" style="height:60px; overflow:hidden; font-size:11px; color:var(--tn-text-dim); margin-bottom:16px; line-height:1.5;">
        Standing by for analysis...
      </div>
      <div class="tn-row" style="gap:8px;">
        <button id="tn-export-json" class="tn-btn" style="flex:1; background:var(--tn-accent); color:white;">JSON Export</button>
        <button id="tn-export-csv" class="tn-btn" style="flex:1; background:var(--tn-text); color:white;">CSV Export</button>
      </div>
      <div style="margin-top:10px; font-size:11px; text-align:center; color:var(--tn-text-dim);">
        <span id="tn-count" style="color:var(--tn-text); font-weight:bold;">0</span> profiles indexed
      </div>
    `;

        document.body.appendChild(panelEl);
        panelEl.querySelector("#tn-close-panel").onclick = () => panelEl.remove();
        panelEl.querySelector("#tn-export-json").onclick = exportJSON;
        panelEl.querySelector("#tn-export-csv").onclick = exportCSV;
        updatePanel();
    }

    function updatePanel(lastRec) {
        if (!panelEl) return;
        panelEl.querySelector("#tn-count").textContent = Object.keys(db).length;
        if (lastRec) {
            const txt = `@${lastRec.handle} identified in ${lastRec.based_in || 'Unknown'}.`;
            panelEl.querySelector("#tn-last").textContent = txt;
        }
    }

    function downloadFile(name, content, mime = "text/plain") {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([content], { type: mime }));
        a.download = name; a.click();
    }
    function exportJSON() { downloadFile("sefidyab_data.json", JSON.stringify(Object.values(db), null, 2), "application/json"); }
    function exportCSV() {
        const items = Object.values(db); if (!items.length) return alert("Empty DB");
        const cols = ["handle", "based_in", "vpn_warning", "joined", "followers", "posts", "detected_at"];
        const csv = [cols.join(",")].concat(items.map(i => cols.map(c => `"${(i[c] || "").toString().replace(/"/g, '""')}"`).join(","))).join("\n");
        downloadFile("sefidyab_data.csv", csv, "text/csv");
    }

    /***************
     * 4. EXTRACTION ENGINE
     ***************/
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function getHandleFromUrl() {
        const path = location.pathname.split("/").filter(Boolean);
        if (!path.length || ["home", "notifications", "messages", "settings"].includes(path[0])) return null;
        return path[0];
    }
    function getPageText() {
        const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (modal) return modal.innerText;
        const mainCol = document.querySelector('[data-testid="primaryColumn"]');
        return mainCol ? mainCol.innerText : document.body.innerText;
    }
    function parseNumber(str) {
        if (!str) return null;
        str = str.toUpperCase().replace(/,/g, "").trim();
        let mul = 1; if (str.endsWith("K")) mul = 1000; else if (str.endsWith("M")) mul = 1000000;
        const num = parseFloat(str); return isNaN(num) ? null : Math.floor(num * mul);
    }

    // --- CORE BACKGROUND SCAN ---
    async function scanBackground(handle) {
        try {
            const response = await fetch(`https://x.com/${handle}/about`);
            if (!response.ok) throw new Error("Net Error");

            const html = await response.text();
            const virtualDoc = document.createElement("div");
            virtualDoc.innerHTML = html;
            const txt = virtualDoc.innerText;

            const basedIn = txt.match(BASED_IN_REGEX)?.[1] || txt.match(BASED_IN_REGEX)?.[2];
            const vpn = VPN_WARN_REGEX.test(txt);
            const joined = txt.match(JOINED_REGEX)?.[2];

            if (basedIn || vpn || joined) {
                db[handle] = {
                    handle,
                    based_in: basedIn ? basedIn.trim() : null,
                    vpn_warning: vpn,
                    joined: joined,
                    detected_at: new Date().toISOString()
                };
                saveDB();
                updatePanel(db[handle]);

                // Update all badges for this user
                document.querySelectorAll(".tn-badge").forEach(el => {
                    if (el.__handle === handle) updateBadge(el, handle);
                });
            }
        } catch (e) {
            // Fallback to window open if strictly needed, but prefer silent fail in bg
            console.warn("BG Scan fail", e);
        }
    }

    /***************
     * 5. BADGE LOGIC
     ***************/
    function getFlag(country) {
        if (!country) return "🏳️";
        const lower = country.toLowerCase();
        if (lower.includes("iran") || lower.includes("ایران")) return `<img src="https://flagcdn.com/16x12/ir.png" style="vertical-align:-2px;border-radius:2px;">`;
        if (lower.includes("united states") || lower.includes("usa")) return `<img src="https://flagcdn.com/16x12/us.png" style="vertical-align:-2px;border-radius:2px;">`;
        return "🌍";
    }

    function createBadge(handle) {
        const b = document.createElement("span");
        b.className = "tn-badge tn-badge-default";
        b.__handle = handle;
        b.textContent = "Check";
        b.onclick = (e) => { e.stopPropagation(); handleBadgeClick(b, handle); };
        updateBadge(b, handle);
        return b;
    }

    function updateBadge(el, handle) {
        const data = db[handle];
        if (!data || !data.based_in) {
            el.className = "tn-badge tn-badge-default";
            el.innerHTML = `<span>Verify</span>`;
            return;
        }
        const isIran = /iran|ایران|west asia/i.test(data.based_in);
        el.className = isIran ? "tn-badge tn-badge-danger" : "tn-badge tn-badge-extract";
        const flag = getFlag(data.based_in);
        el.innerHTML = `${flag} ${data.based_in.substring(0, 12)}`;
        el.onmouseenter = (e) => showPopup(e, handle);
        el.onmouseleave = hidePopup;
    }

    async function handleBadgeClick(el, handle) {
        if (db[handle]?.based_in) {
            showPopup({ clientX: el.getBoundingClientRect().left, clientY: el.getBoundingClientRect().top }, handle);
            return;
        }
        el.innerHTML = "Checking...";
        el.className = "tn-badge tn-badge-extract";
        await scanBackground(handle);
    }

    let popupEl, hideTimer;
    function showPopup(e, handle) {
        clearTimeout(hideTimer);
        const data = db[handle];
        if (!data) return;
        if (!popupEl) {
            popupEl = document.createElement("div");
            popupEl.className = "tn-panel";
            popupEl.style.width = "260px"; popupEl.style.padding = "16px";
            document.body.appendChild(popupEl);
        }
        const isSafe = !/iran|ایران/.test(data.based_in);
        const riskColor = isSafe ? "var(--tn-success)" : "var(--tn-danger)";
        const riskText = isSafe ? "Verified Location" : "High Risk / Direct Access";

        popupEl.innerHTML = `
          <div style="font-weight:bold; color:${riskColor}; margin-bottom:12px; border-bottom:1px solid var(--tn-border); padding-bottom:8px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">${riskText}</div>
          <div class="tn-row"><span style="color:var(--tn-text-dim)">Location</span> <span style="font-weight:600">${data.based_in}</span></div>
          <div class="tn-row"><span style="color:var(--tn-text-dim)">VPN Check</span> <span class="tn-val">${data.vpn_warning ? '⚠️ DETECTED' : 'CLEAR'}</span></div>
          <div class="tn-row"><span style="color:var(--tn-text-dim)">Date Joined</span> <span>${data.joined || '-'}</span></div>
      `;
        popupEl.style.left = (e.clientX + 20) + "px";
        popupEl.style.top = (e.clientY + 20) + "px";
        popupEl.classList.add("visible");
    }
    function hidePopup() { hideTimer = setTimeout(() => { if (popupEl) popupEl.classList.remove("visible"); }, 300); }

    // QUEUE & INJECT
    let queue = [];
    function processQueue() {
        if (!queue.length) return;
        const handle = queue.shift();
        if (db[handle]?.based_in) return;
        scanBackground(handle);
    }
    setInterval(processQueue, ABOUT_FETCH_DELAY_MS);

    function inject() {
        // Profile
        const userName = document.querySelector('[data-testid="UserName"]');
        if (userName && !userName.querySelector('.tn-badge')) {
            const h = getHandleFromUrl();
            if (h) userName.appendChild(createBadge(h));
        }
        // Timeline
        document.querySelectorAll('[data-testid="User-Name"]').forEach(row => {
            if (row.querySelector('.tn-badge')) return;
            const link = row.querySelector('a[href^="/"]');
            if (!link) return;
            const href = link.getAttribute("href");
            const handle = href.substring(1);
            if (handle.includes("/")) return;
            // Add to BG queue ONLY if truly needed to avoid spam
            if (!db[handle] && AUTO_FETCH_ABOUT) queue.push(handle);
            row.appendChild(createBadge(handle));
        });
    }

    function scanPage() {
        const handle = getHandleFromUrl();
        if (!handle) return;
        const text = getPageText();
        const basedIn = text.match(BASED_IN_REGEX)?.[1] || text.match(BASED_IN_REGEX)?.[2];
        const vpn = VPN_WARN_REGEX.test(text);
        if (basedIn || vpn) {
            db[handle] = { handle, based_in: basedIn?.trim(), vpn_warning: vpn, detected_at: new Date().toISOString() };
            saveDB(); updatePanel(db[handle]);
            document.querySelectorAll(".tn-badge").forEach(el => { if (el.__handle === handle) updateBadge(el, handle); });
        }
    }

    initPanel();
    setInterval(() => { inject(); scanPage(); }, 1000);
})();
