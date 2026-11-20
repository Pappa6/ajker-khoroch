/* আজকের খরচ — Android app additions.
 * Only runs inside the Android app (window.AKNative exists). The website is unchanged.
 *  1. A big "scan and pay" button at the very top.
 *  2. Scan any UPI QR -> type the amount -> pay in the UPI app the user picks (PhonePe, Google Pay,
 *     Paytm, BHIM, a bank's app...). The PIN is typed only inside that app.
 *  3. When the UPI app says the payment went through, the spend is saved at once, with its UPI
 *     reference number, so a later bank statement recognises it and never counts it twice.
 *  4. "What was it for?" asked right after, with big buttons; "Later" leaves it on a to-do list.
 *     Scanning again (or leaving the screen) without answering = "Later", never a block.
 *  5. Known shops are remembered and not asked again.
 * Everything stays in this phone; the app has no internet permission.
 */
(function () {
  "use strict";
  if (!window.AKNative) return;
  const N = window.AKNative;

  /* ---------- small helpers that use the page's own helpers ---------- */
  const tx = (b, e) => (typeof T === "function" ? T(b, e) : b);
  const money = n => (typeof rs === "function" ? rs(n) : "₹" + Math.round(n));
  const today = () => (typeof iso === "function" ? iso(new Date()) : new Date().toISOString().slice(0, 10));
  const h = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function store() {
    if (!S.scan) S.scan = {};
    const A = S.scan;
    if (!A.mem) A.mem = {};          // UPI id -> {cat, lab}
    if (!Array.isArray(A.ask)) A.ask = []; // expense ids still waiting for "what was it for?"
    if (!A.used) A.used = {};        // label -> times chosen (orders the buttons)
    return A;
  }
  function saveAll() { try { save(); } catch (_) {} try { render(); } catch (_) {} paintTop(); }

  /* ---------- the purposes shown as big buttons ---------- */
  const PURPOSES = [
    ["মাছ", "Fish", "🐟", "বাজার ও মুদি"],
    ["সবজি", "Vegetables", "🥬", "বাজার ও মুদি"],
    ["মুদি", "Grocery", "🛒", "বাজার ও মুদি"],
    ["দুধ", "Milk", "🥛", "বাজার ও মুদি"],
    ["মাংস ও ডিম", "Meat & eggs", "🍗", "বাজার ও মুদি"],
    ["ফল", "Fruit", "🍎", "বাজার ও মুদি"],
    ["ওষুধ ও ডাক্তার", "Medicine & doctor", "💊", "স্বাস্থ্য ও ওষুধ"],
    ["খাবার ও মিষ্টি", "Food & sweets", "🍲", "খাবার ও মিষ্টি"],
    ["যাতায়াত ও তেল", "Travel & fuel", "🚗", "যাতায়াত ও জ্বালানি"],
    ["বিল ও রিচার্জ", "Bills & recharge", "💡", "বিল ও রিচার্জ"],
    ["জামাকাপড়", "Clothes", "👕", "পোশাক ও কেনাকাটা"],
    ["ইলেকট্রনিক্স ও বড় জিনিস", "Electronics & big items", "📺", "পোশাক ও কেনাকাটা"],
    ["বাড়ির কাজ", "House repair", "🏠", "বাড়ি ও মেরামত"],
    ["পুজো ও দান", "Puja & donation", "🪔", "পুজো ও দান"],
    ["পরিবারকে দেওয়া", "Given to family", "👪", "পরিবার ও ব্যক্তিগত"],
    ["অন্য কিছু", "Something else", "➕", "অন্যান্য"]
  ];
  const pLabel = p => tx(p[0], p[1]);
  const byLab = lab => PURPOSES.find(p => p[0] === lab);

  /* a first guess from the shop's name, only to pre-select a button; the user still confirms */
  const GUESS = [
    [/fish|mach|matsya|machh|seafood/i, "মাছ"],
    [/veg|sabji|sabzi|sobji|tarkari|fruit/i, "সবজি"],
    [/medic|pharm|chemist|drug|clinic|hospital|diagnos|apollo|lab\b/i, "ওষুধ ও ডাক্তার"],
    [/milk|dairy|doodh|dudh|amul|mother ?dairy/i, "দুধ"],
    [/chicken|mutton|meat|egg|poultry/i, "মাংস ও ডিম"],
    [/sweet|mishti|misti|restaurant|hotel|cafe|food|bakery|dhaba|biryani|kitchen|zomato|swiggy/i, "খাবার ও মিষ্টি"],
    [/petrol|fuel|filling|diesel|indian ?oil|bharat ?petroleum|hpcl|iocl|bpcl|auto|toto|taxi|uber|ola|rapido/i, "যাতায়াত ও তেল"],
    [/recharge|electric|wbsedcl|cesc|jio|airtel|vodafone|\bvi\b|bsnl|broadband|dth|gas|indane|bharatgas/i, "বিল ও রিচার্জ"],
    [/kirana|grocery|store|mart|bazar|bazaar|general|provision|super ?market|dmart|bigbasket|blinkit/i, "মুদি"],
    [/cloth|garment|textile|saree|fashion|tailor|boutique/i, "জামাকাপড়"],
    [/electronic|mobile|appliance|furniture/i, "ইলেকট্রনিক্স ও বড় জিনিস"],
    [/hardware|paint|cement|plumb|electrician|repair/i, "বাড়ির কাজ"],
    [/temple|mandir|puja|math\b|mission|trust|donat/i, "পুজো ও দান"]
  ];
  const guess = name => { for (const [re, lab] of GUESS) if (re.test(name || "")) return lab; return ""; };

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.textContent = `
  #akTop{display:flex;flex-direction:column;gap:8px;margin:2px 0 4px}
  #akScanBtn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:76px;border:0;border-radius:20px;
    background:linear-gradient(135deg,#1f5f5b,#2f8f7f);color:#fff;font:inherit;font-size:1.35rem;font-weight:700;box-shadow:0 6px 18px rgba(31,95,91,.35)}
  #akScanBtn .ic{font-size:2rem;line-height:1}
  #akScanBtn small{display:block;font-size:.85rem;font-weight:500;opacity:.9}
  #akAskChip{border:2px solid #a86a00;background:#fbf0d9;color:#1d2a2a;border-radius:14px;padding:10px 14px;font:inherit;font-weight:600;text-align:left}
  .akOv{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
  .akOv[hidden]{display:none}
  .akCard{background:var(--card,#fff);color:var(--ink,#1d2a2a);width:100%;max-width:560px;max-height:94vh;overflow:auto;border-radius:22px 22px 0 0;
    padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px;font-family:var(--f-body,inherit)}
  .akCard h2{margin:0;font-size:1.25rem}
  .akCard .muted{color:var(--muted,#5d6b69);font-size:.95rem}
  .akBig{min-height:58px;border-radius:14px;font:inherit;font-size:1.15rem;font-weight:700;border:0;background:#1f5f5b;color:#fff;width:100%}
  .akBig.alt{background:var(--bg,#f3f4ef);color:var(--ink,#1d2a2a);border:1px solid var(--line,#dde2da)}
  .akRow{display:flex;gap:10px}
  .akRow>*{flex:1}
  .akAmt{font:inherit;font-size:2.2rem;font-weight:800;text-align:center;width:100%;padding:12px;border-radius:14px;border:2px solid #1f5f5b;background:var(--bg,#f3f4ef);color:var(--ink,#1d2a2a)}
  .akGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .akP{min-height:64px;border-radius:14px;border:1px solid var(--line,#dde2da);background:var(--bg,#f3f4ef);color:var(--ink,#1d2a2a);font:inherit;font-size:1.05rem;font-weight:600;
    display:flex;align-items:center;gap:10px;padding:8px 12px;text-align:left}
  .akP .e{font-size:1.6rem}
  .akP.sel{border:3px solid #1f5f5b;background:#e3efec}
  #akScanOv{background:#000;align-items:stretch}
  #akScanOv .wrapS{position:relative;width:100%;height:100%;display:flex;flex-direction:column}
  #akVideo{flex:1;width:100%;object-fit:cover;background:#000}
  #akFrame{position:absolute;left:50%;top:42%;width:68vw;max-width:340px;aspect-ratio:1;transform:translate(-50%,-50%);border:4px solid #fff;border-radius:22px;box-shadow:0 0 0 2000px rgba(0,0,0,.35)}
  #akScanMsg{position:absolute;left:0;right:0;top:12px;text-align:center;color:#fff;font-size:1.1rem;font-weight:600;padding:0 16px;text-shadow:0 1px 3px #000}
  #akScanBar{padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));background:#111;display:flex;gap:10px}
  #akToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:95;background:#1d2a2a;color:#fff;padding:12px 18px;border-radius:14px;font-weight:600;max-width:92vw;text-align:center}
  #akToast[hidden]{display:none}
  .akShop{font-size:1.4rem;font-weight:800;word-break:break-word}
  .akOk{font-size:1.3rem;font-weight:800;color:#2f7d3b}
  #akLater{position:sticky;bottom:0;box-shadow:0 -6px 14px rgba(0,0,0,.08)}
  `;
  document.head.appendChild(css);

  /* ---------- top button and to-do chip ---------- */
  const top = document.createElement("div");
  top.id = "akTop";
  top.innerHTML = `<button id="akScanBtn" type="button"><span class="ic">📷</span><span><span id="akScanTxt"></span><small id="akScanSub"></small></span></button>
    <button id="akAskChip" type="button" hidden></button>`;
  const header = document.querySelector(".wrap > header");
  if (header && header.parentNode) header.parentNode.insertBefore(top, header.nextSibling);
  else document.body.prepend(top);

  function paintTop() {
    const A = store();
    A.ask = A.ask.filter(id => S.exp.some(e => e.id === id));
    $("akScanTxt").textContent = tx("স্ক্যান করে পেমেন্ট", "Scan & pay");
    $("akScanSub").textContent = tx("যেকোনো UPI QR · PhonePe, Google Pay, Paytm, BHIM বা ব্যাঙ্কের অ্যাপ", "Any UPI QR · PhonePe, Google Pay, Paytm, BHIM or a bank app");
    const n = A.ask.length, chip = $("akAskChip");
    chip.hidden = !n;
    if (n) chip.textContent = tx(`🔔 ${n}টা খরচের খাত বলা বাকি · এখন বলুন`, `🔔 ${n} spend${n > 1 ? "s" : ""} still need a purpose · tell now`);
  }

  /* ---------- overlays ---------- */
  function overlay(id) {
    let o = $(id);
    if (!o) { o = document.createElement("div"); o.id = id; o.className = "akOv"; o.hidden = true; document.body.appendChild(o); }
    return o;
  }
  let toastT = null;
  function toast(t, ms) {
    const el = $("akToast") || (() => { const d = document.createElement("div"); d.id = "akToast"; d.hidden = true; document.body.appendChild(d); return d; })();
    el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms || 3500);
  }
  function ting() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ac = new C(), o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(1318, ac.currentTime); o.frequency.setValueAtTime(1760, ac.currentTime + .09);
      g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(.35, ac.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .6);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .62);
      setTimeout(() => { try { ac.close(); } catch (_) {} }, 900);
    } catch (_) {}
  }

  /* ---------- 1. scanner ---------- */
  let stream = null, scanning = false, lastTry = 0, flip = false;
  const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });

  function openScanner() {
    deferOpen();
    const o = overlay("akScanOv");
    o.innerHTML = `<div class="wrapS"><video id="akVideo" playsinline muted autoplay></video><div id="akFrame"></div>
      <div id="akScanMsg">${h(tx("দোকানের QR কোডটা চৌকো ঘরের মধ্যে ধরুন", "Hold the shop's QR code inside the square"))}</div>
      <div id="akScanBar"><button class="akBig alt" id="akScanClose">${h(tx("বন্ধ করুন", "Close"))}</button></div></div>`;
    o.hidden = false;
    $("akScanClose").onclick = closeScanner;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $("akScanMsg").textContent = tx("এই ফোনে ক্যামেরা খোলা গেল না।", "Couldn't open the camera on this phone."); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(s => {
        stream = s; const v = $("akVideo"); if (!v) { stopCam(); return; }
        v.srcObject = s; v.play().catch(() => {}); scanning = true; requestAnimationFrame(tick);
      })
      .catch(() => { $("akScanMsg").textContent = tx("ক্যামেরার অনুমতি লাগবে। ফোনের সেটিংসে আজকের খরচ → অনুমতি → ক্যামেরা চালু করুন।", "Camera permission is needed. In phone Settings → Ajker Khoroch → Permissions, allow Camera."); });
  }
  window.akCameraDenied = () => { const m = $("akScanMsg"); if (m) m.textContent = tx("ক্যামেরার অনুমতি দেওয়া হয়নি, তাই স্ক্যান করা যাচ্ছে না।", "Camera permission was not given, so scanning can't work."); };
  function stopCam() { scanning = false; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  function closeScanner() { stopCam(); const o = $("akScanOv"); if (o) { o.hidden = true; o.innerHTML = ""; } }
  function tick(t) {
    if (!scanning) return;
    const v = $("akVideo");
    if (v && v.readyState >= 2 && t - lastTry > 160 && typeof jsQR === "function") {
      lastTry = t;
      const vw = v.videoWidth, vh = v.videoHeight;
      if (vw && vh) {
        /* try the whole picture, then a zoomed middle part, turn by turn */
        flip = !flip;
        let sx = 0, sy = 0, sw = vw, sh = vh;
        if (flip) { const side = Math.min(vw, vh) * 0.7; sx = (vw - side) / 2; sy = (vh - side) / 2; sw = sh = side; }
        const k = Math.min(1, 800 / Math.max(sw, sh)), w = Math.round(sw * k), hh = Math.round(sh * k);
        cv.width = w; cv.height = hh;
        cx.drawImage(v, sx, sy, sw, sh, 0, 0, w, hh);
        const img = cx.getImageData(0, 0, w, hh);
        const code = jsQR(img.data, w, hh, { inversionAttempts: "attemptBoth" });
        if (code && code.data) { onCode(code.data); return; }
      }
    }
    requestAnimationFrame(tick);
  }
  function onCode(text) {
    const q = parseUpi(text);
    if (!q) {
      $("akScanMsg").textContent = tx("এটা UPI পেমেন্টের QR নয়। দোকানের পেমেন্টের QR-টা ধরুন।", "This is not a UPI payment QR. Point at the shop's payment QR.");
      lastTry = performance.now() + 1200; requestAnimationFrame(tick); return;
    }
    try { navigator.vibrate && navigator.vibrate(60); } catch (_) {}
    closeScanner(); showAmount(q);
  }

  /* reads the QR exactly as printed; the UPI id (pa) is never changed */
  function parseUpi(text) {
    const s = String(text || "").trim();
    if (!/^upi:\/\/pay\?/i.test(s)) return null;
    const qs = s.slice(s.indexOf("?") + 1), params = [];
    qs.split("&").forEach(kv => {
      if (!kv) return; const i = kv.indexOf("=");
      const k = (i < 0 ? kv : kv.slice(0, i)), v = i < 0 ? "" : kv.slice(i + 1);
      let dv = v; try { dv = decodeURIComponent(v.replace(/\+/g, " ")); } catch (_) {}
      params.push([k, v, dv]);
    });
    const get = k => { const p = params.find(x => x[0].toLowerCase() === k); return p ? p[2] : ""; };
    const pa = get("pa");
    if (!pa || !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-]{2,64}$/.test(pa)) return null;
    const am = parseFloat(get("am"));
    return { raw: s, params, pa, pn: get("pn") || pa, am: am > 0 ? am : null, signed: params.some(p => /^sign$/i.test(p[0])) };
  }

  /* ---------- 2. amount and payment ---------- */
  function showAmount(q) {
    const A = store(), mem = A.mem[q.pa.toLowerCase()];
    const o = overlay("akPayOv");
    const known = mem ? `<div class="muted">${h(tx("চেনা দোকান · খাত: ", "Known shop · purpose: "))}${h(pLabel(byLab(mem.lab) || PURPOSES[PURPOSES.length - 1]))}</div>` : "";
    o.innerHTML = `<div class="akCard" role="dialog" aria-modal="true">
      <div class="muted">${h(tx("কাকে দিচ্ছেন", "Paying to"))}</div>
      <div class="akShop">${h(q.pn)}</div>
      <div class="muted">${h(q.pa)}</div>${known}
      <label class="muted" for="akAmt">${h(tx("কত টাকা?", "How much?"))}</label>
      <input id="akAmt" class="akAmt" type="number" inputmode="decimal" min="1" step="0.01" placeholder="0" ${q.am ? `value="${q.am}" readonly` : ""}>
      ${q.am ? `<div class="muted">${h(tx("এই QR-এ টাকার অঙ্ক দোকানই বসিয়ে দিয়েছে।", "The shop has fixed the amount in this QR."))}</div>` : ""}
      <div id="akAppBox"></div>
      <div class="muted" id="akPayErr" style="color:var(--stop,#b3261e)"></div>
      <button class="akBig" id="akPayGo">${h(tx("পেমেন্ট করুন", "Pay"))}</button>
      <button class="akBig alt" id="akPayNo">${h(tx("বাতিল", "Cancel"))}</button></div>`;
    o.hidden = false;
    paintApps();
    const amt = $("akAmt"); if (!q.am) setTimeout(() => amt.focus(), 150);
    $("akPayNo").onclick = () => { o.hidden = true; };
    $("akPayGo").onclick = () => {
      const a = Math.round(parseFloat(amt.value) * 100) / 100;
      if (!(a > 0)) { $("akPayErr").textContent = tx("টাকার অঙ্কটা লিখুন।", "Enter the amount."); return; }
      if (a > 100000) { $("akPayErr").textContent = tx("UPI-তে একবারে ₹1,00,000-এর বেশি দেওয়া যায় না।", "UPI allows at most ₹1,00,000 at a time."); return; }
      const app = chosenApp();
      if (app === null) { $("akPayErr").textContent = tx("এই ফোনে কোনো UPI অ্যাপ পাওয়া গেল না।", "No UPI app found on this phone."); return; }
      o.hidden = true; startPay(q, a, app);
    };
  }

  function apps() { try { return JSON.parse(N.upiApps() || "[]"); } catch (_) { return []; } }
  function chosenApp() {
    const list = apps(); if (!list.length) return null;
    const A = store(), sel = document.querySelector('input[name="akApp"]:checked');
    const pkg = sel ? sel.value : (A.app && list.some(x => x.pkg === A.app) ? A.app : list[0].pkg);
    A.app = pkg; return pkg;
  }
  function paintApps() {
    const list = apps(), box = $("akAppBox"); if (!box) return;
    if (list.length <= 1) { box.innerHTML = list.length ? `<div class="muted">${h(tx("পেমেন্ট হবে: ", "Pay with: "))}<b>${h(list[0].label)}</b></div>` : ""; return; }
    const A = store(), cur = A.app && list.some(x => x.pkg === A.app) ? A.app : list[0].pkg;
    box.innerHTML = `<div class="muted">${h(tx("কোন অ্যাপে পেমেন্ট করবেন?", "Pay with which app?"))}</div>
      <div class="akGrid">${list.map(x => `<label class="akP${x.pkg === cur ? " sel" : ""}" style="cursor:pointer"><input type="radio" name="akApp" value="${h(x.pkg)}" ${x.pkg === cur ? "checked" : ""} style="width:20px;height:20px">${h(x.label)}</label>`).join("")}</div>`;
    box.querySelectorAll('input[name="akApp"]').forEach(r => r.onchange = () => box.querySelectorAll(".akP").forEach(l => l.classList.toggle("sel", l.contains(r) && r.checked)));
  }

  function buildUri(q, a) {
    /* keep every field of the shop's QR as it is; only add the amount (and currency) when the QR has none */
    const parts = q.params.map(p => p[0] + (p[1] !== "" || p[0] ? "=" + p[1] : ""));
    const has = k => q.params.some(p => p[0].toLowerCase() === k);
    if (!has("am")) parts.push("am=" + a.toFixed(2));
    if (!has("cu")) parts.push("cu=INR");
    return "upi://pay?" + parts.join("&");
  }

  function startPay(q, a, pkg) {
    const A = store();
    A.pend = { pa: q.pa, pn: q.pn, a, at: Date.now(), pkg };
    try { save(); } catch (_) {}
    if (!N.pay(buildUri(q, a), pkg || "")) { A.pend = null; toast(tx("পেমেন্ট শুরু করা গেল না।", "Couldn't start the payment.")); }
  }

  /* the UPI app answers here (PhonePe, Google Pay, Paytm, BHIM and bank apps all use this standard reply) */
  window.akPayResult = json => {
    const A = store(), p = A.pend; A.pend = null;
    let o = {}; try { o = JSON.parse(json); } catch (_) {}
    if (!p) { try { save(); } catch (_) {} return; }
    if (o.error === "noapp") { saveAll(); toast(tx("UPI অ্যাপ খোলা গেল না।", "Couldn't open the UPI app.")); return; }
    const f = {};
    String(o.response || "").split("&").forEach(kv => { const i = kv.indexOf("="); if (i > 0) { let v = kv.slice(i + 1); try { v = decodeURIComponent(v); } catch (_) {} f[kv.slice(0, i).toLowerCase()] = v; } });
    Object.keys(o.extras || {}).forEach(k => { if (!(k.toLowerCase() in f)) f[k.toLowerCase()] = o.extras[k]; });
    const st = String(f.status || "").toUpperCase();
    const ref = [f.approvalrefno, f.txnref, f.txnid, f.responsecode, o.response].map(x => String(x || "").match(/(?<!\d)\d{12}(?!\d)/)).find(Boolean);
    const utr = ref ? ref[0] : "";
    if (st === "SUCCESS" || st === "SUBMITTED") { record(p, utr, st === "SUBMITTED"); return; }
    if (st === "FAILURE" || st === "FAILED") { saveAll(); toast(tx("পেমেন্ট হয়নি। টাকা কাটা হয়নি।", "The payment did not go through. No money was taken."), 4500); return; }
    askDidPay(p);   // the app gave no clear answer: ask the user, never guess
  };

  function askDidPay(p) {
    const o = overlay("akDidOv");
    o.innerHTML = `<div class="akCard" role="dialog" aria-modal="true"><h2>${h(tx("পেমেন্টটা কি হয়েছে?", "Did the payment go through?"))}</h2>
      <div class="muted">${h(p.pn)} · ${h(money(p.a))}</div>
      <div class="muted">${h(tx("UPI অ্যাপ পরিষ্কার কিছু জানায়নি। সবুজ টিক দেখে থাকলে 'হ্যাঁ' চাপুন।", "The UPI app didn't say clearly. Tap 'Yes' only if you saw the green tick."))}</div>
      <div class="akRow"><button class="akBig" id="akDidY">${h(tx("হ্যাঁ, হয়েছে", "Yes, paid"))}</button><button class="akBig alt" id="akDidN">${h(tx("না, হয়নি", "No"))}</button></div></div>`;
    o.hidden = false;
    $("akDidY").onclick = () => { o.hidden = true; record(p, "", false); };
    $("akDidN").onclick = () => { o.hidden = true; saveAll(); };
  }

  /* ---------- 3. save the spend at once ---------- */
  function record(p, utr, waiting) {
    const A = store();
    if (S.sample) { S.exp = []; S.inc = []; try { S.future = blankFuture(); } catch (_) {} S.sample = false; }
    const d = today(), desc = "Paid to " + p.pn;
    const e = { d, a: p.a, tag: "UPI", desc, src: "imp", fr: "scan", k: d + "|" + p.a + "|" + desc, u: utr || undefined, pa: p.pa, id: Math.random() };
    if (waiting) e.wait = 1;
    S.exp.push(e);
    const mem = A.mem[p.pa.toLowerCase()];
    if (mem) { e.cat = mem.cat; e.lab = mem.lab; }
    saveAll(); ting();
    if (mem) {
      toast(tx(`✅ ${money(p.a)} · ${mem.lab}`, `✅ ${money(p.a)} · ${pLabel(byLab(mem.lab) || PURPOSES[PURPOSES.length - 1])}`), 4000);
    } else {
      A.ask.push(e.id); try { save(); } catch (_) {}
      askPurpose(e.id, true);
    }
  }

  /* ---------- 4. "what was it for?" ---------- */
  let openAsk = null;
  function askPurpose(id, justPaid) {
    const e = S.exp.find(x => x.id === id); if (!e) { paintTop(); return; }
    const A = store(), g = guess((e.desc || "").replace(/^Paid to /, "")), cnt = A.used;
    const order = PURPOSES.slice(0, -1).map((p, i) => [p, (cnt[p[0]] || 0) * 100 - i]).sort((x, y) => y[1] - x[1]).map(x => x[0]).concat([PURPOSES[PURPOSES.length - 1]]);
    const o = overlay("akAskOv");
    const left = A.ask.length;
    o.innerHTML = `<div class="akCard" role="dialog" aria-modal="true">
      ${justPaid ? `<div class="akOk">✅ ${h(money(e.a))} ${h(tx("গেল", "paid"))}${e.wait ? h(tx(" (ব্যাঙ্কের নিশ্চিতকরণের অপেক্ষায়)", " (bank confirmation pending)")) : ""}</div>` : `<div class="muted">${h(e.d)} · ${h(money(e.a))}${left > 1 ? h(tx(` · আরও ${left - 1}টা বাকি`, ` · ${left - 1} more left`)) : ""}</div>`}
      <div class="akShop">${h((e.desc || "").replace(/^Paid to /, ""))}</div>
      <h2>${h(tx("কীসের খরচ?", "What was it for?"))}</h2>
      ${g ? `<button class="akBig" id="akGuess">✓ ${h(pLabel(byLab(g)))} — ${h(tx("ঠিক আছে", "that's right"))}</button>` : ""}
      <div class="akGrid">${order.map(p => `<button class="akP${p[0] === g ? " sel" : ""}" data-l="${h(p[0])}"><span class="e">${p[2]}</span><span>${h(pLabel(p))}</span></button>`).join("")}</div>
      <button class="akBig alt" id="akLater">${h(tx("পরে দেব", "Later"))}</button></div>`;
    o.hidden = false; openAsk = id;
    o.querySelectorAll(".akP").forEach(b => b.onclick = () => choose(id, b.dataset.l));
    if (g) $("akGuess").onclick = () => choose(id, g);
    $("akLater").onclick = () => later();
  }
  function choose(id, lab) {
    const e = S.exp.find(x => x.id === id), p = byLab(lab), A = store();
    closeAsk();
    if (!e || !p) return;
    e.cat = p[3]; e.lab = p[0];
    if (e.pa) A.mem[e.pa.toLowerCase()] = { cat: p[3], lab: p[0] };
    A.used[p[0]] = (A.used[p[0]] || 0) + 1;
    A.ask = A.ask.filter(x => x !== id);
    if (!A.ask.length) { try { N.cancelRemind(); } catch (_) {} }
    saveAll();
    toast(tx(`✅ ${money(e.a)} · ${p[0]} · এই দোকান এবার থেকে মনে থাকবে`, `✅ ${money(e.a)} · ${p[1]} · this shop will be remembered`), 3500);
    if (A.ask.length && openQueue) { openQueue = false; setTimeout(() => nextAsk(), 400); }
  }
  function closeAsk() { const o = $("akAskOv"); if (o) { o.hidden = true; o.innerHTML = ""; } openAsk = null; }
  /* "Later" — pressed by the user, or pressed for them when they scan again / leave without answering */
  function later(silent) {
    if (openAsk == null) return;
    closeAsk(); openQueue = false;
    const A = store(); paintTop();
    if (A.ask.length) {
      try { N.remind(60, tx("আজকের খরচ", "Ajker Khoroch"), tx(`${A.ask.length}টা খরচের খাত বলা বাকি। এক ট্যাপে বলে দিন।`, `${A.ask.length} spend(s) still need a purpose. One tap to tell.`)); } catch (_) {}
    }
    if (!silent) toast(tx("ঠিক আছে, পরে জিজ্ঞেস করব।", "OK, I'll ask later."), 2500);
  }
  function deferOpen() { if (openAsk != null) later(true); }
  let openQueue = false;
  function nextAsk() { const A = store(); if (A.ask.length) { openQueue = true; askPurpose(A.ask[0], false); } else paintTop(); }

  $("akScanBtn").onclick = openScanner;
  $("akAskChip").onclick = nextAsk;

  /* the phone's back button closes the top-most window of ours first */
  window.akBack = () => {
    if ($("akScanOv") && !$("akScanOv").hidden) { closeScanner(); return true; }
    if ($("akPayOv") && !$("akPayOv").hidden) { $("akPayOv").hidden = true; return true; }
    if ($("akDidOv") && !$("akDidOv").hidden) { return true; }
    if (openAsk != null) { later(); return true; }
    return false;
  };

  /* if the phone closed our app while the UPI app was open, ask on return instead of losing the payment */
  window.akOnResume = () => {
    paintTop();
    const A = store();
    setTimeout(() => { if (A.pend && Date.now() - A.pend.at > 4000) { const p = A.pend; A.pend = null; try { save(); } catch (_) {} askDidPay(p); } }, 2500);
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopCam(); });

  /* ---------- voice entry through the phone's own voice typing ---------- */
  const mic = $("micBtn");
  if (mic) {
    mic.hidden = false;
    const vp = $("vPriv"); if (vp) vp.textContent = tx("মাইকে চাপ দিয়ে বলুন, যেমন ‘একশো টাকা দুধ নগদ’। ফোনের ভয়েস-টাইপিং লেখাটা বানাবে।", "Tap the mic and speak, e.g. ‘100 rupees milk cash’. The phone's voice typing writes it.");
    mic.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopImmediatePropagation();
      const b = document.querySelector('.vlang button[aria-pressed="true"]');
      N.listen(b && b.dataset.vl ? b.dataset.vl : (typeof LANG !== "undefined" && LANG === "en" ? "en-IN" : "bn-IN"));
    }, true);
  }
  window.akVoiceResult = text => {
    if (text == null) { toast(tx("এই ফোনে ভয়েস-টাইপিং পাওয়া গেল না। লিখে দিন।", "Voice typing isn't available on this phone. Please type.")); return; }
    if (!text) return;
    const box = $("vtxt"); if (!box) return;
    box.value = text; try { runParse(); } catch (_) {}
  };

  /* ---------- backup: send it straight to WhatsApp or anywhere ---------- */
  const bk = $("bkCopy");
  if (bk) {
    const sh = document.createElement("button");
    sh.type = "button"; sh.id = "akBkShare"; sh.className = bk.className;
    sh.textContent = tx("📤 ব্যাকআপ WhatsApp-এ পাঠান", "📤 Send backup to WhatsApp");
    bk.parentNode.insertBefore(sh, bk.nextSibling);
    sh.onclick = () => {
      const text = "AJKER-KHOROCH-BACKUP:" + JSON.stringify({ ...S, exp: S.exp.map(({ k, id, ...r }) => r) });
      N.share(text);
    };
  }
  /* the page's "copy" button: use the phone's clipboard directly */
  if (bk) bk.addEventListener("click", () => {
    setTimeout(() => { const out = $("bkOut"); if (out && out.value && N.copy(out.value)) { out.hidden = true; const m = $("bkMsg"); if (m) m.textContent = tx("ব্যাকআপ কপি হয়েছে। এবার WhatsApp-এ নিজেকে পাঠিয়ে রাখুন।", "Backup copied. Now send it to yourself on WhatsApp."); } }, 300);
  });

  /* language switch: repaint our texts too */
  if (typeof window.applyLang === "function") {
    const orig = window.applyLang;
    window.applyLang = function () { const r = orig.apply(this, arguments); try { paintTop(); } catch (_) {} return r; };
  }

  paintTop();
  setTimeout(() => { const A = store(); if (A.pend && Date.now() - A.pend.at > 4000) window.akOnResume(); }, 1500);
})();
