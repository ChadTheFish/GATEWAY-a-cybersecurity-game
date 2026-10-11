/*
  End-of-shift flight. Every ending starts with the approved travelers boarding
  the ship at GATEWAY spaceport, then:
    "land"  - fly to Nova Prime, land, and the passengers walk out onto the planet
    "chase" - launch and get chased by alien UFOs
    "crash" - launch, sputter and crash (everyone parachutes out)
*/
window.Ending = (() => {
  const cvs = document.getElementById("ending-canvas");
  const screen = cvs.getContext("2d");
  let ctx = screen; // helpers draw into ctx, which is swapped while pre-rendering layers
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  let W = 240, H = 135, raf = null, start = 0, last = 0, mode = "land", callback = null, called = false;
  let stars = [], parts = [], lasers = [], rocks = [], spores = [], chutes = [];
  let crew = [], T = {}, ship = {}, boomT = -1, nextShot = 0;
  let nebula = null, surface = null, city = [], props = [];

  /* ---------- sprites ---------- */
  function sprite(rows, colors) {
    const c = document.createElement("canvas");
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x, y, 1, 1); } }));
    return c;
  }
  // Facing right; drawn at 2x, so it is 40px long. Engine on the left edge.
  const SHIP = sprite([
    "   ##               ",
    "  #PP#              ",
    "  #PPP###           ",
    "  ##WWWWWW###       ",
    " #EWWWWWWWCCC##     ",
    "#EEWYYYYYWCCCCW##   ",
    "#EEWWWWWWWWWWWWWW## ",
    "#EEWYYYYYWWWWWWWWWW#",
    " #EWWWWWWWWWWWWW##  ",
    "  ##WWWWWW###       ",
    "  #PPP###           ",
    "  #PP#              ",
    "   ##               ",
  ], { "#": "#1c1d40", W: "#e8ecff", P: "#7b5cd6", C: "#5ad1ff", Y: "#ffd35a", E: "#6a6f9a" });
  const HALF = SHIP.width; // half the drawn ship length
  const UFO = sprite([
    "    ###    ",
    "   #CCC#   ",
    "  #CGCGC#  ",
    " ######### ",
    "#PPYPPPYPP#",
    " ######### ",
    "  #  #  #  ",
  ], { "#": "#1c1d40", C: "#9ff5c8", G: "#2a7a3a", P: "#c25ad6", Y: "#ffd35a" });

  /* ---------- helpers ---------- */
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };

  function disc(cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -Math.ceil(r); dy <= r; dy++) {
      const y = Math.round(cy + dy);
      if (y < 0 || y >= H) continue;
      const w = Math.sqrt(Math.max(0, r * r - dy * dy));
      const x0 = Math.max(0, Math.round(cx - w)), x1 = Math.min(W, Math.round(cx + w) + 1);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }

  function gradient(y0, y1, pal) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, y1); y++) {
      const f = ((y - y0) / (y1 - y0)) * (pal.length - 1);
      for (let x = 0; x < W; x += 2) {
        ctx.fillStyle = pal[Math.min(pal.length - 1, Math.floor(f + BAYER[y & 3][(x >> 1) & 3] / 16))];
        ctx.fillRect(x, y, 2, 1);
      }
    }
  }

  function line(x0, y0, x1, y1, color, thick = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    ctx.fillStyle = color;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), thick, thick);
  }

  function puff(x, y, colors, n, spread, up, grav = 0, life = 1.2) {
    for (let i = 0; i < n; i++) parts.push({
      x, y, vx: (Math.random() - 0.5) * spread, vy: (Math.random() - 0.5) * spread - up, g: grav,
      life: 0, max: life * (0.6 + Math.random() * 0.8), color: colors[(Math.random() * colors.length) | 0], size: 1 + ((Math.random() * 3) | 0),
    });
  }
  function drawParts(dt) {
    parts = parts.filter((p) => (p.life += dt) < p.max);
    for (const p of parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(speed, dt, streak, maxY = H) {
    for (const s of stars) {
      if (speed) { s.x -= speed * s.z * dt; if (s.x < -10) { s.x = W + Math.random() * 10; s.y = Math.random() * H; } }
      if (s.y > maxY) continue;
      const len = streak ? Math.max(1, Math.round(speed * s.z * 0.05)) : 1;
      ctx.globalAlpha = 0.4 + s.z * 0.6;
      ctx.fillStyle = s.z > 0.7 ? "#ffffff" : "#9fb4ff";
      ctx.fillRect(Math.round(s.x), Math.round(s.y), len, 1);
    }
    ctx.globalAlpha = 1;
  }

  function flame(power) {
    if (power <= 0) return;
    const cols = ["#fff6b0", "#ffd25a", "#ff8a2a", "#f05a3a"];
    const len = (6 + Math.random() * 4) * power;
    for (let i = 0; i < len; i++) {
      const w = Math.max(1, Math.round(4 * (1 - i / len)));
      ctx.fillStyle = cols[Math.min(3, Math.floor((i / len) * 4))];
      ctx.fillRect(-HALF - 1 - i, -w / 2, 1, w);
    }
  }

  function drawShip(x, y, rot, power) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    flame(power);
    ctx.drawImage(SHIP, -HALF, -SHIP.height, SHIP.width * 2, SHIP.height * 2);
    ctx.restore();
  }

  // Upright ship standing on the ground with its side door and boarding ramp.
  function shipDoor(x, y) { return { x: x + 7, top: y - 3, feet: y + 6 }; }
  function drawDoorAndRamp(x, y, open, rampK, footX, footY) {
    const d = shipDoor(x, y);
    if (open) {
      ctx.fillStyle = "#1c1d40"; ctx.fillRect(d.x - 3, d.top, 4, d.feet - d.top);
      ctx.fillStyle = "#ffd35a"; ctx.fillRect(d.x - 2, d.top + 1, 2, d.feet - d.top - 1);
    }
    if (rampK > 0) {
      const ex = lerp(d.x, footX, rampK), ey = lerp(d.feet, footY, rampK);
      line(d.x, d.feet, ex, ey, "#8a90b8", 2);
      line(d.x, d.feet - 5, ex, ey - 5, "#5a5f94");
      for (let k = 0.25; k < rampK; k += 0.25) line(lerp(d.x, footX, k), lerp(d.feet, footY, k), lerp(d.x, footX, k), lerp(d.feet, footY, k) - 5, "#5a5f94");
    }
    return d;
  }

  /* ---------- tiny walking people, coloured from each traveler's look ---------- */
  function drawPerson(x, feet, L, t, walking, dir, wave) {
    const X = Math.round(x) - 3, Y = Math.round(feet) - 13;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + dx, Y + dy, w, h); };
    const legs = "#3b3f6b", step = walking ? Math.floor(t * 8) % 2 : 0;
    if (step) { r(1, 10, 2, 3, legs); r(4, 10, 2, 3, legs); } else { r(2, 10, 1, 3, legs); r(4, 10, 1, 3, legs); }
    r(1, 6, 5, 4, L.shirt);
    const waving = wave && Math.floor(t * 4) % 2;
    r(0, 6, 1, 3, L.shirt); r(0, 9, 1, 1, L.skin);
    if (waving) { r(6, 3, 1, 3, L.shirt); r(6, 2, 1, 1, L.skin); } else { r(6, 6, 1, 3, L.shirt); r(6, 9, 1, 1, L.skin); }
    r(1, 1, 5, 5, L.skin);
    const back = dir < 0 ? 5 : 1;
    switch (L.hairStyle) {
      case "spiky": r(1, 0, 5, 2, L.hair); r(1, -1, 1, 1, L.hair); r(3, -1, 1, 1, L.hair); r(5, -1, 1, 1, L.hair); r(back, 2, 1, 1, L.hair); break;
      case "long": r(1, 0, 5, 2, L.hair); r(back, 2, 1, 5, L.hair); break;
      case "bun": r(1, 0, 5, 2, L.hair); r(2, -2, 3, 2, L.hair); break;
      case "afro": r(0, -1, 7, 3, L.hair); r(back === 5 ? 6 : 0, 2, 1, 2, L.hair); break;
      case "buzz": r(1, 0, 5, 1, L.hair); break;
      default: r(1, 0, 5, 2, L.hair); r(back, 2, 1, 2, L.hair);
    }
    const eye = dir < 0 ? 2 : 4;
    if (L.accessory === "visor") r(1, 3, 5, 1, "#5ad1ff");
    else if (L.accessory === "glasses") { r(eye - 1, 3, 3, 1, "#2b2d5c"); }
    else r(eye, 3, 1, 1, L.eyes || "#2b2d5c");
  }

  /* ---------- GATEWAY spaceport (boarding and launch) ---------- */
  const portGround = () => H - 16;
  const padX = () => W * 0.42;
  const padShipY = () => portGround() - 3 - HALF;

  function drawSpaceport(t) {
    ctx.fillStyle = "#0b0a1f"; ctx.fillRect(0, 0, W, H);
    gradient(H * 0.35, portGround(), ["#0b0a1f", "#141a3a", "#1f2a5a", "#36457f", "#5a5f9a"]);
    drawStars(0, 0, false, H * 0.6);
    disc(W * 0.82, H * 0.18, 9, "#e8e4ff"); disc(W * 0.82 + 3, H * 0.18 - 2, 7, "#0b0a1f");
    const g = portGround();
    for (const b of city) {
      ctx.fillStyle = "#151530"; ctx.fillRect(b.x, g - b.h, b.w, b.h);
      for (const w of b.windows) if (hash(w[0], w[1], Math.floor(t * 0.7 + w[0])) > 0.15) px(b.x + w[0], g - b.h + w[1], "#ffd35a");
      if (b.beacon && Math.floor(t * 2 + b.x) % 2) px(b.x + (b.w >> 1), g - b.h - 1, "#ff5a5a");
    }
    ctx.fillStyle = "#24203a"; ctx.fillRect(0, g, W, H - g);
    ctx.fillStyle = "#3a3556"; ctx.fillRect(0, g, W, 1);
    for (let x = 4; x < W; x += 16) { ctx.fillStyle = Math.floor(t * 3 + x / 16) % 3 ? "#5a5f9a" : "#7ff0c0"; ctx.fillRect(x, g + 6, 6, 1); }
    const p = padX();
    ctx.fillStyle = "#6a6f9a"; ctx.fillRect(p - 18, g - 3, 36, 3);
    ctx.fillStyle = "#ffd35a"; for (let x = p - 16; x < p + 16; x += 6) ctx.fillRect(x, g - 3, 3, 1);
    ctx.fillStyle = "#4a4f7a"; ctx.fillRect(p - 28, g - 52, 4, 52);
    for (let y = g - 52; y < g; y += 6) ctx.fillRect(p - 30, y, 8, 1);
    ctx.fillRect(p - 24, g - 40, 10, 2);
    if (Math.floor(t * 2) % 2) px(p - 26, g - 54, "#ff5a5a");
  }

  // People queue on the right, walk to the ramp, climb it and disappear through the door.
  function boardingPaths() {
    const g = portGround(), d = shipDoor(padX(), padShipY());
    const foot = { x: padX() + 34, y: g };
    return crew.map((L, i) => {
      const startX = Math.min(W * 0.7 + i * 13, W + 60);
      return { L, startX, L1: startX - foot.x, L2: Math.hypot(foot.x - d.x, g - d.feet), foot, d };
    });
  }

  function drawBoarding(t) {
    const g = portGround();
    const boarding = t < T.boardEnd;
    drawDoorAndRamp(padX(), padShipY(), boarding, boarding ? 1 : 0, padX() + 34, g);
    if (!boarding) return;
    for (const p of boardingPaths()) {
      const s = Math.max(0, (t - 0.6) * 32);
      if (s < p.L1) drawPerson(p.startX - s, g, p.L, t, s > 0, -1);
      else if (s < p.L1 + p.L2) {
        const k = (s - p.L1) / p.L2;
        drawPerson(lerp(p.foot.x, p.d.x + 2, k), lerp(g, p.d.feet, k), p.L, t, true, -1);
      }
    }
  }

  // Ship lifts off the pad and leaves the top of the screen (land / chase).
  // sound effects live in sound.js; this is safe even if that file is missing
  const sfx = (name) => window.Sfx && window.Sfx.play(name);

  function drawLaunch(t, dt) {
    const k = t - T.lift;
    if (!ship.launched) { ship.launched = true; sfx("launch"); }
    const rise = k < 0.5 ? 0 : 0.5 * H * 0.9 * (k - 0.5) ** 2;
    const shake = k < 0.5 ? (Math.random() - 0.5) * 1.5 : 0;
    if (Math.random() < 0.7) puff(padX() + (Math.random() - 0.5) * 24, portGround() - 3, ["#8a8090", "#b0a8b8", "#6a6070"], 1, 30, 4, 0, 1.4);
    drawShip(padX() + shake, padShipY() - rise, -Math.PI / 2, k < 0.5 ? 0.5 + k : 1.4);
    drawParts(dt);
  }

  /* ---------- Nova Prime: the destination planet ---------- */
  const CANDY = ["#3a1a5a", "#7a3a9a", "#d06ab0", "#ffb0d8"];
  const TEAL = ["#0f3a5a", "#1f7a8a", "#4fd0c0", "#c0fff0"];
  const GOLD = ["#5a2a1a", "#a0582a", "#f0a050", "#ffe0a0"];

  function drawNova(cx, cy, R, t) {
    disc(cx, cy, R + 4, "rgba(127, 240, 220, 0.12)");
    disc(cx, cy, R + 2, "rgba(255, 176, 216, 0.22)");
    const ring = (front) => {
      const rx = R * 1.95, ry = R * 0.42, tilt = -0.28, n = Math.ceil(rx * 7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, s = Math.sin(a);
        if ((s > 0) !== front) continue;
        for (const [k, base] of [[1, "#5ad1ff"], [0.88, "#c8f4ff"], [0.76, "#d05ad6"]]) {
          const ox = Math.cos(a) * rx * k, oy = s * ry * k;
          const x = cx + ox * Math.cos(tilt) - oy * Math.sin(tilt), y = cy + ox * Math.sin(tilt) + oy * Math.cos(tilt);
          const sparkle = hash(i, k * 10, Math.floor(t * 6)) > 0.93;
          px(x, y, sparkle ? "#ffffff" : base);
        }
      }
    };
    const moon = (orbit, speed, r, pal, front) => {
      const a = t * speed, s = Math.sin(a);
      if ((s > 0) !== front) return;
      const mx = cx + Math.cos(a) * orbit, my = cy + s * orbit * 0.3 - Math.cos(a) * orbit * 0.12;
      disc(mx, my, r, pal[1]); disc(mx - r * 0.3, my - r * 0.3, r * 0.6, pal[2]);
    };
    ring(false); moon(R * 2.4, 0.9, 3, TEAL, false); moon(R * 1.6, -1.4, 2, GOLD, false);

    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) {
      const ny = (y + 0.5 - cy) / R, half = Math.sqrt(Math.max(0, 1 - ny * ny)) * R;
      const xa = Math.max(0, Math.floor(cx - half)), xb = Math.min(W - 1, Math.ceil(cx + half));
      let run = null, runX = xa;
      for (let x = xa; x <= xb + 1; x++) {
        let color = null;
        if (x <= xb) {
          const nx = (x + 0.5 - cx) / R, d2 = nx * nx + ny * ny;
          if (d2 <= 1) {
            const nz = Math.sqrt(1 - d2);
            const light = clamp(-0.5 * nx - 0.5 * ny + 0.72 * nz, 0, 1);
            const swirl = Math.sin(ny * 9 + nx * 2 + noise(nx * 3 + t * 0.15, ny * 3, 4) * 5 + t * 0.4);
            let pal = swirl > 0.35 ? CANDY : swirl < -0.45 ? TEAL : GOLD;
            let lit = light;
            const ex = nx - 0.32, ey = ny - 0.18, ed = Math.hypot(ex * 1.4, ey * 2.2);
            if (ed < 0.22) { pal = CANDY; lit = 0.55 + Math.sin(Math.atan2(ey, ex) * 2 + ed * 40 - t * 4) * 0.45; }
            color = pal[clamp(Math.floor(lit * 3.4 + BAYER[y & 3][x & 3] / 16 * 0.9), 0, 3)];
          }
        }
        if (color !== run) { if (run) { ctx.fillStyle = run; ctx.fillRect(runX, y, x - runX, 1); } run = color; runX = x; }
      }
    }
    ring(true); moon(R * 2.4, 0.9, 3, TEAL, true); moon(R * 1.6, -1.4, 2, GOLD, true);
  }

  /* ---------- Nova Prime surface ---------- */
  const surfGround = () => H - 22;
  const landX = () => W * 0.36;
  const landShipY = () => surfGround() - 3 - HALF;

  function buildLayers() {
    // nebula behind the space scenes
    nebula = document.createElement("canvas"); nebula.width = W; nebula.height = H;
    let g = nebula.getContext("2d"), img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = noise(x / 30, y / 30, 31) * 0.7 + noise(x / 9, y / 9, 32) * 0.3 + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.25;
      const hue = noise(x / 50 + 9, y / 50, 33);
      const c = v > 0.62 ? (hue > 0.5 ? [58, 26, 90] : [18, 58, 90]) : v > 0.5 ? (hue > 0.5 ? [32, 16, 56] : [12, 32, 56]) : [11, 10, 31];
      const o = (y * W + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);

    // static parts of the surface: sky, sister planet, mountains, ground
    surface = document.createElement("canvas"); surface.width = W; surface.height = H;
    ctx = surface.getContext("2d");
    const gy = surfGround();
    gradient(0, gy, ["#120a30", "#22104f", "#3e1a70", "#6a2480", "#a83a7a", "#e0606a", "#ff9a5a"]);
    for (let i = 0; i < 70; i++) { const x = hash(i, 1, 40) * W, y = hash(i, 2, 40) * H * 0.4; px(x, y, hash(i, 3, 40) > 0.7 ? "#ffffff" : "#b8a8ff"); }
    // big ringed sister planet low on the horizon
    const sx = W * 0.8, sy = gy - H * 0.36, sr = H * 0.17;
    for (let i = 0; i < 400; i++) { const a = (i / 400) * Math.PI * 2; if (Math.sin(a) < 0) px(sx + Math.cos(a) * sr * 1.7, sy + Math.sin(a) * sr * 0.3, "#ffd0a0"); }
    for (let y = Math.floor(sy - sr); y < sy + sr; y++) for (let x = Math.floor(sx - sr); x < sx + sr; x++) {
      const nx = (x - sx) / sr, ny = (y - sy) / sr; if (nx * nx + ny * ny > 1) continue;
      const band = Math.floor(ny * 6 + Math.sin(nx * 4) * 0.4 + 10) % 3;
      const pal = [["#5a3a8a", "#8a5ab0"], ["#7a4a9a", "#b07ac8"], ["#9a5a8a", "#d08ab0"]][band];
      px(x, y, (nx * -0.6 + ny * -0.5 + 0.4 + BAYER[y & 3][x & 3] / 32) > 0.3 ? pal[1] : pal[0]);
    }
    for (let i = 0; i < 400; i++) { const a = (i / 400) * Math.PI * 2; if (Math.sin(a) >= 0) px(sx + Math.cos(a) * sr * 1.7, sy + Math.sin(a) * sr * 0.3, "#ffe0b8"); }
    disc(W * 0.12, H * 0.14, 4, "#ffe8f0"); disc(W * 0.12 + 1.5, H * 0.14 - 1, 3, "#22104f");
    // mountain layers
    for (let x = 0; x < W; x++) {
      const far = H * 0.16 + noise(x / 22, 0, 41) * H * 0.18;
      ctx.fillStyle = "#4a1f6a"; ctx.fillRect(x, gy - far, 1, far);
      const mid = H * 0.06 + noise(x / 12, 5, 42) * H * 0.1;
      ctx.fillStyle = "#2a1450"; ctx.fillRect(x, gy - mid, 1, mid);
    }
    // ground with dithered texture
    for (let y = gy; y < H; y++) for (let x = 0; x < W; x++) {
      const n = noise(x / 6, y / 3, 43) + BAYER[y & 3][x & 3] / 32;
      px(x, y, y === gy ? "#5ae0b0" : n > 0.75 ? "#2a8a7a" : n > 0.4 ? "#1d6464" : "#124448");
    }
    ctx = screen;

    // animated props, kept away from the landing spot
    props = [];
    const avoid = (x) => Math.abs(x - landX()) < 34 || Math.abs(x - (landX() + 34)) < 40;
    for (let i = 0; i < 14; i++) {
      const x = hash(i, 7, 44) * W;
      if (avoid(x)) continue;
      const kind = hash(i, 8, 44) > 0.5 ? "spire" : "shroom";
      props.push({ kind, x, h: 10 + hash(i, 9, 44) * 22, w: 5 + hash(i, 10, 44) * 6, hue: hash(i, 11, 44) > 0.5, phase: hash(i, 12, 44) * 6 });
    }
    props.sort((a, b) => b.h - a.h);
  }

  function drawProps(t) {
    const gy = surfGround();
    for (const p of props) {
      const glow = (Math.sin(t * 2 + p.phase) + 1) / 2;
      if (p.kind === "spire") {
        const pal = p.hue ? ["#2a8ab0", "#5ad1ff", "#c8f4ff"] : ["#8a2a9a", "#d05ad6", "#ffc8f5"];
        for (let yy = 0; yy < p.h; yy++) {
          const half = Math.max(0.5, (p.w / 2) * (yy / p.h));
          const y = gy - p.h + yy;
          ctx.fillStyle = pal[0]; ctx.fillRect(Math.round(p.x - half), y, Math.round(half * 2) || 1, 1);
          ctx.fillStyle = pal[1]; ctx.fillRect(Math.round(p.x - half), y, Math.max(1, Math.round(half * 0.7)), 1);
        }
        ctx.globalAlpha = 0.4 + glow * 0.6; px(p.x, gy - p.h - 1, pal[2]); px(p.x, gy - p.h, "#ffffff"); ctx.globalAlpha = 1;
      } else {
        const capR = p.w * 0.8, top = gy - p.h * 0.6;
        ctx.fillStyle = "#e8d8c8"; ctx.fillRect(Math.round(p.x - 1), Math.round(top), 2, gy - top);
        ctx.globalAlpha = 0.15 + glow * 0.25; disc(p.x, top + 2, capR + 3, p.hue ? "#ffd35a" : "#ff5ad6"); ctx.globalAlpha = 1;
        const cap = p.hue ? ["#c07a1a", "#ffd35a"] : ["#a02a8a", "#ff5ad6"];
        for (let dy = -capR * 0.6; dy <= 0; dy++) {
          const w = Math.sqrt(Math.max(0, 1 - (dy / (capR * 0.6)) ** 2)) * capR;
          ctx.fillStyle = dy > -1.5 ? cap[0] : cap[1];
          ctx.fillRect(Math.round(p.x - w), Math.round(top + dy), Math.round(w * 2), 1);
        }
        px(p.x - capR * 0.4, top - capR * 0.3, "#ffffff"); px(p.x + capR * 0.3, top - capR * 0.4, "#ffffff");
      }
    }
    // glowing grass
    for (let i = 0; i < 40; i++) {
      const x = hash(i, 20, 45) * W, y = gy + 2 + hash(i, 21, 45) * (H - gy - 4);
      if (Math.sin(t * 3 + i) > 0.2) px(x, y, i % 2 ? "#7ff0c0" : "#ffb0e8");
    }
  }

  function drawAurora(t) {
    ctx.globalCompositeOperation = "lighter";
    for (let x = 0; x < W; x++) {
      const y = H * 0.08 + Math.sin(x * 0.05 + t * 0.8) * 6 + Math.sin(x * 0.13 - t * 1.3) * 3;
      const shimmer = 0.6 + 0.4 * Math.sin(x * 0.3 + t * 3);
      for (let k = 0; k < 14; k++) {
        ctx.globalAlpha = 0.35 * shimmer * (1 - k / 14);
        px(x, y + k, k < 4 ? "#3aff9a" : x % 9 < 5 ? "#1ad0a0" : "#4a6aff");
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawSpores(dt) {
    if (spores.length < 30 && Math.random() < 0.3) spores.push({ x: Math.random() * W, y: H, v: 4 + Math.random() * 8, p: Math.random() * 6, c: Math.random() < 0.5 ? "#7ff0c0" : "#ffb0e8" });
    spores = spores.filter((s) => (s.y -= s.v * dt) > H * 0.3);
    for (const s of spores) { ctx.globalAlpha = 0.7; px(s.x + Math.sin(s.y * 0.1 + s.p) * 3, s.y, s.c); }
    ctx.globalAlpha = 1;
  }

  // a little local alien who comes out to greet the ship
  function drawCritter(t, excited) {
    const gy = surfGround(), x = Math.round(W * 0.86), hop = Math.abs(Math.sin(t * (excited ? 7 : 3))) * (excited ? 5 : 2);
    const y = Math.round(gy - hop);
    ctx.fillStyle = "#1c1d40"; ctx.fillRect(x - 4, y - 6, 9, 6);
    ctx.fillStyle = "#7fe060"; ctx.fillRect(x - 3, y - 6, 7, 5); ctx.fillRect(x - 2, y - 7, 5, 1);
    ctx.fillStyle = "#1c1d40"; ctx.fillRect(x - 1, y - 5, 1, 1); ctx.fillRect(x + 1, y - 5, 1, 1);
    ctx.fillStyle = "#7fe060"; ctx.fillRect(x - 2, y - 10, 1, 3); ctx.fillRect(x + 2, y - 10, 1, 3);
    px(x - 2, y - 11, "#ffd35a"); px(x + 2, y - 11, "#ffd35a");
  }

  /* ---------- scenes ---------- */
  function sceneLand(t, dt) {
    if (t < T.space) { drawSpaceport(t); if (t < T.lift) { drawShip(padX(), padShipY(), -Math.PI / 2, 0); drawBoarding(t); } else drawLaunch(t, dt); return; }

    if (t < T.surface) {
      const k = t - T.space;
      ctx.drawImage(nebula, 0, 0);
      drawStars(lerp(110, 20, ease(k / 3)), dt, true);
      const grow = ease(k / 3.2);
      drawNova(W * 0.74, H * 0.48, lerp(16, Math.min(W, H) * 0.34, grow), t);
      drawShip(lerp(-HALF, W * 0.42, ease(k / 2.2)), H * 0.5 + Math.sin(k * 2) * 3, 0, 1);
      if (k > 2.9) { ctx.fillStyle = `rgba(255, 240, 250, ${clamp((k - 2.9) / 0.4, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
      return;
    }

    const k = t - T.surface, gy = surfGround(), lx = landX(), ly = landShipY();
    ctx.drawImage(surface, 0, 0);
    drawAurora(t);
    drawProps(t);
    drawSpores(dt);

    // glowing landing pad
    const glow = (Math.sin(t * 4) + 1) / 2;
    for (let i = -14; i <= 14; i++) px(lx + i, gy, glow > 0.5 && Math.abs(i) % 4 === 0 ? "#ffffff" : "#5ad1ff");

    const touch = T.touch - T.surface;
    const landed = k >= touch;
    const y = landed ? ly : lerp(-HALF, ly, 1 - (1 - k / touch) ** 2);
    if (!ship.descending) { ship.descending = true; sfx("launch"); }
    if (landed && !ship.dust) { ship.dust = true; puff(lx, gy - 1, ["#9ff5d0", "#ffb0e8", "#ffffff"], 50, 60, 6, 10, 1.4); sfx("land"); }
    if (t > T.exitDone && !ship.cheered) { ship.cheered = true; sfx("fanfare"); }
    drawShip(lx, y, -Math.PI / 2, landed ? 0 : lerp(1.4, 0.6, k / touch));

    const after = t - T.touch, foot = { x: lx + 34, y: gy };
    if (landed) {
      const d = drawDoorAndRamp(lx, ly, after > 0.3, ease((after - 0.4) / 0.5), foot.x, foot.y);
      crew.forEach((L, i) => {
        const s = (after - 1.0 - i * 0.55) * 30;
        if (s < 0) return;
        const L2 = Math.hypot(foot.x - d.x, foot.y - d.feet);
        const target = foot.x + 10 + i * 11, walk = target - foot.x;
        if (s < L2) drawPerson(lerp(d.x + 2, foot.x, s / L2), lerp(d.feet, foot.y, s / L2), L, t, true, 1);
        else if (s < L2 + walk) drawPerson(foot.x + (s - L2), gy, L, t, true, 1);
        else {
          const since = (s - L2 - walk) / 30;
          drawPerson(target, gy - Math.abs(Math.sin(since * 6 + i)) * 3, L, t + i * 0.3, false, 1, true);
        }
      });
    }
    drawCritter(t, after > T.exitDone - T.touch - 1);
    drawParts(dt);
    if (k < 0.5) { ctx.fillStyle = `rgba(255, 240, 250, ${1 - k / 0.5})`; ctx.fillRect(0, 0, W, H); }
  }

  function sceneChase(t, dt) {
    if (t < T.space) { drawSpaceport(t); if (t < T.lift) { drawShip(padX(), padShipY(), -Math.PI / 2, 0); drawBoarding(t); } else drawLaunch(t, dt); return; }
    const k = t - T.space;
    if (!ship.alarmed && k > 0.6) { ship.alarmed = true; sfx("alarm"); }
    ctx.drawImage(nebula, 0, 0);
    drawStars(160, dt, true);

    if (Math.random() < 0.04) rocks.push({ x: W + 10, y: Math.random() * H, r: 2 + Math.random() * 5, v: 60 + Math.random() * 80 });
    rocks = rocks.filter((r) => (r.x -= r.v * dt) > -12);
    for (const r of rocks) {
      disc(r.x, r.y, r.r, "#4a4060"); disc(r.x - r.r * 0.25, r.y - r.r * 0.25, r.r * 0.7, "#6a6080");
      if (r.r > 3) disc(r.x + r.r * 0.3, r.y + r.r * 0.1, r.r * 0.25, "#3a3050");
    }

    const jit = () => (Math.random() - 0.5) * 2.5;
    const enter = ease(k / 1.2);
    const sx = lerp(-HALF, W * 0.64 + Math.sin(k * 0.8) * 8, enter) + jit();
    const sy = H * 0.5 + Math.sin(k * 2.3) * H * 0.2 + jit();
    const rot = Math.cos(k * 2.3) * 0.25 + (Math.random() - 0.5) * 0.08;

    const ufos = [0, 1, 2].map((i) => ({
      x: lerp(-30, W * 0.1 + i * 16, ease((k - 0.6) / 1.4)) + Math.sin(k * 1.7 + i) * 6,
      y: H * 0.5 + Math.sin((k - 0.4 - i * 0.15) * 2.3) * H * 0.2 + (i - 1) * 16 + Math.sin(k * 5 + i) * 2,
    }));
    if (k > nextShot) {
      const u = ufos[(Math.random() * 3) | 0];
      lasers.push({ x: u.x + 10, y: u.y, vy: (sy + (Math.random() < 0.5 ? -14 : 14) - u.y) / (Math.max(20, sx - u.x) / 170) });
      sfx("zap");
      nextShot = k + 0.35 + Math.random() * 0.3;
    }
    lasers = lasers.filter((l) => { l.x += 170 * dt; l.y += l.vy * dt; return l.x < W + 10; });
    for (const l of lasers) { ctx.fillStyle = "#ff5ad6"; ctx.fillRect(Math.round(l.x), Math.round(l.y), 6, 1); ctx.fillStyle = "#ffd0f5"; ctx.fillRect(Math.round(l.x) + 4, Math.round(l.y), 2, 1); }

    for (const u of ufos) {
      ctx.drawImage(UFO, Math.round(u.x - UFO.width), Math.round(u.y - UFO.height), UFO.width * 2, UFO.height * 2);
      if (Math.floor(k * 8) % 2) { ctx.fillStyle = "#9ff5c8"; ctx.fillRect(Math.round(u.x) - 1, Math.round(u.y) + 6, 2, 2); }
    }
    if (Math.random() < 0.5) puff(sx - HALF * 2, sy, ["#ffd25a", "#ff8a2a"], 1, 8, 0, 0, 0.3);
    drawShip(sx, sy, rot, 1.2);
    drawParts(dt);

    if (Math.floor(k * 3) % 2) {
      ctx.fillStyle = "rgba(239, 83, 80, 0.55)";
      ctx.fillRect(0, 0, W, 2); ctx.fillRect(0, H - 2, W, 2); ctx.fillRect(0, 0, 2, H); ctx.fillRect(W - 2, 0, 2, H);
    }
  }

  function sceneCrash(t, dt) {
    const g = portGround();
    let shakeX = 0, shakeY = 0;
    if (boomT >= 0) { const k = Math.max(0, 1 - (t - boomT) / 1.2); shakeX = (Math.random() - 0.5) * 8 * k; shakeY = (Math.random() - 0.5) * 8 * k; }
    ctx.save();
    ctx.translate(Math.round(shakeX), Math.round(shakeY));
    drawSpaceport(t);
    if (t < T.lift) { drawShip(padX(), padShipY(), -Math.PI / 2, 0); drawBoarding(t); ctx.restore(); return; }

    const k = t - T.lift;
    if (!ship.init) Object.assign(ship, { init: true, x: padX(), y: padShipY(), vx: 0, vy: 0, rot: -Math.PI / 2 });
    let power = 0;
    if (!ship.launched) { ship.launched = true; sfx("launch"); }
    if (k > 2.6 && !ship.sputtered) { ship.sputtered = true; sfx("sputter"); }
    if (boomT < 0) {
      if (k < 1) { power = 0.4 + k * 0.4; ship.x = padX() + (Math.random() - 0.5) * 1.2; if (Math.random() < 0.6) puff(padX() + (Math.random() - 0.5) * 20, g - 3, ["#8a8090", "#b0a8b8", "#6a6070"], 1, 30, 4, 0, 1.4); }
      else if (k < 2.6) { power = 1.3; ship.vy -= H * 0.25 * dt; }
      else if (k < 3.4) {
        const on = Math.random() < 0.35; power = on ? 0.8 : 0;
        ship.vy += H * (on ? 0.1 : 0.5) * dt;
        ship.rot = -Math.PI / 2 + Math.sin(t * 22) * 0.15;
        if (Math.random() < 0.6) puff(ship.x, ship.y + HALF, ["#55505f", "#77707f", "#3a3545"], 1, 8, -6, 0, 1.2);
      } else {
        ship.vy += H * 0.5 * dt; ship.vx = W * 0.07;
        ship.rot = Math.min(Math.PI / 2, ship.rot + 2.2 * dt);
        const tx = ship.x - Math.cos(ship.rot) * HALF, ty = ship.y - Math.sin(ship.rot) * HALF;
        puff(tx, ty, ["#55505f", "#77707f", "#3a3545"], 1, 6, 4, 0, 1.4);
        if (Math.random() < 0.5) puff(tx, ty, ["#ffb030", "#ff6a2a"], 1, 6, 0, 0, 0.4);
      }
      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      const nose = ship.y + Math.sin(ship.rot) * HALF;
      if (k > 3.4 && nose >= g) {
        boomT = t; ship.x += Math.cos(ship.rot) * HALF * 0.6;
        sfx("boom");
        puff(ship.x, g - 4, ["#ffffff", "#ffd25a", "#ff8a2a", "#f05a3a"], 90, 90, 25, 40, 1.2);
        puff(ship.x, g - 4, ["#55505f", "#3a3545", "#77707f"], 40, 40, 20, -4, 2.2);
        // everyone ejects and parachutes down safely
        chutes = crew.map((L, i) => ({ L, x: ship.x, y: g - 8, vx: (i - (crew.length - 1) / 2) * 14 + (Math.random() - 0.5) * 6, vy: -H * 0.55 - Math.random() * 10, open: false, landed: false, c: ["#ff5a5a", "#ffd35a", "#5ad1ff", "#7fe060", "#d05ad6", "#ff9a5a"][i % 6] }));
      } else {
        drawShip(ship.x, ship.y, ship.rot, power);
      }
    }
    if (boomT >= 0) {
      const since = t - boomT;
      if (since < 0.6) { ctx.strokeStyle = `rgba(255, 220, 140, ${1 - since / 0.6})`; ctx.beginPath(); ctx.arc(ship.x, g - 4, 6 + since * 70, 0, Math.PI * 2); ctx.stroke(); }
      puff(ship.x + (Math.random() - 0.5) * 10, g - 4, ["#55505f", "#6b6676", "#3a3545"], 1, 8, 14, 0, 2);
      if (Math.random() < 0.6) puff(ship.x + (Math.random() - 0.5) * 12, g - 3, ["#ffb030", "#ff6a2a", "#ffd25a"], 1, 6, 10, 0, 0.6);
    }
    drawParts(dt);
    for (const c of chutes) {
      if (!c.landed) {
        if (!c.open && c.vy > 0) c.open = true;
        c.vy = c.open ? 14 : c.vy + H * 0.9 * dt;
        c.vx *= c.open ? 0.98 : 1;
        c.x += (c.vx + (c.open ? Math.sin(t * 2 + c.x) * 6 : 0)) * dt; c.y += c.vy * dt;
        c.x = clamp(c.x, 6, W - 6);
        if (c.y >= g) { c.y = g; c.landed = true; }
      }
      if (c.open && !c.landed) {
        for (let dx = -6; dx <= 6; dx++) { const h = Math.round(Math.sqrt(36 - dx * dx) * 0.6); ctx.fillStyle = Math.floor((dx + 6) / 3) % 2 ? "#ffffff" : c.c; ctx.fillRect(Math.round(c.x) + dx, Math.round(c.y) - 22 - h, 1, h + 1); }
        line(c.x - 6, c.y - 22, c.x - 1, c.y - 11, "#c8c8e0"); line(c.x + 6, c.y - 22, c.x + 1, c.y - 11, "#c8c8e0");
      }
      drawPerson(c.x, c.y, c.L, t, false, 1, c.landed);
    }
    ctx.restore();
    if (boomT >= 0 && t - boomT < 0.12) { ctx.fillStyle = "rgba(255, 255, 255, 0.6)"; ctx.fillRect(0, 0, W, H); }
  }

  /* ---------- loop ---------- */
  function resize() {
    const aspect = innerWidth > 0 && innerHeight > 0 ? innerHeight / innerWidth : 9 / 16;
    W = 240; H = Math.round(240 * aspect);
    if (H < 135) { H = 135; W = Math.round(135 / aspect); }
    cvs.width = W; cvs.height = H;
    screen.imageSmoothingEnabled = false;
    stars = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));
    city = [];
    for (let x = 0; x < W; ) {
      const w = 8 + ((hash(x, 1, 50) * 14) | 0), h = 8 + ((hash(x, 2, 50) * H * 0.22) | 0);
      if (Math.abs(x + w / 2 - padX()) > 40) {
        const windows = [];
        for (let wy = 3; wy < h - 2; wy += 4) for (let wx = 2; wx < w - 1; wx += 3) if (hash(x + wx, wy, 51) > 0.45) windows.push([wx, wy]);
        city.push({ x, w, h, windows, beacon: hash(x, 3, 50) > 0.6 });
      }
      x += w + 2;
    }
    buildLayers();
  }

  function timeline() {
    const paths = boardingPaths();
    const lastPath = paths[paths.length - 1];
    T.boardEnd = 0.6 + (lastPath.L1 + lastPath.L2) / 32 + 0.5;
    T.lift = T.boardEnd + 0.5;
    T.space = T.lift + 2.1;
    T.surface = T.space + 3.3;
    T.touch = T.surface + 2.4;
    const foot = landX() + 34, d = shipDoor(landX(), landShipY());
    const L2 = Math.hypot(foot - d.x, surfGround() - d.feet);
    T.exitDone = T.touch + 1.0 + (crew.length - 1) * 0.55 + (L2 + 10 + (crew.length - 1) * 11) / 30;
    T.end = { land: T.exitDone + 1.8, chase: T.space + 5.5, crash: T.lift + 7 }[mode];
  }

  function frame(now) {
    const t = (now - start) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === "land") sceneLand(t, dt);
    else if (mode === "chase") sceneChase(t, dt);
    else sceneCrash(t, dt);
    if (!called && t > T.end) { called = true; callback && callback(); }
    raf = requestAnimationFrame(frame);
  }

  const PILOT = { skin: "#f0c9a0", hair: "#2b2d5c", hairStyle: "buzz", shirt: "#3d8bfd", eyes: "#2b2d5c", accessory: "visor" };

  return {
    // crew: looks of the travelers who were approved (they board the ship)
    play(m, people, onDone) {
      mode = m; callback = onDone; called = false;
      crew = (people && people.length ? people : [PILOT]).slice(0, 8);
      parts = []; lasers = []; rocks = []; spores = []; chutes = []; ship = {}; boomT = -1; nextShot = 0.6;
      resize();
      timeline();
      addEventListener("resize", resize);
      cancelAnimationFrame(raf);
      start = last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(raf); removeEventListener("resize", resize); },
  };
})();
