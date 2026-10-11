// all of game code in here
(() => {
  const $ = (s) => document.querySelector(s); // shortcut, finding HTML elements to use js with CSS selectors
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); // making it usable for html

  const CHECKS = [
    { id: "name",     group: "Passport",      label: "Decoded name matches boarding pass", hint: "Use the Cipher Note to decode the passport name." },
    { id: "photo",    group: "Passport",      label: "Photo matches the traveler",         hint: "Compare the passport photo with the person in the scanner." },
    { id: "username", group: "Passport",      label: "Username fits their identity",       hint: "Does the digital identity look like this person?" },
    { id: "issuer",   group: "Passport",      label: "Issuing authority is legitimate",    hint: "Check spelling against the Rulebook list." },
    { id: "details",  group: "Passport",      label: "ID number matches on both documents", hint: "Passport ID vs boarding pass ID." },
    { id: "seal",     group: "Passport",      label: "Verification seal is in the registry", hint: "Look up the seal code in the Rulebook." },
    { id: "password", group: "Boarding pass", label: "Account password is strong",          hint: "12+ characters, mixed types, no names, years or common words." },
    { id: "mfa",      group: "Boarding pass", label: "MFA is enabled",                      hint: "A second verification step must be ON." },
    { id: "datetime", group: "Boarding pass", label: "Flight is today and hasn't left",    hint: "Compare with the date and live clock at the top." },
    { id: "url",      group: "Boarding pass", label: "Airline website is the official one", hint: "Lookalike domains are phishing." },
    { id: "token",    group: "Boarding pass", label: "Access token is valid",               hint: "Not expired, revoked, or already scanned." },
    { id: "perms",    group: "Boarding pass", label: "Permissions are only what's needed",  hint: "Least privilege: board, seat, carry-on. Nothing more." },
    { id: "luggage",  group: "Luggage",       label: "No suspicious items",                 hint: "Open the luggage, then inspect every item with the magnifying glass." },
  ];

  // setting initial values
  const state = {
    shift: [], i: 0, score: 0, history: [], marks: {}, open: false, item: null,
    clockStart: 0, held: null, locked: false, pointer: { x: 0, y: 0 },
  };

  // making a caeser cipher
  const caesar = (s, k) => s.toUpperCase().replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + (k % 26) + 26) % 26) + 65)); // the shifting math  
  const encrypt = (name, c) => caesar(name, c.shift); 
  const decrypt = (text, c) => caesar(text, -c.shift);
  const cipherTag = (c) => "C" + c.shift;
  const cipherName = (c) => `Caesar shift ${c.shift}`;


  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const fmtDate = (d) => { const [y, m, dd] = d.split("-"); return `${months[+m - 1]} ${dd} ${y}`; };

// live clock
  function clockSeconds() {
    const [h, m] = rules.now.time.split(":").map(Number);
    const run = state.clockStart ? ((performance.now() - state.clockStart) / 1000) * rules.clockSpeed : 0;
    return h * 3600 + m * 60 + Math.floor(run);
  }
  const pad = (n) => String(n).padStart(2, "0"); // details
  function clockText(withSeconds) {
    const s = clockSeconds();
    const hm = `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}`;
    return withSeconds ? `${hm}:${pad(s % 60)}` : hm;
  }
  setInterval(() => { if ($("#game").classList.contains("active")) $("#hud-clock").textContent = `${fmtDate(rules.now.date)} · ${clockText(true)}`; }, 250);

