/* Title screen: a pixel solar system that swirls into orbit. */
window.Intro = (() => {
  const cvs = document.getElementById("intro-canvas");
  const ctx = cvs.getContext("2d");
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  let W = 320, H = 180, S = 1, cx = 160, cy = 90;
  let raf = null, start = 0, stars = [], nebula = null, shooting = null, popped = false;

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

  const P = {
    rock:    ["#3a2618", "#6e4a2c", "#a8774a", "#e0b07a"],
    ocean:   ["#0d1e4a", "#1d4c9a", "#3a86d6", "#7fc4ff"],
    land:    ["#1b3a12", "#2f6b22", "#5fae3a", "#a8e06a"],
    lava:    ["#2a0a0a", "#5a1410", "#a8301a", "#e0541c"],
    gasA:    ["#3b1f4a", "#7a3f7a", "#c9739a", "#ffd0b0"],
    gasB:    ["#2a2050", "#4f4290", "#8a7ad0", "#cfc4ff"],
    ice:     ["#1a3a4a", "#3a7a9a", "#8fd0e0", "#eaffff"],
    crystal: ["#2a0a3a", "#6a1a8a", "#b44ae0", "#f0a0ff"],
    sun:     ["#ff6a1a", "#ffa02e", "#ffd25a", "#fff4b8"],
  };

  const planets = [
    { type: "rock",    r: 3.5, orbit: 26,  tilt: 0.42, speed: 1.9,  phi: 0.1,  spin: 0.3, seed: 1 },
    { type: "earth",   r: 6,   orbit: 42,  tilt: 0.38, speed: 1.2,  phi: -0.2, spin: 0.12, seed: 2, moon: true },
    { type: "lava",    r: 5,   orbit: 58,  tilt: 0.45, speed: 0.95, phi: 0.35, spin: 0.2, seed: 3 },
    { type: "gas",     r: 10,  orbit: 80,  tilt: 0.36, speed: 0.6,  phi: -0.1, spin: 0.08, seed: 4, ring: true },
    { type: "ice",     r: 6.5, orbit: 103, tilt: 0.4,  speed: 0.42, phi: 0.2,  spin: 0.1, seed: 5, moon: true },
    { type: "crystal", r: 3,   orbit: 122, tilt: 0.33, speed: 0.3,  phi: -0.3, spin: 0.4, seed: 6 },
  ];
  planets.forEach((p, i) => (p.a0 = i * 1.7));

  function resize() {
    const aspect = innerWidth > 0 && innerHeight > 0 ? innerHeight / innerWidth : 9 / 16;
    W = 320; H = Math.round(320 * aspect);
    if (H < 180) { H = 180; W = Math.round(180 / aspect); }
    cvs.width = W; cvs.height = H;
    S = Math.min(W / 320, H / 180);
    cx = W / 2; cy = H / 2 - (H > W ? 0 : 6);
    stars = Array.from({ length: Math.round(W * H / 400) }, () => ({
      x: Math.random() * W | 0, y: Math.random() * H | 0,
      p: Math.random() * 6.28, s: 0.5 + Math.random() * 2, big: Math.random() < 0.08,
    }));
    buildNebula();
  }

  function buildNebula() {
    nebula = document.createElement("canvas");
    nebula.width = W; nebula.height = H;
    const n = nebula.getContext("2d"), img = n.createImageData(W, H);
    const pal = [[8, 7, 24], [16, 13, 46], [30, 22, 72], [48, 30, 96], [22, 40, 88]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = noise(x / 40, y / 40, 9) * 0.6 + noise(x / 15, y / 15, 10) * 0.3 + noise(x / 6, y / 6, 11) * 0.1;
      const blue = noise(x / 55 + 30, y / 55, 12);
      v = v * 3.4 - 1 + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.7;
      let k = Math.max(0, Math.min(3, Math.floor(v)));
      if (k >= 2 && blue > 0.6) k = 4;
      const c = pal[k], o = (y * W + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    n.putImageData(img, 0, 0);
  }

  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };

  function drawSun(t) {
    const r = 13 * S, ri = Math.ceil(r * 1.9);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.hypot(dx + 0.5, dy + 0.5) / r;
      const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
      const th = BAYER[y & 3][x & 3] / 16;
      if (d <= 1) {
        const n = noise(dx / 3 + t * 1.5, dy / 3 - t, 20) * 0.5;
        const k = Math.max(0, Math.min(3, Math.floor((1 - d) * 3.2 + n + th * 0.8)));
        px(x, y, P.sun[k]);
      } else if (d < 1.9) {
        const flick = noise(Math.atan2(dy, dx) * 3 + t * 2, d * 4 - t * 3, 21);
        const glow = (1.9 - d) / 0.9 * 0.9 + flick * 0.35;
        if (glow > th + 0.35) {
          ctx.globalAlpha = glow > th + 0.75 ? 0.75 : 0.35;
          px(x, y, d < 1.25 ? "#ffb347" : "#ff6a2a");
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function drawPlanet(p, x0, y0, rad, t) {
    let lx = cx - x0, ly = cy - y0;
    const ll = Math.hypot(lx, ly, 18) || 1;
    const lz = 18 / ll; lx /= ll; ly /= ll;
    const ri = Math.ceil(rad), X = Math.round(x0), Y = Math.round(y0);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const nx = (dx + 0.5) / rad, ny = (dy + 0.5) / rad, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const light = Math.max(0, nx * lx + ny * ly + nz * lz);
      const u = Math.atan2(nx, nz) / Math.PI + t * p.spin, v = ny;
      const x = X + dx, y = Y + dy, th = BAYER[y & 3][x & 3] / 16 - 0.5;
      let pal = P[p.type] || P.rock, lit = light, glow = null;

      if (p.type === "earth") {
        const n = noise(u * 5 + 7, v * 3 + 2, p.seed);
        pal = n > 0.55 ? P.land : P.ocean;
        if (Math.abs(v) > 0.82) pal = P.ice;
      } else if (p.type === "gas") {
        const band = Math.floor(v * 4.5 + Math.sin(u * 7) * 0.35 + 10);
        pal = band % 2 ? P.gasA : P.gasB;
      } else if (p.type === "lava") {
        const n = noise(u * 6, v * 5, p.seed);
        if (Math.abs(n - 0.5) < 0.05) glow = n > 0.5 ? "#ffc04a" : "#ff7a1a";
      } else if (p.type === "crystal") {
        lit = light + (Math.floor(noise(u * 4, v * 4, p.seed) * 3) - 1) * 0.2;
      } else if (p.type === "rock") {
        if (noise(u * 7, v * 7, p.seed) > 0.68) lit -= 0.25;
      } else if (p.type === "ice") {
        lit += Math.sin(v * 14 + u * 2) * 0.08;
      }
      const k = Math.max(0, Math.min(3, Math.floor(lit * 3.6 + th * 0.9 + 0.2)));
      px(x, y, glow || pal[k]);
    }
  }

  function drawRing(x0, y0, rad, tilt, front) {
    const steps = 140;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2, s = Math.sin(a);
      if ((s > 0) !== front) continue;
      for (const [k, col] of [[1.55, "#e8c8a0"], [1.75, "#b88a6a"], [1.95, "#e8c8a0"]]) {
        px(Math.round(x0 + Math.cos(a) * rad * k), Math.round(y0 + s * rad * k * tilt), col);
      }
    }
  }

  function frame(now) {
    const t = (now - start) / 1000;
    const e = Math.min(1, t / 3.6), k = Math.pow(1 - e, 3);

    ctx.drawImage(nebula, 0, 0);
    for (const s of stars) {
      const b = (Math.sin(t * s.s + s.p) + 1) / 2;
      ctx.globalAlpha = 0.25 + b * 0.75;
      px(s.x, s.y, b > 0.8 ? "#ffffff" : "#bcd0ff");
      if (s.big && b > 0.6) { px(s.x - 1, s.y, "#7f95d8"); px(s.x + 1, s.y, "#7f95d8"); px(s.x, s.y - 1, "#7f95d8"); px(s.x, s.y + 1, "#7f95d8"); }
    }
    ctx.globalAlpha = 1;

    if (!shooting && Math.random() < 0.006) shooting = { x: Math.random() * W, y: Math.random() * H * 0.4, life: 0 };
    if (shooting) {
      shooting.life += 1;
      for (let i = 0; i < 8; i++) {
        ctx.globalAlpha = (1 - i / 8) * (1 - shooting.life / 40);
        px(Math.round(shooting.x + shooting.life * 2.2 - i * 1.5), Math.round(shooting.y + shooting.life * 1.1 - i * 0.75), "#ffffff");
      }
      ctx.globalAlpha = 1;
      if (shooting.life > 40) shooting = null;
    }

    // planet positions; swirl in from far away during the opening seconds
    const bodies = [{ depth: 0, draw: () => drawSun(t) }];
    for (const p of planets) {
      const R = p.orbit * S * (1 + 2.4 * k);
      const a = p.a0 + t * p.speed * 0.45 + k * k * 9;
      const rot = p.phi + Math.sin(t * 0.07 + p.seed) * 0.25;
      const ox = Math.cos(a) * R, oy = Math.sin(a) * R * p.tilt;
      const x = cx + ox * Math.cos(rot) - oy * Math.sin(rot);
      const y = cy + ox * Math.sin(rot) + oy * Math.cos(rot);
      const depth = Math.sin(a);
      const rad = p.r * S * (1 + depth * 0.15);

      ctx.globalAlpha = 0.16 * e;
      for (let i = 0; i < 120; i += 2) {
        const b = (i / 120) * Math.PI * 2, bx = Math.cos(b) * p.orbit * S, by = Math.sin(b) * p.orbit * S * p.tilt;
        px(Math.round(cx + bx * Math.cos(rot) - by * Math.sin(rot)), Math.round(cy + bx * Math.sin(rot) + by * Math.cos(rot)), "#9fb4ff");
      }
      ctx.globalAlpha = 1;

      bodies.push({
        depth,
        draw: () => {
          if (p.ring) drawRing(x, y, rad, 0.35, false);
          drawPlanet(p, x, y, rad, t);
          if (p.ring) drawRing(x, y, rad, 0.35, true);
          if (p.moon) {
            const ma = t * 2.2 + p.seed, mr = rad + 4 * S;
            const mx = Math.round(x + Math.cos(ma) * mr), my = Math.round(y + Math.sin(ma) * mr * 0.5);
            if (Math.sin(ma) > 0 || Math.hypot(mx - x, my - y) > rad) {
              px(mx, my, "#d8d8e8"); px(mx + 1, my, "#a0a0b8"); px(mx, my + 1, "#a0a0b8"); px(mx + 1, my + 1, "#70708a");
            }
          }
        },
      });
    }
    bodies.sort((a, b) => a.depth - b.depth).forEach((b) => b.draw());

    if (!popped && t > 3.1) { popped = true; document.getElementById("intro").classList.add("ready"); }
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      ctx.imageSmoothingEnabled = false;
      resize();
      addEventListener("resize", resize);
      start = performance.now(); popped = false;
      document.getElementById("intro").classList.remove("ready");
      raf = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(raf); removeEventListener("resize", resize); },
  };
})();
