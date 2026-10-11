/*
  GATEWAY sound effects. Every sound is made live with the Web Audio API,
  so there are no audio files to load or license.

  Sounds are triggered by watching the page (clicks and changes on screen),
  so game.js doesn't need to know about them. ending.js calls Sfx.play() directly.
  The 🔊 button in the top-right corner mutes everything (remembered between visits).
*/
window.Sfx = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem("gateway-muted") === "1"; } catch (e) {}
  const VOLUME = 0.5;

  // Browsers only allow audio after the player clicks something, so the audio engine starts on first use.
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // A single synth note: square/triangle/sine/sawtooth wave, optionally sliding in pitch.
  function tone({ freq = 440, to = null, type = "square", dur = 0.1, vol = 0.3, delay = 0 }) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Filtered static: thuds, whooshes, engines and explosions.
  function noise({ dur = 0.2, vol = 0.3, delay = 0, filter = "lowpass", freq = 1000, to = null, q = 1 }) {
    const c = audio(); if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    f.type = filter; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  const notes = (list, opts) => list.forEach((f, i) => tone(Object.assign({ freq: f, delay: i * (opts.gap || 0.08) }, opts)));

  const SOUNDS = {
    // menus
    chime:   () => notes([523, 659, 784, 1047], { type: "triangle", dur: 0.25, vol: 0.25 }),
    gate:    () => { noise({ dur: 0.6, vol: 0.25, filter: "bandpass", freq: 300, to: 2000, q: 0.7 }); tone({ freq: 220, to: 440, type: "sawtooth", dur: 0.4, vol: 0.06 }); },
    click:   () => tone({ freq: 700, type: "square", dur: 0.03, vol: 0.06 }),
    // security desk
    arrive:  () => { tone({ freq: 880, dur: 0.08, vol: 0.1 }); tone({ freq: 1320, dur: 0.1, vol: 0.1, delay: 0.1 }); },
    pick:    () => tone({ freq: 300, to: 600, type: "triangle", dur: 0.08, vol: 0.2 }),
    drop:    () => tone({ freq: 500, to: 250, type: "triangle", dur: 0.08, vol: 0.15 }),
    // "ka-CHUNK": a sharp click, a mid-range thump laptop speakers can play, and a little bass for headphones
    stamp:   () => {
      tone({ freq: 1400, to: 500, type: "square", dur: 0.035, vol: 0.25 });
      noise({ dur: 0.09, vol: 0.7, filter: "bandpass", freq: 1800, q: 0.8 });
      tone({ freq: 330, to: 110, type: "triangle", dur: 0.16, vol: 0.7, delay: 0.015 });
      noise({ dur: 0.18, vol: 0.5, freq: 600, delay: 0.015 });
      tone({ freq: 120, to: 50, type: "sine", dur: 0.22, vol: 0.5, delay: 0.015 });
    },
    nope:    () => { tone({ freq: 200, dur: 0.09, vol: 0.1 }); tone({ freq: 150, dur: 0.12, vol: 0.1, delay: 0.1 }); },
    creak:   () => { tone({ freq: 180, to: 420, type: "sawtooth", dur: 0.35, vol: 0.05 }); noise({ dur: 0.3, vol: 0.12, filter: "bandpass", freq: 900, q: 3 }); },
    pop:     (i = 0) => tone({ freq: 500 + i * 120, to: 900 + i * 120, type: "sine", dur: 0.09, vol: 0.2, delay: 0.25 + i * 0.15 }),
    scan:    () => tone({ freq: 600, to: 1800, type: "sine", dur: 0.35, vol: 0.12 }),
    tick:    () => tone({ freq: 1200, dur: 0.04, vol: 0.07 }),
    flag:    () => tone({ freq: 300, dur: 0.06, vol: 0.09 }),
    blip:    () => tone({ freq: 900, type: "triangle", dur: 0.05, vol: 0.12 }),
    decoded: () => notes([784, 988, 1319], { type: "triangle", dur: 0.18, vol: 0.2, gap: 0.07 }),
    correct: () => notes([523, 659, 784, 1047], { type: "square", dur: 0.14, vol: 0.1, gap: 0.09 }),
    wrong:   () => { tone({ freq: 330, to: 300, type: "sawtooth", dur: 0.25, vol: 0.13 }); tone({ freq: 247, to: 220, type: "sawtooth", dur: 0.4, vol: 0.13, delay: 0.22 }); },
    // endings
    launch:  () => { noise({ dur: 2.4, vol: 0.35, freq: 200, to: 900 }); tone({ freq: 60, to: 120, type: "sawtooth", dur: 2.2, vol: 0.1 }); },
    land:    () => noise({ dur: 0.5, vol: 0.3, freq: 400, to: 100 }),
    fanfare: () => notes([392, 523, 659, 784, 659, 784, 1047], { type: "square", dur: 0.18, vol: 0.09, gap: 0.13 }),
    alarm:   () => [0, 1, 2].forEach((i) => tone({ freq: 880, to: 660, dur: 0.25, vol: 0.06, delay: i * 0.3 })),
    zap:     () => tone({ freq: 1800, to: 300, type: "sawtooth", dur: 0.15, vol: 0.05 }),
    sputter: () => { for (let i = 0; i < 5; i++) noise({ dur: 0.08, vol: 0.25, freq: 300, delay: i * 0.14 }); },
    // BIG crash explosion, built in layers so it sounds huge even on laptop speakers
    boom:    () => {
      noise({ dur: 0.25, vol: 1.0, filter: "highpass", freq: 2500 });                  // sharp CRACK
      noise({ dur: 0.6, vol: 1.0, filter: "bandpass", freq: 900, to: 200, q: 0.6 });  // punchy blast
      tone({ freq: 220, to: 55, type: "sawtooth", dur: 0.9, vol: 0.35 });             // growl small speakers can play
      tone({ freq: 110, to: 28, type: "sine", dur: 1.8, vol: 0.9 });                  // deep BOOM for headphones
      noise({ dur: 3.2, vol: 0.8, freq: 1400, to: 40, delay: 0.05 });                 // long rolling rumble
      for (let i = 0; i < 9; i++) noise({ dur: 0.07, vol: 0.45, filter: "bandpass", freq: 1500 + Math.random() * 2500, q: 2, delay: 0.35 + Math.random() * 1.6 }); // debris crackles
      tone({ freq: 70, to: 30, type: "sine", dur: 1.2, vol: 0.6, delay: 0.5 });       // aftershock thump
    },
  };

  function play(name, ...args) {
    if (muted || !SOUNDS[name]) return;
    try { SOUNDS[name](...args); } catch (e) { /* never let a sound break the game */ }
  }

  /* ---------- mute button ---------- */
  const btn = document.createElement("button");
  btn.className = "mute-btn";
  btn.type = "button";
  const paint = () => { btn.textContent = muted ? "🔇" : "🔊"; btn.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off"); };
  btn.onclick = (e) => {
    e.stopPropagation();
    muted = !muted;
    try { localStorage.setItem("gateway-muted", muted ? "1" : "0"); } catch (err) {}
    if (master) master.gain.value = muted ? 0 : VOLUME;
    paint();
    if (!muted) play("click");
  };
  paint();
  document.body.appendChild(btn);

  /* ---------- listen to the game ---------- */
  const $ = (s) => document.querySelector(s);

  // Clicks (capture phase, so we can see the state *before* the game reacts).
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.closest) return;
    if (t.closest("#welcome-btn")) play("chime");
    else if (t.closest("#start-btn, #again-btn")) play("gate");
    else if (t.closest(".rubber")) play(t.closest(".rubber").classList.contains("lifted") ? "drop" : "pick");
    else if (t.closest("#glass-btn")) play(t.closest("#glass-btn").classList.contains("lifted") ? "drop" : "pick");
    else if (t.closest(".mark")) play(t.closest(".mark").classList.contains("ok") ? "tick" : "flag");
    else if (t.closest("#open-chest")) {
      play("creak");
      setTimeout(() => document.querySelectorAll(".plate-item").forEach((_, i) => play("pop", i)), 0);
    }
    else if (t.closest(".plate-item")) play(document.body.classList.contains("holding-glass") ? "scan" : "nope");
    else if (t.closest(".tabs button, #next-btn, .pop-close")) play("click");
  }, true);

  // Decoder letters: after the game marks a letter right or wrong.
  document.addEventListener("keydown", (e) => {
    const slot = e.target.closest && e.target.closest(".slot");
    if (!slot || !/^[a-z]$/i.test(e.key)) return;
    setTimeout(() => {
      if ($("#decode-out") && $("#decode-out").classList.contains("good")) play("decoded");
      else play(slot.classList.contains("good") ? "blip" : "nope");
    }, 0);
  });

  const watch = (sel, opts, fn) => { const el = $(sel); if (el) new MutationObserver(fn).observe(el, opts); };
  // A new traveler steps into the scanner.
  watch("#traveler", { childList: true }, () => play("arrive"));
  // Ink lands on the passport, or the STAMP box shakes because you missed it.
  watch("#passport", { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }, (list) => {
    const stamped = list.some((m) => m.type === "childList" && [...m.addedNodes].some((n) => n.classList && n.classList.contains("ink")));
    const missed = list.some((m) => m.type === "attributes" && m.target.id === "stamp-zone" && m.target.classList.contains("nudge"));
    if (stamped) play("stamp");
    else if (missed) play("nope");
  });
  // The verdict pops up: right or wrong call.
  watch("#verdict", { attributes: true, attributeFilter: ["hidden"] }, () => {
    if ($("#verdict").hidden) return;
    play($("#verdict-card .verdict-top.good") ? "correct" : "wrong");
  });

  return { play };
})();
