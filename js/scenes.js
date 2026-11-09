/* Процедурные анимированные сцены для буктрейлеров и фона */
window.Scenes = (function () {
  const SKY = {
    night: ['#04060f', '#0d1533', '#26244c'], dusk: ['#1b1440', '#7a3b5c', '#ec8f50'],
    day: ['#2a76b8', '#7fc3e8', '#efe6c6'], dawn: ['#1d2b55', '#b46a7a', '#f7c784'],
    storm: ['#14171f', '#353b4a', '#5f6675'], winter: ['#41506d', '#8e9db6', '#d8e0eb'],
    space: ['#000003', '#03051a', '#0a0f33']
  };
  const SIL = { night: '#05060c', dusk: '#1a0f22', day: '#3c3a2c', dawn: '#1c1630', storm: '#0d0f15', winter: '#3c4659', space: '#000' };
  const GROUND = { night: ['#0b1020', '#05070d'], dusk: ['#3b2433', '#140b16'], day: ['#a8a05a', '#6f6a35'], dawn: ['#4c3a48', '#1c1626'], storm: ['#2a2d33', '#121418'], winter: ['#e5ebf3', '#b5c0d0'], space: ['#000', '#000'] };
  function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const HZ = 0.72;

  function draw(c, W, H, els, t, sc) {
    let sky = 'night';
    els.forEach(e => { if (e.startsWith('sky:')) sky = e.slice(4); });
    const st = { sky, sil: SIL[sky] || '#05060c', g: GROUND[sky] || GROUND.night, W, H, t, k: W / 1280 };
    c.save();
    if (sc) { c.translate(W / 2, H / 2); c.scale(sc, sc); c.translate(-W / 2, -H / 2); }
    els.forEach(e => { const f = F[e.startsWith('sky:') ? 'sky' : e]; if (f) f(c, st); });
    c.restore();
    // vignette
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }
  const lin = (c, y0, y1, cols) => { const g = c.createLinearGradient(0, y0, 0, y1); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g; };

  const F = {
    sky(c, s) { c.fillStyle = lin(c, 0, s.H * HZ, SKY[s.sky] || SKY.night); c.fillRect(-s.W, -s.H, s.W * 3, s.H * 3); },
    stars(c, s) {
      const r = rnd(7); c.fillStyle = '#fff';
      for (let i = 0; i < 220; i++) {
        const x = r() * s.W, y = r() * s.H * 0.7, z = r();
        c.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(s.t * (0.5 + z * 2) + i))) * (s.sky === 'space' ? 1 : 0.8);
        c.fillRect(x, y, z * 2 * s.k + 0.6, z * 2 * s.k + 0.6);
      }
      c.globalAlpha = 1;
    },
    moon(c, s) {
      const x = s.W * 0.8, y = s.H * 0.2, R = 38 * s.k;
      const g = c.createRadialGradient(x, y, R * 0.5, x, y, R * 5); g.addColorStop(0, 'rgba(255,240,200,.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.fillRect(x - R * 5, y - R * 5, R * 10, R * 10);
      c.fillStyle = '#fbf2d5'; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
      c.fillStyle = 'rgba(180,170,140,.35)'; c.beginPath(); c.arc(x - R * .3, y - R * .2, R * .22, 0, 7); c.arc(x + R * .25, y + R * .3, R * .15, 0, 7); c.fill();
    },
    sun(c, s) {
      const low = s.sky === 'dawn' || s.sky === 'dusk';
      const x = s.W * (low ? 0.3 : 0.75), y = s.H * (low ? 0.62 : 0.18) - (low ? Math.sin(s.t * 0.15) * 10 * s.k : 0), R = (low ? 70 : 46) * s.k;
      const g = c.createRadialGradient(x, y, 0, x, y, R * 6); g.addColorStop(0, low ? 'rgba(255,190,110,.7)' : 'rgba(255,250,220,.7)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = g; c.fillRect(x - R * 6, y - R * 6, R * 12, R * 12);
      c.fillStyle = low ? '#ffd08a' : '#fffbe8'; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
    },
    mountains(c, s) {
      const layer = (base, amp, col, seed, speed, snow) => {
        const r = rnd(seed), pts = []; const off = (s.t * speed * s.k) % (s.W);
        for (let x = -200; x <= s.W + 400; x += 90 * s.k) pts.push([x - off * 0, base - r() * amp]);
        c.fillStyle = col; c.beginPath(); c.moveTo(-200, s.H);
        pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(s.W + 400, s.H); c.fill();
        if (snow) { c.fillStyle = 'rgba(255,255,255,.75)'; pts.forEach((p, i) => { if (p[1] < base - amp * 0.62 && pts[i + 1]) { c.beginPath(); c.moveTo(p[0] - 22 * s.k, p[1] + 20 * s.k); c.lineTo(p[0], p[1]); c.lineTo(p[0] + 24 * s.k, p[1] + 22 * s.k); c.fill(); } }); }
      };
      const H = s.H;
      layer(H * 0.62, H * 0.32, s.sky === 'day' ? '#6f86a8' : s.sky === 'winter' ? '#8a9ab4' : 'rgba(40,46,80,.95)', 3, 2, true);
      layer(H * 0.7, H * 0.16, s.sky === 'day' ? '#4f6584' : s.sil, 11, 5, false);
    },
    hills(c, s) {
      const H = s.H, W = s.W;
      [[0.66, 30, s.sky === 'winter' ? '#c6d0de' : 'rgba(30,30,50,.8)', 0.004], [0.72, 22, s.sky === 'winter' ? '#e6ecf4' : s.sil, 0.007]].forEach(([b, a, col, f], i) => {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) c.lineTo(x, H * b - Math.sin(x * f / s.k + i * 2) * a * s.k - Math.sin(x * f * 2.3 / s.k) * a * 0.5 * s.k);
        c.lineTo(W, H); c.fill();
      });
    },
    steppe(c, s) {
      const H = s.H, W = s.W, y0 = H * HZ;
      c.fillStyle = lin(c, y0, H, s.g); c.fillRect(-W, y0, W * 3, H);
      const r = rnd(5); c.lineWidth = 1.4 * s.k;
      for (let i = 0; i < 380; i++) {
        const x = r() * W, d = r(), y = y0 + d * d * (H - y0) + 4, h = (8 + d * 34) * s.k;
        const sway = Math.sin(s.t * 1.8 + x * 0.01) * h * 0.35;
        c.strokeStyle = s.sky === 'day' ? `rgba(70,64,25,${0.4 + d * 0.5})` : s.sky === 'winter' ? `rgba(150,160,180,${0.3 + d * 0.4})` : `rgba(210,180,120,${0.08 + d * 0.25})`;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sway * 0.5, y - h * 0.6, x + sway, y - h); c.stroke();
      }
    },
    desert(c, s) {
      const H = s.H, W = s.W;
      [[0.7, '#c99a5b', 0.006, 26], [0.8, '#a9773e', 0.004, 34], [0.9, '#7a5428', 0.003, 30]].forEach(([b, col, f, a], i) => {
        c.fillStyle = s.sky === 'storm' ? '#3b3026' : col; c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) c.lineTo(x, H * b - Math.sin(x * f / s.k + i + s.t * 0.05) * a * s.k);
        c.lineTo(W, H); c.fill();
      });
    },
    snow(c, s) {
      const r = rnd(9); c.fillStyle = '#fff';
      for (let i = 0; i < 260; i++) {
        const sp = 20 + r() * 50, x = (r() * s.W + Math.sin(s.t + i) * 20 + s.t * 15) % s.W, y = (r() * s.H + s.t * sp * s.k) % s.H, z = r();
        c.globalAlpha = 0.4 + z * 0.6; c.beginPath(); c.arc(x, y, (1 + z * 2.4) * s.k, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    },
    blizzard(c, s) {
      c.fillStyle = 'rgba(220,230,245,.18)'; c.fillRect(0, 0, s.W, s.H);
      const r = rnd(13); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5 * s.k;
      for (let i = 0; i < 300; i++) {
        const sp = 300 + r() * 500, x = (r() * s.W * 1.5 - s.t * sp * s.k) % (s.W * 1.5) + s.W * 0.5, y = (r() * s.H + s.t * 120 * s.k) % s.H;
        const xx = ((x % s.W) + s.W) % s.W;
        c.globalAlpha = 0.3 + r() * 0.6; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + 26 * s.k, y - 8 * s.k); c.stroke();
      }
      c.globalAlpha = 1;
    },
    fortress(c, s) {
      const H = s.H, W = s.W, y = H * HZ + 4, x0 = W * 0.48, w = W * 0.42, k = s.k;
      c.fillStyle = s.sil;
      c.fillRect(x0 - w / 2, y - 70 * k, w, 74 * k);
      for (let i = 0; i < 18; i++) c.fillRect(x0 - w / 2 + i * w / 18, y - 84 * k, w / 36, 16 * k);
      [[-w / 2, 1.5], [w / 2, 1.5], [0, 2]].forEach(([dx, hm]) => {
        c.fillRect(x0 + dx - 22 * k, y - 70 * k * hm - 30 * k, 44 * k, 70 * k * hm + 34 * k);
        c.beginPath(); c.moveTo(x0 + dx - 30 * k, y - 70 * k * hm - 30 * k); c.lineTo(x0 + dx, y - 70 * k * hm - 80 * k); c.lineTo(x0 + dx + 30 * k, y - 70 * k * hm - 30 * k); c.fill();
      });
      c.fillStyle = 'rgba(255,190,90,' + (0.5 + 0.3 * Math.sin(s.t * 3)) + ')';
      [[-0.3, 40], [0.12, 46], [0.35, 38]].forEach(([fx, h]) => c.fillRect(x0 + w * fx, y - h * k, 7 * k, 10 * k));
    },
    city(c, s) {
      const H = s.H, W = s.W, y = H * HZ + 6, k = s.k; c.fillStyle = s.sil;
      const r = rnd(21);
      for (let x = W * 0.05; x < W * 0.95; x += 70 * k) {
        const h = (30 + r() * 60) * k, w = (50 + r() * 30) * k;
        c.fillRect(x, y - h, w, h);
        if (r() > 0.5) { c.beginPath(); c.arc(x + w / 2, y - h, w * 0.38, Math.PI, 0); c.fill(); c.fillRect(x + w / 2 - 1.5 * k, y - h - w * 0.38 - 14 * k, 3 * k, 14 * k); }
        if (r() > 0.75) { c.fillRect(x + w + 4 * k, y - h - 80 * k, 12 * k, h + 80 * k); c.beginPath(); c.arc(x + w + 10 * k, y - h - 80 * k, 9 * k, Math.PI, 0); c.fill(); }
        c.fillStyle = 'rgba(255,200,110,.75)';
        for (let j = 0; j < 3; j++) if (r() > 0.4) c.fillRect(x + 8 * k + j * 14 * k, y - h * 0.6, 5 * k, 7 * k);
        c.fillStyle = s.sil;
      }
      c.fillRect(0, y - 2, W, H - y + 2);
    },
    cathedral(c, s) {
      const H = s.H, x = s.W * 0.62, y = H * HZ + 6, k = s.k; c.fillStyle = s.sil;
      c.fillRect(x - 110 * k, y - 120 * k, 220 * k, 120 * k);
      c.fillRect(x - 40 * k, y - 200 * k, 80 * k, 200 * k);
      c.beginPath(); c.moveTo(x - 46 * k, y - 200 * k); c.lineTo(x, y - 320 * k); c.lineTo(x + 46 * k, y - 200 * k); c.fill();
      [[-80, 120], [80, 120], [0, 320]].forEach(([dx, h]) => {
        c.beginPath(); c.ellipse(x + dx * k, y - h * k - 18 * k, 18 * k, 24 * k, 0, 0, 7); c.fill();
        c.fillRect(x + dx * k - 1.5 * k, y - h * k - 62 * k, 3 * k, 22 * k); c.fillRect(x + dx * k - 8 * k, y - h * k - 54 * k, 16 * k, 3 * k);
      });
      c.fillStyle = 'rgba(255,210,140,.6)'; for (let i = -2; i <= 2; i++) c.fillRect(x + i * 36 * k - 5 * k, y - 80 * k, 10 * k, 26 * k);
    },
    poplars(c, s) {
      const H = s.H, y = H * HZ + 8, k = s.k, r = rnd(31); c.fillStyle = s.sky === 'day' ? '#2f4a2c' : s.sil;
      for (let i = 0; i < 14; i++) {
        const x = (i / 14) * s.W + r() * 40 * k, h = (150 + r() * 110) * k, sw = Math.sin(s.t * 1.2 + i) * 6 * k;
        c.beginPath(); c.moveTo(x - 14 * k, y); c.quadraticCurveTo(x - 22 * k + sw, y - h * 0.5, x + sw, y - h); c.quadraticCurveTo(x + 22 * k + sw, y - h * 0.5, x + 14 * k, y); c.fill();
      }
    },
    village(c, s) {
      const H = s.H, y = H * HZ + 6, k = s.k, r = rnd(41);
      for (let i = 0; i < 7; i++) {
        const x = s.W * 0.1 + i * s.W * 0.12 + r() * 30 * k, w = (60 + r() * 30) * k, h = (40 + r() * 16) * k;
        c.fillStyle = s.sil; c.fillRect(x, y - h, w, h);
        c.beginPath(); c.moveTo(x - 8 * k, y - h); c.lineTo(x + w / 2, y - h - 34 * k); c.lineTo(x + w + 8 * k, y - h); c.fill();
        c.fillStyle = 'rgba(255,190,100,' + (0.55 + 0.25 * Math.sin(s.t * 2 + i)) + ')'; c.fillRect(x + w * 0.35, y - h * 0.65, 12 * k, 12 * k);
        // smoke
        c.fillStyle = 'rgba(200,200,210,.12)';
        for (let j = 0; j < 5; j++) { const p = (s.t * 0.3 + j / 5) % 1; c.beginPath(); c.arc(x + w * 0.75 + p * 30 * k, y - h - 30 * k - p * 90 * k, (6 + p * 16) * k, 0, 7); c.fill(); }
      }
    },
    yurt(c, s) {
      const H = s.H, y = H * HZ + 10, k = s.k;
      [[0.18, 1], [0.32, 0.75], [0.84, 0.9]].forEach(([fx, sz]) => {
        const x = s.W * fx, w = 120 * k * sz, h = 50 * k * sz;
        c.fillStyle = s.sky === 'day' ? '#e9e1cf' : s.sil;
        c.fillRect(x - w / 2, y - h, w, h);
        c.beginPath(); c.moveTo(x - w / 2 - 4 * k, y - h); c.quadraticCurveTo(x, y - h - 62 * k * sz, x + w / 2 + 4 * k, y - h); c.fill();
        c.fillStyle = s.sky === 'day' ? '#b2452f' : 'rgba(255,170,80,.75)'; c.fillRect(x - 10 * k * sz, y - 34 * k * sz, 20 * k * sz, 34 * k * sz);
        if (s.sky === 'day') { c.strokeStyle = '#b2452f'; c.lineWidth = 3 * k * sz; c.beginPath(); c.moveTo(x - w / 2, y - h * 0.55); c.lineTo(x + w / 2, y - h * 0.55); c.stroke(); }
      });
    },
    rider(c, s) {
      const k = s.k, H = s.H, ph = s.t * 9, x = ((s.t * 140 * k) % (s.W + 400 * k)) - 200 * k, y = H * HZ + 30 * k - Math.abs(Math.sin(ph)) * 8 * k;
      c.save(); c.translate(x, y); c.scale(k * 1.3, k * 1.3); c.fillStyle = s.sil; c.strokeStyle = s.sil; c.lineCap = 'round';
      c.beginPath(); c.ellipse(0, -40, 42, 17, -0.05, 0, 7); c.fill();
      c.beginPath(); c.moveTo(30, -50); c.lineTo(52, -82); c.lineTo(70, -78); c.lineTo(58, -64); c.lineTo(40, -36); c.fill();
      c.beginPath(); c.moveTo(-40, -46); c.quadraticCurveTo(-66, -40 + Math.sin(ph) * 8, -70, -18); c.lineWidth = 6; c.stroke();
      c.lineWidth = 6;
      [[-26, 0], [-18, 1.6], [24, 3.1], [32, 4.7]].forEach(([lx, o]) => { const a = Math.sin(ph + o) * 0.7; c.beginPath(); c.moveTo(lx, -30); c.lineTo(lx + Math.sin(a) * 26, -30 + Math.cos(a) * 26); c.lineTo(lx + Math.sin(a * 1.6) * 30, -2); c.stroke(); });
      c.lineWidth = 9; c.beginPath(); c.moveTo(0, -56); c.lineTo(6, -94); c.stroke();
      c.beginPath(); c.arc(8, -104, 9, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-2, -114); c.lineTo(8, -126); c.lineTo(18, -112); c.fill();
      c.lineWidth = 3; c.beginPath(); c.moveTo(-10, -80); c.lineTo(60, -130); c.stroke();
      c.restore();
    },
    walker(c, s) {
      const k = s.k, H = s.H, ph = s.t * 3.2, x = s.W * 0.2 + ((s.t * 26 * k) % (s.W * 0.6)), y = H * HZ + 50 * k;
      c.save(); c.translate(x, y); c.scale(k * 1.5, k * 1.5); c.fillStyle = s.sil; c.strokeStyle = s.sil; c.lineCap = 'round'; c.lineWidth = 7;
      [0, Math.PI].forEach(o => { const a = Math.sin(ph + o) * 0.45; c.beginPath(); c.moveTo(0, -48); c.lineTo(Math.sin(a) * 30, -48 + Math.cos(a) * 30 + 18); c.stroke(); });
      c.beginPath(); c.moveTo(-14, -48); c.lineTo(-10, -100); c.lineTo(12, -100); c.lineTo(16, -48); c.fill();
      [0, Math.PI].forEach(o => { const a = Math.sin(ph + o + Math.PI) * 0.4; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -96); c.lineTo(Math.sin(a) * 34, -96 + Math.cos(a) * 34); c.stroke(); });
      c.beginPath(); c.arc(1, -112, 11, 0, 7); c.fill();
      c.fillRect(-12, -126, 26, 6);
      c.restore();
    },
    caravan(c, s) {
      const k = s.k, H = s.H, base = ((s.t * 40 * k) % (s.W + 600 * k)) - 400 * k;
      for (let i = 0; i < 4; i++) {
        const ph = s.t * 4 + i * 1.3, x = base - i * 150 * k, y = H * HZ + 34 * k + i * 2 * k;
        c.save(); c.translate(x, y); c.scale(k * 1.2, k * 1.2); c.fillStyle = s.sil; c.strokeStyle = s.sil; c.lineCap = 'round'; c.lineWidth = 6;
        c.beginPath(); c.ellipse(0, -60, 44, 20, 0, 0, 7); c.fill();
        c.beginPath(); c.ellipse(-12, -80, 16, 18, 0, Math.PI, 0); c.fill(); c.beginPath(); c.ellipse(16, -78, 14, 15, 0, Math.PI, 0); c.fill();
        c.lineWidth = 10; c.beginPath(); c.moveTo(38, -64); c.quadraticCurveTo(66, -60, 64, -100); c.stroke();
        c.beginPath(); c.ellipse(72, -104, 14, 7, 0.2, 0, 7); c.fill();
        c.lineWidth = 6;
        [[-28, 0], [-18, Math.PI], [24, Math.PI / 2], [34, Math.PI * 1.5]].forEach(([lx, o]) => { const a = Math.sin(ph + o) * 0.35; c.beginPath(); c.moveTo(lx, -50); c.lineTo(lx + Math.sin(a) * 50, -2); c.stroke(); });
        if (i === 1) { c.beginPath(); c.arc(-2, -100, 9, 0, 7); c.fill(); c.fillRect(-12, -96, 22, 22); }
        c.restore();
      }
    },
    fire(c, s) {
      const H = s.H, W = s.W, k = s.k;
      const g = lin(c, H * 0.4, H, ['rgba(255,80,20,0)', 'rgba(255,90,20,.35)', 'rgba(255,140,40,.7)']); c.fillStyle = g; c.fillRect(0, H * 0.4, W, H * 0.6);
      for (let i = 0; i < 40; i++) {
        const x = (i / 40) * W + Math.sin(i * 7) * 20 * k, h = (60 + Math.abs(Math.sin(s.t * 3 + i * 1.7)) * 120) * k;
        const fg = c.createLinearGradient(0, H, 0, H - h); fg.addColorStop(0, 'rgba(255,220,120,.9)'); fg.addColorStop(0.5, 'rgba(255,110,30,.7)'); fg.addColorStop(1, 'rgba(160,20,10,0)');
        c.fillStyle = fg; c.beginPath(); c.moveTo(x - 30 * k, H); c.quadraticCurveTo(x - 20 * k + Math.sin(s.t * 5 + i) * 10 * k, H - h * 0.6, x, H - h); c.quadraticCurveTo(x + 22 * k, H - h * 0.5, x + 30 * k, H); c.fill();
      }
      const r = rnd(77); c.fillStyle = '#ffc070';
      for (let i = 0; i < 90; i++) { const sp = 40 + r() * 80, x = r() * W + Math.sin(s.t + i) * 30 * k, y = H - ((s.t * sp * k + r() * H) % H); c.globalAlpha = r(); c.fillRect(x, y, 3 * k, 3 * k); }
      c.globalAlpha = 1;
    },
    candle(c, s) {
      const W = s.W, H = s.H, k = s.k, fl = Math.sin(s.t * 13) * 0.08 + Math.sin(s.t * 7.3) * 0.06;
      c.fillStyle = '#0a0705'; c.fillRect(0, 0, W, H);
      const cx = W * 0.62, cy = H * 0.42;
      const glow = c.createRadialGradient(cx, cy, 0, cx, cy, H * (0.75 + fl)); glow.addColorStop(0, 'rgba(255,190,100,.55)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = glow; c.fillRect(0, 0, W, H);
      c.fillStyle = '#3a2213'; c.fillRect(0, H * 0.66, W, H * 0.34);
      c.fillStyle = 'rgba(255,170,80,.12)'; c.fillRect(0, H * 0.66, W, 4 * k);
      // book
      c.save(); c.translate(W * 0.36, H * 0.72); c.fillStyle = '#efe2bf';
      c.beginPath(); c.moveTo(-220 * k, 0); c.quadraticCurveTo(-110 * k, -24 * k, 0, 0); c.lineTo(0, 120 * k); c.quadraticCurveTo(-110 * k, 96 * k, -220 * k, 120 * k); c.fill();
      c.fillStyle = '#e6d6ae'; c.beginPath(); c.moveTo(220 * k, 0); c.quadraticCurveTo(110 * k, -24 * k, 0, 0); c.lineTo(0, 120 * k); c.quadraticCurveTo(110 * k, 96 * k, 220 * k, 120 * k); c.fill();
      c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 2 * k;
      const lines = Math.min(7, Math.floor(s.t * 1.5));
      for (let i = 0; i < 7; i++) { const yy = 14 * k + i * 13 * k; c.beginPath(); c.moveTo(-200 * k, yy); c.lineTo(-30 * k, yy); c.stroke(); if (i < lines) { c.beginPath(); c.moveTo(30 * k, yy); c.lineTo(30 * k + (i === lines - 1 ? ((s.t * 1.5) % 1) : 1) * 170 * k, yy); c.stroke(); } }
      c.restore();
      // quill
      c.save(); c.translate(W * 0.5 + Math.sin(s.t * 6) * 10 * k, H * 0.66); c.rotate(-0.6); c.fillStyle = '#f2efe6';
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(20 * k, -90 * k, 6 * k, -180 * k); c.quadraticCurveTo(-24 * k, -90 * k, 0, 0); c.fill(); c.restore();
      // candle
      c.fillStyle = '#efe6d0'; c.fillRect(cx - 18 * k, cy + 30 * k, 36 * k, H * 0.66 - cy - 30 * k);
      c.fillStyle = '#c6a24a'; c.fillRect(cx - 40 * k, H * 0.64, 80 * k, 10 * k);
      const fh = 50 * k * (1 + fl);
      const fg = c.createRadialGradient(cx, cy + 10 * k, 0, cx, cy, fh); fg.addColorStop(0, '#fffbe0'); fg.addColorStop(0.4, '#ffd27a'); fg.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = fg; c.beginPath(); c.moveTo(cx - 12 * k, cy + 28 * k); c.quadraticCurveTo(cx - 14 * k, cy, cx + fl * 30 * k, cy + 28 * k - fh); c.quadraticCurveTo(cx + 14 * k, cy, cx + 12 * k, cy + 28 * k); c.fill();
    },
    sea(c, s) {
      const H = s.H, W = s.W, k = s.k, y0 = H * 0.74;
      c.fillStyle = lin(c, y0, H, s.sky === 'dusk' ? ['#4a3a63', '#1a1530'] : ['#1f4e6e', '#0b2236']); c.fillRect(0, y0, W, H - y0);
      c.strokeStyle = 'rgba(255,220,180,.25)'; c.lineWidth = 2 * k;
      for (let j = 0; j < 12; j++) { const y = y0 + j * j * 1.6 * k + 6; c.beginPath(); for (let x = 0; x <= W; x += 16) c.lineTo(x, y + Math.sin(x * 0.02 / k + s.t * 2 + j) * (2 + j * 0.4) * k); c.stroke(); }
    },
    saltlake(c, s) {
      const H = s.H, W = s.W, k = s.k;
      const g = c.createRadialGradient(W * 0.55, H * 0.8, 10, W * 0.55, H * 0.8, W * 0.4); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.7, 'rgba(235,240,245,.7)'); g.addColorStop(1, 'rgba(235,240,245,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(W * 0.55, H * 0.8, W * 0.4, 46 * k, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)'; const r = rnd(3);
      for (let i = 0; i < 40; i++) { const a = Math.abs(Math.sin(s.t * 2 + i)); c.globalAlpha = a; c.fillRect(W * 0.2 + r() * W * 0.7, H * 0.76 + r() * 50 * k, 3 * k, 3 * k); }
      c.globalAlpha = 1;
    },
    wire(c, s) {
      const H = s.H, W = s.W, k = s.k; c.strokeStyle = s.sky === 'winter' ? '#2b3445' : '#111'; c.fillStyle = c.strokeStyle;
      for (let x = -20; x < W + 100; x += 170 * k) { c.fillRect(x, H * 0.48, 9 * k, H * 0.52); c.fillRect(x - 10 * k, H * 0.47, 30 * k, 6 * k); }
      c.lineWidth = 2 * k;
      for (let j = 0; j < 6; j++) {
        const y = H * 0.5 + j * 34 * k; c.beginPath();
        for (let x = 0; x <= W; x += 170 * k) { c.moveTo(x, y); c.quadraticCurveTo(x + 85 * k, y + 10 * k, x + 170 * k, y); } c.stroke();
        for (let x = 20 * k; x < W; x += 34 * k) { c.beginPath(); c.moveTo(x - 6 * k, y - 5 * k); c.lineTo(x + 6 * k, y + 7 * k); c.moveTo(x + 6 * k, y - 5 * k); c.lineTo(x - 6 * k, y + 7 * k); c.stroke(); }
      }
    },
    wall(c, s) {
      const H = s.H, W = s.W, k = s.k, rows = 9, bw = 64 * k, bh = 26 * k, x0 = W * 0.18, y0 = H * 0.92;
      const built = Math.min(rows * 9, Math.floor(s.t * 6));
      let n = 0;
      for (let r = 0; r < rows; r++) for (let i = 0; i < 9; i++, n++) {
        if (n > built) break;
        c.fillStyle = (r + i) % 3 ? '#7d8796' : '#6c7684'; c.fillRect(x0 + i * bw + (r % 2 ? bw / 2 : 0), y0 - r * bh, bw - 4 * k, bh - 4 * k);
      }
      const r = Math.floor(built / 9), i = built % 9;
      const bx = x0 + i * bw + (r % 2 ? bw / 2 : 0), by = y0 - r * bh;
      c.save(); c.translate(bx + 40 * k, by - 10 * k); c.scale(k * 1.4, k * 1.4); c.fillStyle = '#1b2230'; c.strokeStyle = '#1b2230'; c.lineCap = 'round'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(0, -10); c.lineTo(10, -70); c.stroke(); c.beginPath(); c.arc(14, -84, 11, 0, 7); c.fill();
      c.lineWidth = 5; const a = Math.sin(s.t * 6) * 0.4; c.beginPath(); c.moveTo(8, -62); c.lineTo(-24 + a * 10, -40); c.stroke();
      c.fillRect(4, -100, 22, 8); c.restore();
    },
    rocket(c, s) {
      const H = s.H, W = s.W, k = s.k, space = s.sky === 'space';
      if (space) {
        const g = c.createRadialGradient(W * 0.5, H * 2.2, H * 1.2, W * 0.5, H * 2.2, H * 1.6); g.addColorStop(0, '#2f6fbf'); g.addColorStop(0.92, '#7fc0ff'); g.addColorStop(1, 'rgba(120,190,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(W * 0.5, H * 2.2, H * 1.6, 0, 7); c.fill();
      }
      const p = space ? 0.5 : Math.min(1, s.t / 7), x = space ? W * 0.3 + s.t * 40 * k : W * 0.55, y = space ? H * 0.45 + Math.sin(s.t) * 10 * k : H * 0.68 - p * p * H * 0.7;
      c.save(); c.translate(x, y); if (space) c.rotate(1.2); c.scale(k, k);
      if (!space) { c.fillStyle = 'rgba(230,230,240,.35)'; for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(Math.sin(i * 3 + s.t) * (10 + i * 4), 60 + i * 22, 14 + i * 3, 0, 7); c.fill(); } }
      const fl = 50 + Math.random() * 30; const fg = c.createLinearGradient(0, 40, 0, 40 + fl); fg.addColorStop(0, '#fff6c0'); fg.addColorStop(0.4, '#ffb347'); fg.addColorStop(1, 'rgba(255,80,0,0)');
      c.fillStyle = fg; c.beginPath(); c.moveTo(-14, 40); c.lineTo(0, 40 + fl); c.lineTo(14, 40); c.fill();
      c.fillStyle = '#e9edf2'; c.beginPath(); c.moveTo(0, -80); c.quadraticCurveTo(18, -50, 16, 40); c.lineTo(-16, 40); c.quadraticCurveTo(-18, -50, 0, -80); c.fill();
      c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(-16, 10); c.lineTo(-34, 46); c.lineTo(-16, 40); c.fill(); c.beginPath(); c.moveTo(16, 10); c.lineTo(34, 46); c.lineTo(16, 40); c.fill();
      c.fillStyle = '#2b5d9b'; c.beginPath(); c.arc(0, -30, 7, 0, 7); c.fill();
      c.restore();
      if (!space) { c.fillStyle = s.sil; c.fillRect(W * 0.55 + 40 * k, H * 0.42, 10 * k, H * 0.3); c.fillRect(W * 0.55 + 20 * k, H * 0.5, 30 * k, 6 * k); }
    },
    museum(c, s) {
      const W = s.W, H = s.H, k = s.k;
      c.fillStyle = '#16100c'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(200,160,100,.25)'; c.lineWidth = 14 * k;
      for (let i = 0; i < 3; i++) { const x = W * (0.2 + i * 0.3); c.beginPath(); c.moveTo(x - 120 * k, H); c.lineTo(x - 120 * k, H * 0.35); c.arc(x, H * 0.35, 120 * k, Math.PI, 0); c.lineTo(x + 120 * k, H); c.stroke(); }
      const cone = c.createLinearGradient(0, 0, 0, H); cone.addColorStop(0, 'rgba(255,230,170,.35)'); cone.addColorStop(1, 'rgba(255,230,170,.02)');
      c.fillStyle = cone; c.beginPath(); c.moveTo(W * 0.48, 0); c.lineTo(W * 0.52, 0); c.lineTo(W * 0.64, H * 0.78); c.lineTo(W * 0.36, H * 0.78); c.fill();
      c.fillStyle = '#3a2a1c'; c.fillRect(W * 0.42, H * 0.66, W * 0.16, H * 0.34);
      c.save(); c.translate(W * 0.5, H * 0.66); c.rotate(Math.sin(s.t * 0.5) * 0.02); c.scale(k, k);
      const ag = c.createLinearGradient(-60, 0, 60, 0); ag.addColorStop(0, '#6b3a1e'); ag.addColorStop(0.5, '#c27a44'); ag.addColorStop(1, '#5a2f17');
      c.fillStyle = ag; c.beginPath(); c.moveTo(-18, -190); c.lineTo(18, -190); c.quadraticCurveTo(20, -150, 60, -110); c.quadraticCurveTo(80, -40, 14, 0); c.lineTo(-14, 0); c.quadraticCurveTo(-80, -40, -60, -110); c.quadraticCurveTo(-20, -150, -18, -190); c.fill();
      c.strokeStyle = 'rgba(40,20,10,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-58, -90); c.lineTo(58, -90); c.moveTo(-50, -60); c.lineTo(50, -60); c.stroke();
      c.restore();
      const r = rnd(8); c.fillStyle = 'rgba(255,230,180,.6)';
      for (let i = 0; i < 60; i++) { const x = W * 0.38 + r() * W * 0.24 + Math.sin(s.t * 0.5 + i) * 20 * k, y = (r() * H * 0.8 + s.t * 6 * k) % (H * 0.8); c.globalAlpha = r() * 0.7; c.fillRect(x, y, 2 * k, 2 * k); }
      c.globalAlpha = 1;
    },
    wormwood(c, s) {
      const W = s.W, H = s.H, k = s.k;
      c.fillStyle = lin(c, H * 0.6, H, ['rgba(60,50,40,0)', '#2b2620']); c.fillRect(0, H * 0.6, W, H * 0.4);
      for (let p = 0; p < 9; p++) {
        const bx = W * (0.15 + p * 0.09), sway = Math.sin(s.t * 1.3 + p) * 14 * k;
        c.strokeStyle = '#8fa08a'; c.lineWidth = 3 * k;
        for (let b = 0; b < 6; b++) {
          const h = (180 + b * 30 + p * 10) * k, ang = (b - 2.5) * 0.18;
          c.beginPath(); c.moveTo(bx, H); c.quadraticCurveTo(bx + Math.sin(ang) * h * 0.4, H - h * 0.5, bx + Math.sin(ang) * h * 0.7 + sway, H - h); c.stroke();
          c.fillStyle = 'rgba(190,205,180,.85)';
          for (let l = 0; l < 7; l++) { const tt = 0.4 + l * 0.09, lx = bx + Math.sin(ang) * h * 0.7 * tt + sway * tt, ly = H - h * tt; c.beginPath(); c.ellipse(lx + 8 * k, ly, 9 * k, 3 * k, 0.5, 0, 7); c.ellipse(lx - 8 * k, ly - 4 * k, 9 * k, 3 * k, -0.5, 0, 7); c.fill(); }
        }
      }
      const r = rnd(4); c.fillStyle = 'rgba(230,240,200,.7)';
      for (let i = 0; i < 70; i++) { const x = r() * W + Math.sin(s.t * 0.7 + i) * 40 * k, y = H - ((s.t * (15 + r() * 25) * k + r() * H) % H); c.globalAlpha = 0.2 + r() * 0.5; c.beginPath(); c.arc(x, y, 2 * k, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
  };

  /* --- background loop helper --- */
  function loop(canvas, els, opts) {
    opts = opts || {}; const c = canvas.getContext('2d'); let raf, t0 = performance.now(), visible = true;
    function size() { const d = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.5); canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; }
    size(); window.addEventListener('resize', size);
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(canvas);
    function f(now) { raf = requestAnimationFrame(f); if (!visible || !canvas.width) return; draw(c, canvas.width, canvas.height, els, (now - t0) / 1000 * (opts.speed || 1)); }
    raf = requestAnimationFrame(f);
    return { stop() { cancelAnimationFrame(raf); } };
  }

  /* --- Trailer player --- */
  function Trailer(canvas, capEl, barEl) {
    const c = canvas.getContext('2d'); let raf, seq = [], start = 0, audio = null, playing = false, img = null, lastIdx = -1, onEnd = null, w = null, lang = 'ru';
    function build(writer, lg) {
      w = writer; lang = lg; seq = [];
      img = new Image(); img.src = window.PORTRAITS[writer.id];
      seq.push({ type: 'title', dur: 4 });
      writer.trailer.scenes.forEach((s, i) => {
        const d = Voice.dur(lg, s[lg]);
        seq.push({ type: 'scene', els: s.v, text: s[lg], audio: Voice.src(lg, s[lg]), say: s[lg], lang: lg, dur: Math.max(5.5, (d || s[lg].length / 14) + 1.4) });
      });
      seq.push({ type: 'end', dur: 4.5 });
      lastIdx = -1; capEl.textContent = ''; barEl.style.width = '0';
      drawFrame(0);
    }
    const total = () => seq.reduce((a, s) => a + s.dur, 0);
    function at(t) { let acc = 0; for (let i = 0; i < seq.length; i++) { if (t < acc + seq[i].dur) return [i, t - acc]; acc += seq[i].dur; } return [seq.length - 1, seq[seq.length - 1].dur]; }
    function titleCard(W, H, lt, end) {
      c.fillStyle = '#05060b'; c.fillRect(0, 0, W, H);
      if (img && img.complete && img.naturalWidth) {
        const sc = 1.05 + lt * 0.02, ih = H * 0.9 * sc, iw = ih * img.naturalWidth / img.naturalHeight;
        c.save(); c.globalAlpha = Math.min(1, lt / 1.2) * 0.85; c.drawImage(img, W * (end ? 0.06 : 0.58) - lt * 6, (H - ih) / 2, iw, ih);
        const g = c.createLinearGradient(end ? W * 0.06 + iw * 0.4 : W * 0.58, 0, end ? W * 0.06 + iw : W * 0.58 + iw * 0.6, 0);
        g.addColorStop(end ? 0 : 1, 'rgba(5,6,11,0)'); g.addColorStop(end ? 1 : 0, 'rgba(5,6,11,1)');
        c.globalAlpha = 1; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
      }
      const a = Math.min(1, lt / 1); c.globalAlpha = a; c.fillStyle = '#e3b55b'; c.textAlign = end ? 'right' : 'left';
      const x = end ? W * 0.92 : W * 0.08, k = W / 1280;
      c.font = `600 ${22 * k}px Inter, sans-serif`; c.fillText((end ? T('readBook') : w.name[lang] + ' · ' + w.trailer.year).toUpperCase(), x, H * 0.4);
      c.fillStyle = '#fff'; c.font = `700 ${78 * k}px "Cormorant Garamond", serif`;
      wrap(w.trailer.work[lang], x, H * 0.4 + 90 * k, W * 0.5, 80 * k, end);
      c.globalAlpha = 1; c.textAlign = 'left';
    }
    function wrap(text, x, y, max, lh) { const words = text.split(' '); let line = ''; words.forEach(wd => { const tst = line + wd + ' '; if (c.measureText(tst).width > max && line) { c.fillText(line, x, y); line = wd + ' '; y += lh; } else line = tst; }); c.fillText(line, x, y); }
    function T(k) { return window.I18N[lang][k]; }
    function drawFrame(t) {
      const W = canvas.width, H = canvas.height; const [i, lt] = at(t); const s = seq[i];
      if (s.type === 'scene') {
        Scenes.draw(c, W, H, s.els, lt + i * 3, 1 + lt * 0.012);
        if (lt < 0.8) { c.fillStyle = `rgba(0,0,0,${1 - lt / 0.8})`; c.fillRect(0, 0, W, H); }
        if (lt > s.dur - 0.6) { c.fillStyle = `rgba(0,0,0,${(lt - (s.dur - 0.6)) / 0.6})`; c.fillRect(0, 0, W, H); }
        // letterbox
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H * 0.06); c.fillRect(0, H * 0.94, W, H * 0.06);
        const n = Math.floor(Math.min(1, (lt - 0.3) / Math.max(1, s.dur - 2.2)) * s.text.length);
        capEl.textContent = s.text.slice(0, Math.max(0, n));
      } else { titleCard(W, H, lt, s.type === 'end'); capEl.textContent = ''; if (lt > s.dur - 0.6 && s.type === 'title') { c.fillStyle = `rgba(0,0,0,${(lt - (s.dur - 0.6)) / 0.6})`; c.fillRect(0, 0, W, H); } }
      return i;
    }
    function tick() {
      raf = requestAnimationFrame(tick);
      const t = (performance.now() - start) / 1000; const tot = total();
      if (t >= tot) { stop(true); drawFrame(tot - 0.01); return; }
      const i = drawFrame(t); barEl.style.width = (t / tot * 100) + '%';
      if (i !== lastIdx) { lastIdx = i; if (audio) audio.pause(); if (seq[i].audio) { audio = new Audio(seq[i].audio); audio.play().catch(() => {}); } else if (seq[i].say && window.speechSynthesis) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(seq[i].say); u.lang = seq[i].lang === 'kz' ? 'kk-KZ' : 'ru-RU'; speechSynthesis.speak(u); } }
    }
    function play() { if (playing) return; playing = true; start = performance.now(); lastIdx = -1; window.Music && Music.duck(true); tick(); }
    function stop(ended) { playing = false; cancelAnimationFrame(raf); if (audio) { audio.pause(); audio = null; } window.Music && Music.duck(false); if (ended && onEnd) onEnd(); }
    return { build, play, stop, get playing() { return playing; }, set onEnd(f) { onEnd = f; } };
  }

  return { draw, loop, Trailer };
})();