// checking strength of password, length, kind, common words, etc.
  function passwordProblems(pw, p) {
    const out = [], low = pw.toLowerCase();
    if (pw.length < 12) out.push(`only ${pw.length} characters (need 12+)`);
    const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
    if (kinds < 3) out.push("uses too few character types");
    const word = rules.commonWords.find((w) => low.includes(w));
    if (word) out.push(`contains the common word "${word}"`);
    const parts = p.boarding.name.toLowerCase().split(/\s+/).filter((n) => n.length > 2);
    const nm = parts.find((n) => low.includes(n));
    if (nm) out.push(`contains their own name "${nm}"`);
    const born = +rules.now.date.slice(0, 4) - p.passport.age;
    if (low.includes(String(born)) || low.includes(String(born - 1))) out.push(`contains their birth year (${born})`);
    return out;
  }

  // checking the persons info, idx for the order - needed for tokins 
  function evaluate(p, idx) {
    const pp = p.passport, b = p.boarding, R = {}, now = rules.now, time = clockText(false);
    const decoded = pp.name.toUpperCase();
    const set = (id, ok, why) => (R[id] = { ok, why: (p.notes && p.notes[id]) || why }); // mini function

    set("name", decoded === b.name.toUpperCase(),
      `"${encrypt(pp.name, pp.cipher)}" (${cipherName(pp.cipher)}) decodes to ${decoded}; the boarding pass says ${b.name.toUpperCase()}.`);

    const photoOk = !pp.photo; // checking if passport photo matches person
    set("photo", photoOk, photoOk ? "Same face, hair and features as the traveler." : "The passport photo shows a different person. Possible impersonation.");

    const uname = pp.username.toLowerCase();
    const nameBits = b.name.toLowerCase().split(/\s+/);
    const userOk = pp.usernameOk !== undefined ? pp.usernameOk : nameBits.some((n) => uname.includes(n));
    set("username", userOk, userOk ? `@${pp.username} matches their name.` : `@${pp.username} has nothing to do with "${b.name}". Hacker-style handles are a red flag.`);

    const issOk = rules.trustedIssuers.includes(pp.issuer);
    set("issuer", issOk, issOk ? `${pp.issuer} is on the trusted list.` : `"${pp.issuer}" is a lookalike, not on the trusted list. Look closely at the spelling.`);

    set("details", pp.id === b.id, pp.id === b.id ? `Both documents show ID ${pp.id}.` : `Passport ID ${pp.id} does not match boarding pass ID ${b.id}.`);

    const sealOk = rules.trustedSeals.includes(pp.seal);
    set("seal", sealOk, sealOk ? `Seal ${pp.seal} verifies in the registry.` : `Seal ${pp.seal} is not in the registry. Forged seals often swap digits.`);

    const pw = passwordProblems(b.password, p);
    set("password", pw.length === 0, pw.length ? `Weak password: ${pw.join(", ")}.` : "Long, mixed character types, no personal info or common words.");

    set("mfa", !!b.mfa, b.mfa ? "MFA is on, so a stolen password alone can't unlock the account." : "MFA is off. One leaked password would give someone full access.");

    const dt = [];
    if (b.date !== now.date) dt.push(`the flight is dated ${fmtDate(b.date)}, not today`);
    else if (b.time <= time) dt.push(`the flight left at ${b.time} and it's already ${time}`);
    set("datetime", dt.length === 0, dt.length ? `Invalid: ${dt.join("; ")}.` : `Departs today at ${b.time}, after the current time ${time}.`);

    const official = rules.airlines[b.airline];
    set("url", official === b.url, official === b.url ? `${b.url} is the official ${b.airline} site.` : `${b.url} is not the real ${b.airline} site (${official || "unknown airline"}). Classic phishing domain.`);

    const used = rules.scannedTokens.concat(state.shift.slice(0, idx).map((q) => q.boarding.token.code));
    const tk = [];
    if (rules.revokedTokens.includes(b.token.code)) tk.push("it is on the revoked list");
    if (used.includes(b.token.code)) tk.push("it was already scanned today (duplicate)");
    if (b.token.expires <= `${now.date} ${time}`) tk.push(`it expired at ${b.token.expires}`);
    set("token", tk.length === 0, tk.length ? `Token ${b.token.code} is invalid: ${tk.join("; ")}.` : `Token ${b.token.code} is unique and valid until ${b.token.expires.slice(11)}.`);

    const badPerms = b.permissions.filter((perm) => {
      const [k, v] = perm.split(":");
      if (!rules.allowedPermissions.includes(k)) return true;
      return (k === "BOARD" && v !== b.gate) || (k === "SEAT" && v !== b.seat);
    });
    set("perms", badPerms.length === 0, badPerms.length ? `Over-privileged: ${badPerms.join(", ")} is more access than a passenger needs.` : "Only boarding, seat and carry-on access: least privilege.");

    const bad = p.luggage.filter((it) => it.suspicious);
    set("luggage", bad.length === 0, bad.length ? `Suspicious: ${bad.map((it) => it.name).join(", ")}.` : "Every item is harmless.");

    return R;
  }

  // graphic
  // Character pictures reuse the ?v= tag from index.html, so updated art isn't hidden by the browser cache.
  const ART_V = ((document.querySelector('script[src*="game.js"]') || {}).src || "").split("v=")[1] || "";
  const portrait = (img, look) => (img ? `<img src="${esc(img)}?v=${ART_V}" alt="">` : pixelAvatar(look));

  // making a qr code graphic NOT REAL OR SCANABLE
  function qr(code) {
    let h = 0;
    for (const c of code) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
    const N = 21, cells = [], corners = [[0, 0], [N - 7, 0], [0, N - 7]];
    const finder = (x, y) => corners.some(([fx, fy]) => {
      const dx = x - fx, dy = y - fy;
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
      return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx > 1 && dx < 5 && dy > 1 && dy < 5);
    });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { // going through all squares deciding if black or white
      const inF = corners.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
      let on;
      if (inF) on = finder(x, y);
      else { h = (Math.imul(h ^ (h >>> 15), 2246822507) + x * 13 + y * 7) | 0; on = (h >>> 0) % 100 < 48; }
      if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    return `<svg class="qr" viewBox="-1 -1 23 23" shape-rendering="crispEdges"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/><g fill="#2b2d5c">${cells.join("")}</g></svg>`;
  }

  function renderHud() {
    $("#hud-passenger").textContent = `Passenger ${Math.min(state.i + 1, state.shift.length)} / ${state.shift.length}`; // how many people left
    $("#hud-clock").textContent = `${fmtDate(rules.now.date)} · ${clockText(true)}`;
    $("#hud-score").textContent = `★ ${state.score}`;
  }

  // character visible
  function renderTraveler(p) {
    const t = $("#traveler");
    t.innerHTML = portrait(p.image, p.look);
    t.classList.toggle("art", !!p.image);
    t.style.setProperty("--zoom", p.windowZoom || ""); //adjusting how character is (zoom)
    t.style.setProperty("--top", p.windowTop || ""); // same thing ^ (but postion0) 
    t.classList.remove("enter"); void t.offsetWidth; t.classList.add("enter");
    $("#speech").textContent = p.line; // dialouge
  }

  // displaying boarding pass
  function renderBoarding(p) {
    const b = p.boarding;
    $("#boarding").innerHTML = `
      <div class="bp-head"><span>BOARDING PASS</span><span>${fmtDate(b.date)}</span><span class="bp-airline">✦ ${esc(b.airline)}</span></div>
      <div class="bp-body">
        <div class="bp-main">
          <div class="bp-route">
            <div><small>From</small><b>${esc(b.from)}</b></div>
            <div class="bp-plane">✈</div>
            <div><small>To</small><b>${esc(b.to)}</b></div>
          </div>
          <div class="bp-grid">
            <div><small>Passenger</small><b>${esc(b.name)}</b></div>
            <div><small>ID No.</small><b>${esc(b.id)}</b></div>
            <div><small>Departs</small><b>${esc(b.time)}</b></div>
            <div><small>Gate / Seat</small><b>${esc(b.gate)} · ${esc(b.seat)}</b></div>
            <div class="wide"><small>Account password</small><code>${esc(b.password)}</code></div>
            <div class="wide"><small>MFA</small><b class="${b.mfa ? "mfa-on" : "mfa-off"}">${b.mfa ? "ON · Authenticator" : "OFF"}</b></div>
            <div class="full"><small>Website</small><code>${esc(b.url)}</code></div>
          </div>
        </div>
        <div class="bp-stub">
          ${qr(b.token.code)}
          <div><small>Access token</small><b>${esc(b.token.code)}</b></div>
          <div><small>Expires</small><b>${fmtDate(b.token.expires.slice(0, 10)).slice(0, 6)} · ${esc(b.token.expires.slice(11))}</b></div>
          <div><small>Permissions</small><div class="perms">${b.permissions.map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>
        </div>
      </div>`;
  }

  //displaying passport
  function renderPassport(p) {
    const pp = p.passport;
    const photoLook = Object.assign({}, p.look, pp.photo || {});
    const photoImg = pp.photoImage || (!pp.photo && p.image);
    // Character is zoomed to passport photo
    const crop = photoImg
      ? ` art" style="${pp.photoZoom ? `--zoom:${esc(pp.photoZoom)};` : ""}${pp.photoTop ? `--top:${esc(pp.photoTop)};` : ""}`
      : "";
    $("#passport").innerHTML = `
      <div class="pp-head"><b>PASSPORT</b><small>${esc(pp.issuer)}</small></div>
      <div class="pp-body">
        <div class="pp-photo${crop}">${portrait(photoImg, photoLook)}</div>
        <div class="pp-fields">
          <div><small>Name <span class="enc">ENC·${cipherTag(pp.cipher)}</span></small><b class="cipher">${encrypt(pp.name, pp.cipher)}</b></div>
          <div><small>ID No.</small><b>${esc(pp.id)}</b></div>
          <div><small>Age</small><b>${esc(pp.age)}</b></div>
          <div><small>Digital ID</small><b>@${esc(pp.username)}</b></div>
        </div>
      </div>
      <div class="pp-seal"><div class="seal-stamp">✶</div><div><small>Verification seal</small><b>${esc(pp.seal)}</b></div></div>
      <button class="pp-stamp-zone" id="stamp-zone" type="button">STAMP</button>`;
  }

  const itemArt = (it) => (it.image ? `<img src="${esc(it.image)}" alt="">` : `<span class="ico">${it.icon || "📦"}</span>`);

  function renderLuggage(p) {
    const el = $("#luggage"), plate = $("#plate-items");
    clearTimeout(nudgeTimer); // resetting the tray
    $(".plate-label").textContent = "Inspection tray";
    $(".plate-label").classList.remove("nudge");
    if (!state.open) {
      el.innerHTML = `<button class="chest" id="open-chest" aria-label="Open luggage">
        <div class="chest-lid"></div><div class="chest-base"><div class="chest-lock"></div></div>
        <span>Click to open luggage</span></button>`;
      plate.innerHTML = `<p class="plate-empty">Open the luggage to unpack it here.</p>`;
      $("#open-chest").onclick = () => { state.open = true; renderLuggage(p); };
      return;
    }
    el.innerHTML = `<div class="chest open"><div class="chest-lid"></div><div class="chest-base"><div class="chest-lock"></div></div></div>`;
    // Only the objects sit on the tray. Names and details appear when inspected with the glass.
    plate.innerHTML = p.luggage.map((it, k) => `
      <button class="plate-item pop" data-k="${k}" aria-label="Luggage item ${k + 1}" style="--d:${(k * 0.15).toFixed(2)}s; --dx:${Math.round(Math.random() * 80 - 40)}px">
        ${itemArt(it)}</button>`).join("");
    plate.querySelectorAll(".plate-item").forEach((btn) => {
      btn.addEventListener("animationend", () => btn.classList.remove("pop", "shake"));
      btn.onclick = () => {
        if (state.held === "glass") return inspect(p.luggage[+btn.dataset.k], btn);
        btn.classList.remove("shake"); void btn.offsetWidth; btn.classList.add("shake");
        nudgePlate();
      };
    });
  }

  let nudgeTimer = null;
  function nudgePlate() {
    const label = $(".plate-label");
    label.textContent = "Use the magnifying glass to inspect";
    label.classList.add("nudge");
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => {
      label.textContent = "Inspection tray";
      label.classList.remove("nudge");
    }, 2500);
  }
 
  // inspection report
  function inspect(it, btn) {
    btn.classList.add("seen");
    const pop = $("#inspect-pop");
    pop.innerHTML = `
      <div class="pop-head"> Inspection report</div>
      <button class="pop-close" aria-label="Close">×</button>
      <div class="pop-body"><div class="pop-icon">${itemArt(it)}</div><div><b>${esc(it.name)}</b><p>${esc(it.desc)}</p></div></div>
      <div class="scanline"></div>`;
    pop.hidden = false;
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.right + 12, top = r.top - 20;
    if (left + w > innerWidth - 8) left = r.left - w - 12;
    left = Math.max(8, left);
    top = Math.max(8, Math.min(top, innerHeight - h - 8));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    pop.querySelector(".pop-close").onclick = closeInspect;
  }
  const closeInspect = () => ($("#inspect-pop").hidden = true);

  // actually building the checklist
  function renderChecklist() {
    let html = "", group = "";
    for (const c of CHECKS) {
      if (c.group !== group) { group = c.group; html += `<h4>${group}</h4>`; }
      const m = state.marks[c.id];
      html += `<div class="check ${m || ""}">
        <div class="check-text"><b>${c.label}</b><small>${c.hint}</small></div>
        <button class="mark ok ${m === "ok" ? "on" : ""}" data-id="${c.id}" data-v="ok" aria-label="Looks fine">✓</button>
        <button class="mark flag ${m === "flag" ? "on" : ""}" data-id="${c.id}" data-v="flag" aria-label="Red flag">✗</button>
      </div>`;
    }
    const done = Object.keys(state.marks).length;
    const flags = Object.values(state.marks).filter((v) => v === "flag").length;
    $("#tab-checklist").innerHTML = `<p class="progress">${done} / ${CHECKS.length} checked · <b class="${flags >= rules.denyAt ? "bad" : ""}">${flags} red flag${flags === 1 ? "" : "s"}</b><br>${rules.denyAt}+ red flags = DENY</p>${html}`;
    $("#tab-checklist").querySelectorAll(".mark").forEach((btn) => (btn.onclick = () => {
      const { id, v } = btn.dataset;
      if (state.marks[id] === v) delete state.marks[id];
      else state.marks[id] = v;
      renderChecklist();
    }));
  }

  // displaying the rule book
  function renderRules() {
    const scanned = rules.scannedTokens.concat(state.shift.slice(0, state.i).map((q) => q.boarding.token.code));
    $("#tab-rules").innerHTML = ` 
      <h4>Today</h4><p>${fmtDate(rules.now.date)}. The current time is on the live clock at the top.</p>
      <h4>Decision rule</h4><p><b>${rules.denyAt} or more</b> red flags = DENY. One minor flag can pass.</p>
      <h4>Trusted passport issuers</h4><ul>${rules.trustedIssuers.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>Seal registry</h4><ul class="mono">${rules.trustedSeals.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>Official airline websites</h4><ul class="mono">${Object.entries(rules.airlines).map(([a, u]) => `<li>${esc(a)}: ${esc(u)}</li>`).join("")}</ul>
      <h4>Token log</h4>
      <p>Revoked:</p><ul class="mono">${rules.revokedTokens.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p>Already scanned today:</p><ul class="mono">${scanned.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>Allowed permissions</h4><p><code>BOARD:&lt;their gate&gt;</code> <code>SEAT:&lt;their seat&gt;</code> <code>CARRY_ON</code>. Anything else is over-privileged.</p>
      <h4>Password policy</h4><ul><li>12 or more characters</li><li>At least 3 of: lowercase, UPPERCASE, numbers, symbols</li><li>No names, birth years, or common words (password, qwerty, 123456…)</li></ul>`;
  }

  // casear cipher tab
  function renderCipher(p) {
    const c = p.passport.cipher, enc = encrypt(p.passport.name, c); // getting scrambled name
    const A = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
    const explain = `<b>Caesar cipher, shift ${c.shift}.</b> Every letter moved ${c.shift} forward. Move it <b>back ${c.shift}</b> to decode.`;
    const words = enc.split(" ");
    let idx = 0;
    const slots = words.map((w) => `<div class="word">${[...w].map((ch) => {
      const i = idx++;
      return /[A-Z]/.test(ch) // if character upercase, make input box; otherwise create fixed element
        ? `<label class="slot"><span>${ch}</span><input data-i="${i}" data-want="${decrypt(ch, c)}" aria-label="Real letter for ${ch}" autocomplete="off" spellcheck="false"></label>`
        : `<div class="slot fixed"><span>${ch}</span><b>${ch}</b></div>`;
    }).join("")}</div>`).join("");

    $("#tab-cipher").innerHTML = `
      <div class="note">
        <p class="note-title">Decoder note</p>
        <div class="callout">This passport's tag is <span class="enc big">ENC·${cipherTag(c)}</span><p>${explain}</p></div>
        <p class="how">Find the scrambled letter on top. The real letter is underneath.</p>
        <div class="lookup">${A.map((L) => `<div><span class="e">${L}</span><span class="r">${decrypt(L, c)}</span></div>`).join("")}</div>
      </div>
      <div class="decoder">
        <p class="dec-title">Scratch pad</p>
        <p class="tiny">Type the real letter under each scrambled one.</p>
        <p id="decode-out" class="decode-out">0 / ${enc.replace(/[^A-Z]/g, "").length} letters</p>
        <div class="slots">${slots}</div>
      </div>
      <details class="howto"><summary>How do these ciphers work?</summary>
        <p><b>Caesar (ENC·C#):</b> shift every letter # places forward. With C3, HELLO becomes KHOOR. To decode, shift back.</p>
        <p>Real systems use far stronger encryption, but the idea is the same: data is unreadable without the key.</p>
      </details>`;

    const inputs = [...$("#tab-cipher").querySelectorAll(".slot input")];
    const update = () => {
      const right = inputs.filter((x) => x.value === x.dataset.want).length;
      const out = $("#decode-out");
      if (right === inputs.length) { out.textContent = `✓ Decoded: ${p.passport.name.toUpperCase()}. Now compare it with the boarding pass.`; out.className = "decode-out good"; }
      else { out.textContent = `${right} / ${inputs.length} letters`; out.className = "decode-out"; }
    };
    const put = (inp, letter) => { // checking the letters user inputs
      inp.value = letter;
      inp.parentElement.classList.toggle("good", !!letter && letter === inp.dataset.want);
      inp.parentElement.classList.toggle("bad", !!letter && letter !== inp.dataset.want);
      update();
    };
    inputs.forEach((inp, k) => {
      inp.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^[a-z]$/i.test(e.key)) {
          e.preventDefault();
          put(inp, e.key.toUpperCase());
          if (inputs[k + 1]) inputs[k + 1].focus();
        } else if (e.key === "Backspace") {
          e.preventDefault();
          if (inp.value) put(inp, "");
          else if (inputs[k - 1]) { inputs[k - 1].focus(); put(inputs[k - 1], ""); }
        } else if (e.key === "ArrowLeft" && inputs[k - 1]) { e.preventDefault(); inputs[k - 1].focus(); }
        else if (e.key === "ArrowRight" && inputs[k + 1]) { e.preventDefault(); inputs[k + 1].focus(); }
      });
      // phone keyboards don't always send key names, so also handle raw input
      inp.addEventListener("input", () => {
        const letter = inp.value.replace(/[^a-z]/gi, "").toUpperCase().slice(-1);
        put(inp, letter);
        if (letter && inputs[k + 1]) inputs[k + 1].focus();
      });
      inp.addEventListener("focus", () => inp.select());
    });
  }

  function setTab(tab) {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    ["checklist", "rules", "cipher"].forEach((t) => ($("#tab-" + t).hidden = t !== tab));
  }

  function loadPassenger() {
    const p = state.shift[state.i];
    state.marks = {}; state.open = false; state.locked = false;
    hold(null); closeInspect();
    renderHud(); renderTraveler(p); renderBoarding(p); renderPassport(p); renderLuggage(p);
    renderChecklist(); renderRules(); renderCipher(p); setTab("checklist");
    $("#desk").scrollTop = 0;
  }

  // holding magnifying glass/stamp + plus moving it around
  const stampHTML = (kind) => `<span class="knob"></span><span class="neck"></span><span class="base">${kind === "approve" ? "APPROVED" : "DENIED"}</span>`; //stamp appearance
  const glassHTML = `<span class="glass-icon"><span class="lens"></span><span class="grip"></span></span>`; // magnifying glass appearance
  const isStamp = (kind) => kind === "approve" || kind === "deny"; //checking if tool is a stamp

  function hold(kind) {
    state.held = kind;
    const held = $("#held");
    document.body.classList.toggle("holding", !!kind);
    document.body.classList.toggle("holding-stamp", isStamp(kind));
    document.body.classList.toggle("holding-glass", kind === "glass");
    document.querySelectorAll(".rubber").forEach((b) => b.classList.toggle("lifted", b.dataset.kind === kind));
    $("#glass-btn").classList.toggle("lifted", kind === "glass");
    held.hidden = !kind;
    if (kind) {
      held.className = "held " + kind;
      held.innerHTML = kind === "glass" ? glassHTML : stampHTML(kind);
      moveHeld(state.pointer.x, state.pointer.y);
    }
    $("#tray-hint").textContent = isStamp(kind)
      ? `Now click the STAMP box on the passport to stamp it ${kind === "approve" ? "APPROVED" : "DENIED"}. Press Esc to put it back.`
      : "Pick up a stamp, then stamp the passport.";
    $("#glass-hint").textContent = kind === "glass"
      ? "Click an item on the tray. Press Esc or click here to put it down."
      : "Pick it up, then click an item on the tray to inspect it.";
  }

  function moveHeld(x, y) {
    const held = $("#held");
    held.style.left = x + "px";
    held.style.top = y + "px";
  }

  function stampPassport(clientX, clientY) {
    if (!isStamp(state.held) || state.locked) return;
    state.locked = true;
    const kind = state.held, pp = $("#passport"), r = pp.getBoundingClientRect();
    const zone = $("#stamp-zone").getBoundingClientRect();
    // keeping in designated area to be stamped
    const cx = clientX ? Math.min(zone.right, Math.max(zone.left, clientX)) : zone.left + zone.width / 2;
    const cy = clientY ? Math.min(zone.bottom, Math.max(zone.top, clientY)) : zone.top + zone.height / 2;
    const x = cx - r.left, y = cy - r.top;
    const ink = document.createElement("div");
    ink.className = "ink " + kind;
    ink.style.left = x + "px";
    ink.style.top = y + "px";
    ink.style.setProperty("--r", (Math.random() * 24 - 12).toFixed(1) + "deg");
    ink.innerHTML = `${kind === "approve" ? "APPROVED" : "DENIED"}<small>GATEWAY · ${clockText(false)}</small>`;
    $("#held").classList.add("press");
    setTimeout(() => {
      pp.appendChild(ink);
      pp.classList.add("thud");
    }, 120);
    setTimeout(() => {
      $("#held").classList.remove("press");
      hold(null);
      pp.classList.remove("thud");
    }, 450);
    setTimeout(() => decide(kind === "approve"), 1100);
  }

  // making the decision
  function decide(approve) {
    const p = state.shift[state.i]; 
    const key = evaluate(p, state.i); // getting correct answers of passenger
    const problems = CHECKS.filter((c) => !key[c.id].ok); //making an array of actualy mistakes
    const shouldApprove = problems.length < rules.denyAt; // should be less than 2
    const correct = approve === shouldApprove;
    let markPts = 0;
    CHECKS.forEach((c) => { const m = state.marks[c.id]; if (m && (m === "ok") === key[c.id].ok) markPts += 10; }); // getting points from your checklist
    state.score += (correct ? 100 : 0) + markPts; // 100 pts for every correct decision
    state.history.push({ name: p.boarding.name, approve, shouldApprove, correct, look: p.look, p });
    closeInspect(); //closing insepction

    const rows = CHECKS.map((c) => { //here it makes our table after stamping
      const m = state.marks[c.id], truth = key[c.id].ok;
      const yours = m ? (m === "ok" ? "✓" : "✗") : "–"; // what the user put in
      const right = m ? (m === "ok") === truth : null; 
      return `<tr class="${truth ? "" : "problem"}">
        <td>${c.label}</td><td class="${right === null ? "" : right ? "good" : "bad"}">${yours}</td>
        <td>${truth ? "✓" : "✗"}</td><td class="why">${esc(key[c.id].why)}</td></tr>`;
    }).join("");

    const list = `<ul>${problems.map((c) => `<li><b>${c.label}:</b> ${esc(key[c.id].why)}</li>`).join("")}</ul>`; //failed list of checks explained
    let summary;
    if (problems.length === 0) summary = `<div class="problems clean"><h4>All clear</h4><p>Every check passed. This traveler was safe to fly.</p></div>`;
    else if (problems.length < rules.denyAt) summary = `<div class="problems minor"><h4>1 red flag: allowed through</h4><p>It takes ${rules.denyAt} red flags to deny, so this traveler may pass. Still worth noticing:</p>${list}</div>`;
    else summary = `<div class="problems"><h4>${problems.length} red flags you should catch</h4>${list}</div>`;

    $("#verdict-card").innerHTML = `
      <div class="verdict-top ${correct ? "good" : "bad"}">
        <h2>${correct ? "Correct call!" : "Wrong call!"}</h2>
        <p>You stamped <b>${approve ? "APPROVED" : "DENIED"}</b>. The right call was <b>${shouldApprove ? "APPROVED" : "DENIED"}</b>.</p>
        <p class="pts">+${correct ? 100 : 0} decision · +${markPts} checklist</p>
      </div>
      ${summary}
      <details><summary>Full checklist answers</summary>
        <table><thead><tr><th>Check</th><th>You</th><th>Answer</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table>
      </details>
      <button id="next-btn" class="pixel-btn">${state.i + 1 < state.shift.length ? "Next passenger →" : "Launch the ship"}</button>`;
    $("#verdict").hidden = false;
    renderHud();
    $("#next-btn").focus(); //moving on to the next passenger
    $("#next-btn").onclick = () => {
      $("#verdict").hidden = true;
      state.i += 1;
      if (state.i < state.shift.length) loadPassenger(); // when reaches 12, bcuz 12<12 is false
      else finish();
    };
  }

  function finish() {
    const total = state.history.length;
    const right = state.history.filter((h) => h.correct).length;
    const outcome = right === total ? "land" : right >= total - 2 ? "chase" : "crash";
    const TEXT = {
      land: ["Touchdown on Nova Prime!", "Every call was right. Your ship cruised through clear space and landed safely."],
      chase: ["Alien pursuit!", "A couple of threats slipped through. Aliens chased your ship the whole way, but you made it. Barely."],
      crash: ["Mission failed!", "Too many wrong calls. The ship launched, then went down."],
    }[outcome];
    show("ending");
    $("#ending-card").hidden = true;
    const crew = state.history.filter((h) => h.approve).map((h) => h.look);
    Ending.play(outcome, crew, () => {
      $("#ending-card").innerHTML = `
        <h2 class="${outcome}">${TEXT[0]}</h2>
        <p>${TEXT[1]}</p>
        <p class="final">${right} / ${total} correct · ★ ${state.score}</p>
        <ul class="recap">${state.history.map((h) => `<li class="${h.correct ? "good" : "bad"}">${h.correct ? "✓" : "✗"} ${esc(h.name)}: you ${h.approve ? "approved" : "denied"}, should ${h.shouldApprove ? "approve" : "deny"}</li>`).join("")}</ul>
        <div class="card-actions"><button id="again-btn" class="pixel-btn">Work another shift</button></div>`;
      $("#ending-card").hidden = false;
      $("#again-btn").onclick = () => { Ending.stop(); begin(); };
    });
  }

  function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id)); }

  // Random passengers each shift, with at least 2 to approve and 2 to deny.
  function pickShift() {
    const flags = (p) => Object.values(evaluate(p, 0)).filter((r) => !r.ok).length;
    const size = Math.min(people_amount, PASSENGERS.length);
    for (let tries = 0; tries < 200; tries++) {
      const pool = PASSENGERS.slice();
      for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const pick = pool.slice(0, size);
      const approves = pick.filter((p) => flags(p) < rules.denyAt).length;
      if (approves >= Math.min(2, size) && size - approves >= Math.min(2, size)) return pick;
    }
    return PASSENGERS.slice(0, size);
  }

  function begin() {
    state.i = 0; state.score = 0; state.history = [];
    state.shift = []; state.clockStart = 0;
    state.shift = pickShift();
    preloadArt(state.shift);
    state.clockStart = performance.now();
    show("game");
    loadPassenger();
  }

  // Download every picture for this shift up front, each traveler appears instantly
  const preloaded = [];
  function preloadArt(list) {
    list.forEach((p) => [p.image, p.passport.photoImage].filter(Boolean).forEach((src) => {
      const img = new Image();
      img.src = `${src}?v=${ART_V}`;
      preloaded.push(img);
    }));
  }

  // welcome, start buttons
  $("#welcome-btn").onclick = () => { Intro.stop(); show("briefing"); };
  $("#start-btn").onclick = begin;
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
  document.querySelectorAll(".rubber").forEach((b) => (b.onclick = (e) => {
    if (state.locked) return;
    state.pointer = { x: e.clientX || b.getBoundingClientRect().left, y: e.clientY || b.getBoundingClientRect().top };
    hold(state.held === b.dataset.kind ? null : b.dataset.kind);
  }));
  $("#glass-btn").onclick = (e) => {
    if (state.locked) return;
    const r = $("#glass-btn").getBoundingClientRect();
    state.pointer = { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 };
    hold(state.held === "glass" ? null : "glass");
    if (!state.held) closeInspect();
  };
  // Stamps only count inside the STAMP box, anywhere else just nudges the player toward it.
  let zoneTimer = null;
  document.addEventListener("click", (e) => {
    if (!isStamp(state.held) || state.locked || !$("#game").classList.contains("active")) return;
    if (e.target.closest("#stamp-zone")) {
      e.preventDefault();
      stampPassport(e.detail === 0 ? 0 : e.clientX, e.detail === 0 ? 0 : e.clientY);
    } else if (e.target.closest("#passport")) {
      const zone = $("#stamp-zone");
      zone.classList.remove("nudge"); void zone.offsetWidth; zone.classList.add("nudge");
      $("#tray-hint").textContent = "Stamp inside the STAMP box on the passport!";
      clearTimeout(zoneTimer);
      zoneTimer = setTimeout(() => { if (isStamp(state.held)) hold(state.held); }, 2000);
    }
  });
  // The held stamp / magnifying glass follows the mouse
  document.addEventListener("pointermove", (e) => {
    state.pointer = { x: e.clientX, y: e.clientY };
    if (state.held) moveHeld(e.clientX, e.clientY);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (state.held && !state.locked) hold(null);
    else closeInspect();
  });
  Intro.start();
})();
