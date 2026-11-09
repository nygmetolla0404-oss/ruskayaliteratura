/* 3D-кабинет писателя с голограммой из частиц */
window.RoomView = function (opts) {
  const { canvas, tip, info, getLang, onAudio } = opts;
  let renderer, scene, camera, controls, raf, clickables = [], hovered = null, holo = null, flame = null, candleLight = null, winTex = null, winEls = null, writer = null, running = false, downAt = null;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const L = k => window.I18N[getLang()][k];

  function init() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.minDistance = 2.2; controls.maxDistance = 8.5;
    controls.minAzimuthAngle = -1.0; controls.maxAzimuthAngle = 1.0; controls.maxPolarAngle = Math.PI * 0.53; controls.minPolarAngle = 0.5;
    controls.enablePan = false;
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) click(e); });
    canvas.addEventListener('pointerleave', () => setHover(null));
    new ResizeObserver(resize).observe(canvas);
  }
  function resize() { if (!renderer) return; const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 600 ? 70 : 55; camera.updateProjectionMatrix(); }

  /* ---------- textures ---------- */
  function cvTex(w, h, fn, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 8; return t; }
  const noise = (c, w, h, a) => { const d = c.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - .5) * a; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } c.putImageData(d, 0, 0); };
  const T = {
    planks: (col) => cvTex(512, 512, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = shade(col, (Math.random() - .5) * 30); c.fillRect(0, i * 64, w, 64); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, i * 64, w, 2); for (let j = 0; j < 30; j++) { c.strokeStyle = 'rgba(0,0,0,.08)'; c.beginPath(); const y = i * 64 + Math.random() * 64; c.moveTo(0, y); c.bezierCurveTo(w * .3, y + 4, w * .6, y - 4, w, y); c.stroke(); } } noise(c, w, h, 14); }, [3, 3]),
    wallpaper: (col, pat) => cvTex(256, 256, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.strokeStyle = pat; c.fillStyle = pat; c.lineWidth = 3; for (let x = 0; x < w; x += 64) for (let y = 0; y < h; y += 64) { const ox = (y / 64) % 2 ? 32 : 0; c.beginPath(); c.moveTo(x + ox + 32, y + 10); c.bezierCurveTo(x + ox + 54, y + 22, x + ox + 54, y + 42, x + ox + 32, y + 54); c.bezierCurveTo(x + ox + 10, y + 42, x + ox + 10, y + 22, x + ox + 32, y + 10); c.stroke(); c.beginPath(); c.arc(x + ox + 32, y + 32, 4, 0, 7); c.fill(); } noise(c, w, h, 10); }, [6, 3]),
    clay: () => cvTex(512, 512, (c, w, h) => { c.fillStyle = '#b48f63'; c.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${Math.random() > .5 ? '255,230,190' : '90,60,30'},.07)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 30, 0, 7); c.fill(); } noise(c, w, h, 24); }, [3, 2]),
    logs: () => cvTex(512, 512, (c, w, h) => { for (let i = 0; i < 6; i++) { const y = i * 85; const g = c.createLinearGradient(0, y, 0, y + 85); g.addColorStop(0, '#4a2f18'); g.addColorStop(.5, '#8a5d33'); g.addColorStop(1, '#3a2412'); c.fillStyle = g; c.fillRect(0, y, w, 85); } noise(c, w, h, 18); }, [3, 2]),
    concrete: () => cvTex(512, 512, (c, w, h) => { c.fillStyle = '#5f6b63'; c.fillRect(0, 0, w, h); c.fillStyle = '#4c5650'; c.fillRect(0, h * .55, w, h * .45); for (let i = 0; i < 80; i++) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 40, 1 + Math.random() * 3); } noise(c, w, h, 22); }, [3, 1]),
    stone: () => cvTex(512, 512, (c, w, h) => { c.fillStyle = '#6c6458'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 96) { c.fillStyle = shade('#80776a', (Math.random() - .5) * 40); c.fillRect(x + ((y / 64) % 2) * 48 + 3, y + 3, 90, 58); } noise(c, w, h, 16); }, [3, 3]),
    carpet: () => cvTex(512, 512, (c, w, h) => { c.fillStyle = '#7d1f1f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e7b65a'; c.lineWidth = 10; c.strokeRect(20, 20, w - 40, h - 40); c.lineWidth = 4; c.strokeRect(44, 44, w - 88, h - 88); c.fillStyle = '#1f3a6b'; c.fillRect(60, 60, w - 120, h - 120); c.strokeStyle = '#e7b65a'; c.lineWidth = 6; const horn = (x, y, s) => { c.beginPath(); c.moveTo(x, y + s); c.lineTo(x, y); c.bezierCurveTo(x, y - s * .8, x - s, y - s * .8, x - s * .9, y - s * .1); c.bezierCurveTo(x - s * .8, y + s * .3, x - s * .3, y + s * .2, x - s * .35, y - s * .1); c.moveTo(x, y); c.bezierCurveTo(x, y - s * .8, x + s, y - s * .8, x + s * .9, y - s * .1); c.bezierCurveTo(x + s * .8, y + s * .3, x + s * .3, y + s * .2, x + s * .35, y - s * .1); c.stroke(); }; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) horn(130 + i * 126, 140 + j * 120, 34); noise(c, w, h, 12); }),
    kerege: () => cvTex(512, 256, (c, w, h) => { c.fillStyle = '#e9dcc0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a5a2b'; c.lineWidth = 7; for (let x = -h; x < w + h; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + h, h); c.moveTo(x + h, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = '#b2452f'; c.fillRect(0, 0, w, 18); c.fillRect(0, h - 18, w, 18); noise(c, w, h, 10); }, [8, 1]),
    dark: (col) => cvTex(256, 256, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); noise(c, w, h, 10); }, [4, 2])
  };
  function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, Math.min(255, (n >> 16) + d)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d)), b = Math.max(0, Math.min(255, (n & 255) + d)); return `rgb(${r},${g},${b})`; }

  const THEMES = {
    study: { wall: () => T.wallpaper('#4a2e24', 'rgba(227,181,91,.18)'), floor: () => T.planks('#6b4426'), amb: 0.35 },
    fort: { wall: T.clay, floor: T.stone, amb: 0.45 },
    yurt: { wall: T.kerege, floor: T.carpet, amb: 0.5 },
    izba: { wall: T.logs, floor: () => T.planks('#7a5530'), amb: 0.4 },
    barracks: { wall: T.concrete, floor: () => T.planks('#4d3b2a'), amb: 0.28 },
    museum: { wall: () => T.dark('#2a2630'), floor: () => T.planks('#3b2a1e'), amb: 0.3 },
    soviet: { wall: () => T.wallpaper('#cdb894', 'rgba(110,70,30,.2)'), floor: () => T.planks('#8a5a2e'), amb: 0.45 },
    modern: { wall: () => T.wallpaper('#2e3b57', 'rgba(140,180,255,.12)'), floor: () => T.planks('#5a3d25'), amb: 0.45 }
  };
  const VIEWS = { steppe: ['sky:dusk', 'sun', 'steppe', 'yurt'], river: ['sky:dusk', 'sun', 'steppe', 'sea'], sea: ['sky:dusk', 'sun', 'sea'], mountains: ['sky:day', 'sun', 'mountains', 'poplars'], snow: ['sky:winter', 'hills', 'snow', 'wire'], space: ['sky:night', 'stars', 'moon', 'city'] };

  const M = (col, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: .8 }, o || {}));
  function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; (parent || scene).add(m); return m; }
  function cyl(rt, rb, h, mat, x, y, z, parent, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat); m.position.set(x, y, z); m.castShadow = true; (parent || scene).add(m); return m; }
  function clickable(obj, key, title, html, extra, say) { obj.userData.click = { key, title, html, extra, say }; clickables.push(obj); return obj; }

  /* ---------- build ---------- */
  function build(w) {
    writer = w; const lang = getLang(); clickables = []; hovered = null;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x07080d); scene.fog = new THREE.Fog(0x07080d, 10, 22);
    const th = THEMES[w.room] || THEMES.study, yurt = w.room === 'yurt';
    scene.add(new THREE.AmbientLight(0xfff0dd, th.amb));
    scene.add(new THREE.HemisphereLight(0xcfdfff, 0x3a2614, 0.35));

    // floor
    const fl = new THREE.Mesh(yurt ? new THREE.CircleGeometry(5, 48) : new THREE.PlaneGeometry(10, 8), M(0xffffff, { map: th.floor() }));
    fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    const wallMat = M(0xffffff, { map: th.wall(), side: THREE.DoubleSide });
    if (yurt) {
      const kw = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.4, 48, 1, true), M(0xffffff, { map: T.kerege(), side: THREE.BackSide })); kw.position.y = 1.2; kw.receiveShadow = true; scene.add(kw);
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(.75, 5.05, 2.35, 48, 1, true), M(0xd9c7a2, { side: THREE.BackSide })); dome.position.y = 2.4 + 1.175; scene.add(dome);
      // uyk poles (from kerege top to shanyrak)
      const pole = M(0x9a6232), up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2, s = new THREE.Vector3(Math.cos(a) * 4.95, 2.4, Math.sin(a) * 4.95), e = new THREE.Vector3(Math.cos(a) * .78, 4.72, Math.sin(a) * .78);
        const dir = e.clone().sub(s), p = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, dir.length(), 6), pole);
        p.position.copy(s).add(e).multiplyScalar(.5); p.quaternion.setFromUnitVectors(up, dir.normalize()); scene.add(p);
      }
      const shan = new THREE.Mesh(new THREE.TorusGeometry(.75, .08, 8, 40), M(0x7a4520)); shan.rotation.x = Math.PI / 2; shan.position.y = 4.75; scene.add(shan);
      for (let i = 0; i < 3; i++) { const b = box(1.5, .05, .05, M(0x7a4520), 0, 4.75, 0); b.rotation.y = i * Math.PI / 3; }
      const sky = new THREE.Mesh(new THREE.CircleGeometry(.72, 32), new THREE.MeshBasicMaterial({ color: 0x9fd0ff })); sky.rotation.x = Math.PI / 2; sky.position.y = 4.8; scene.add(sky);
      const sl = new THREE.SpotLight(0xcfe6ff, 1.1, 12, .45, .6); sl.position.set(0, 4.8, 0); sl.target.position.set(0, 0, 0); sl.castShadow = true; scene.add(sl, sl.target);
    } else {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.2), wallMat); back.position.set(0, 2.1, -4); back.receiveShadow = true; scene.add(back);
      const left = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.2), wallMat); left.position.set(-5, 2.1, 0); left.rotation.y = Math.PI / 2; left.receiveShadow = true; scene.add(left);
      const right = left.clone(); right.position.x = 5; right.rotation.y = -Math.PI / 2; scene.add(right);
      box(10, .18, .1, M(0x2b1a10), 0, .09, -3.95); // baseboard
      if (w.room !== 'barracks') box(10, .12, .12, M(0x3a2414), 0, 4.1, -3.95);
    }

    // window (animated scene view)
    winEls = VIEWS[w.window] || VIEWS.steppe;
    const wc = document.createElement('canvas'); wc.width = 512; wc.height = 384; winTex = new THREE.CanvasTexture(wc); winTex.encoding = THREE.sRGBEncoding; winTex.userData = { c: wc.getContext('2d') };
    const winGroup = new THREE.Group();
    const bars = w.room === 'barracks';
    const ww = bars ? 1.2 : 2.0, wh = bars ? .9 : 1.6;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: winTex }));
    winGroup.add(pane);
    const fr = M(w.room === 'modern' ? 0xdddddd : 0x3b2414);
    [[0, wh / 2, ww + .16, .1], [0, -wh / 2, ww + .16, .1]].forEach(([x, y, a, b]) => box(a, b, .1, fr, x, y, .03, winGroup));
    [[-ww / 2, 0], [ww / 2, 0]].forEach(([x, y]) => box(.1, wh + .1, .1, fr, x, y, .03, winGroup));
    box(.05, wh, .05, fr, 0, 0, .03, winGroup); box(ww, .05, .05, fr, 0, wh * .15, .03, winGroup);
    if (bars) for (let i = -2; i <= 2; i++) box(.03, wh, .03, M(0x222222, { metalness: .8 }), i * ww / 6, 0, .08, winGroup);
    box(ww + .3, .08, .25, fr, 0, -wh / 2 - .08, .1, winGroup);
    if (yurt) { winGroup.position.set(0, 1.0, -4.93); pane.scale.set(.75, 1.3, 1); winGroup.children.forEach(c => { if (c !== pane) c.visible = false; }); }
    else winGroup.position.set(-2.6, 2.3, -3.97);
    scene.add(winGroup);
    clickable(pane, 'window', L('window') + ' · ' + w.place[lang], `<p>${w.short[lang]}</p><p>${w.facts[0][lang]}</p>`);
    const wl = new THREE.DirectionalLight(0xb8d0ff, .5); wl.position.set(-2.6, 3, -2); wl.target.position.set(0, 0, 1); scene.add(wl, wl.target);

    // desk & chair
    const low = yurt; const deskH = low ? .45 : .82;
    const wood = M(w.room === 'barracks' ? 0x5a4632 : w.room === 'modern' ? 0x6b4a2e : 0x4a2c17, { roughness: .6 });
    const desk = new THREE.Group(); desk.position.set(0, 0, -1.6); scene.add(desk);
    box(2.2, .08, 1.1, wood, 0, deskH, 0, desk);
    [[-1, -.48], [1, -.48], [-1, .48], [1, .48]].forEach(([x, z]) => box(.08, deskH, .08, wood, x, deskH / 2, z, desk));
    if (!low) { box(.6, .4, 1.0, wood, .72, deskH - .26, 0, desk); }
    if (low) { cyl(.45, .5, .1, M(0x8b1e1e), 0, .05, -.5); }
    else {
      const ch = new THREE.Group(); ch.position.set(-.15, 0, -.65); scene.add(ch);
      box(.55, .06, .55, wood, 0, .5, 0, ch); [[-.24, -.24], [.24, -.24], [-.24, .24], [.24, .24]].forEach(([x, z]) => box(.05, .5, .05, wood, x, .25, z, ch));
      box(.55, .26, .05, wood, 0, .66, .26, ch);
    }
    const top = deskH + .04;
    // manuscript / papers
    const paper = M(0xf3e7c8, { roughness: 1 });
    const ms = new THREE.Group(); ms.position.set(-.25, top + .01, -1.45); scene.add(ms);
    const pageTex = cvTex(256, 340, (c, W, H) => { c.fillStyle = '#f3e7c8'; c.fillRect(0, 0, W, H); c.fillStyle = '#3a2a14'; c.font = 'italic 22px Caveat, cursive'; const words = w.sim[lang].split(' '); let x = 16, y = 40; words.forEach(wd => { const ww2 = c.measureText(wd + ' ').width; if (x + ww2 > W - 12) { x = 16; y += 26; } if (y < H - 10) c.fillText(wd, x, y); x += ww2; }); });
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.42, .005, .56), i === 3 ? [paper, paper, new THREE.MeshStandardMaterial({ map: pageTex }), paper, paper, paper] : paper); p.position.y = i * .006; p.rotation.y = (Math.random() - .5) * .15; p.castShadow = true; ms.add(p); }
    clickable(ms, 'manuscript', L('manuscript') + ': «' + w.trailer.work[lang] + '»', `<p><i>${w.sim[lang]}</i></p>`, 'sim');
    // writing tool
    if (w.room === 'modern' || w.room === 'soviet') {
      const tw = new THREE.Group(); tw.position.set(.35, top, -1.5); scene.add(tw);
      box(.5, .14, .4, M(0x1d2733, { metalness: .4, roughness: .4 }), 0, .07, 0, tw); box(.5, .06, .12, M(0x111111), 0, .17, -.13, tw);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(.3, .32), paper); sheet.position.set(0, .3, -.16); sheet.rotation.x = -.2; tw.add(sheet);
    } else {
      cyl(.05, .06, .08, M(0x101418, { metalness: .5, roughness: .2 }), .35, top + .04, -1.3);
      const quill = new THREE.Mesh(new THREE.ConeGeometry(.035, .45, 6), M(0xf5f1e6)); quill.position.set(.38, top + .25, -1.3); quill.rotation.z = -.35; scene.add(quill);
    }
    // candle or lamp
    const cg = new THREE.Group(); cg.position.set(.75, top, -1.85); scene.add(cg);
    if (w.room === 'modern' || w.room === 'barracks' || w.room === 'soviet') {
      cyl(.12, .14, .03, M(0x222222), 0, .015, 0, cg); cyl(.015, .015, .45, M(0x333333, { metalness: .7 }), 0, .24, 0, cg);
      const shadeM = new THREE.Mesh(new THREE.ConeGeometry(.2, .2, 20, 1, true), M(w.room === 'modern' ? 0x2f6f4f : 0x444444, { side: THREE.DoubleSide })); shadeM.position.y = .5; cg.add(shadeM);
      flame = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c0 })); flame.position.y = .45; cg.add(flame);
    } else {
      cyl(.11, .13, .03, M(0xb8913c, { metalness: .8, roughness: .3 }), 0, .015, 0, cg);
      cyl(.04, .04, .26, M(0xf2ead6), 0, .16, 0, cg);
      flame = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a })); flame.scale.y = 2; flame.position.y = .34; cg.add(flame);
    }
    candleLight = new THREE.PointLight(0xffb560, 1.4, 6, 2); candleLight.position.set(.75, top + .5, -1.85); candleLight.castShadow = true; candleLight.shadow.mapSize.set(1024, 1024); scene.add(candleLight);
    clickable(cg, 'candle', L('candle') + ' · ' + L('facts'), `<p>${w.facts[1][lang]}</p>`);
    // letter
    const env = box(.3, .01, .2, M(0xe8dcc0), -.8, top + .005, -1.3); env.rotation.y = .3;
    clickable(env, 'letter', L('facts'), `<p>${w.facts[2][lang]}</p>`);

    // bookshelf (or chest in yurt)
    const shelf = new THREE.Group(); scene.add(shelf);
    const bookCols = [0x7a1f1f, 0x1f3a6b, 0x2f5a2f, 0x6b4a1f, 0x3b2a5a, 0x8a6a2a, 0x1f1f1f];
    if (yurt) {
      shelf.position.set(3.2, 0, -2.6); shelf.rotation.y = -.6;
      box(1.4, .7, .7, M(0x8b4a1e), 0, .35, 0, shelf); box(1.42, .06, .72, M(0xe7b65a, { metalness: .6, roughness: .3 }), 0, .55, 0, shelf);
      for (let i = 0; i < 5; i++) { const b = box(.28, .07, .38, M(bookCols[i % 7]), (i % 2 - .5) * .1, .74 + i * .07, 0, shelf); b.rotation.y = (Math.random() - .5) * .4; }
    } else {
      shelf.position.set(3.6, 0, -3.65);
      const sw = M(0x3a2414); const H = w.room === 'barracks' ? 1.6 : 2.8;
      box(1.8, H, .06, sw, 0, H / 2, -.2, shelf); box(.06, H, .5, sw, -.9, H / 2, 0, shelf); box(.06, H, .5, sw, .9, H / 2, 0, shelf);
      const n = w.room === 'barracks' ? 2 : 4;
      for (let s = 0; s < n; s++) {
        const y = .1 + s * (H / n); box(1.8, .05, .5, sw, 0, y, 0, shelf);
        let x = -.82; while (x < .78) { const bw = .05 + Math.random() * .06, bh = .3 + Math.random() * .22; if (Math.random() < .08) { x += .1; continue; } const b = box(bw, bh, .3 + Math.random() * .08, M(bookCols[Math.floor(Math.random() * 7)], { roughness: .7 }), x + bw / 2, y + .03 + bh / 2, 0, shelf); if (Math.random() < .1) b.rotation.z = .2; x += bw + .005; }
      }
    }
    clickable(shelf, 'shelf', L('bookshelf') + ' · ' + L('works'), w.works.map(x => `<p><b>«${x.t[lang]}»</b> <span style="color:var(--gold2)">${x.y}</span><br>${x.n[lang]}</p>`).join(''), null, w.works.map(x => Voice.workText(x, lang)));

    // map frame on wall
    const mapTex = cvTex(512, 340, (c, W, H) => {
      c.fillStyle = '#ead7a8'; c.fillRect(0, 0, W, H); noise(c, W, H, 14);
      const pts = window.KZ_SHAPE; const x = l => (l - 46) / 42 * (W - 60) + 30, y = l => (56 - l) / 16 * (H - 60) + 30;
      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(x(p[0]), y(p[1])) : c.moveTo(x(p[0]), y(p[1]))); c.closePath(); c.fillStyle = 'rgba(160,120,60,.35)'; c.fill(); c.strokeStyle = '#5a3a14'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#b3261e'; c.beginPath(); c.arc(x(w.lon), y(w.lat), 9, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#3a2410'; c.font = 'bold 26px "Cormorant Garamond", serif'; c.fillText(w.place[lang], Math.min(W - 160, x(w.lon) + 14), y(w.lat) - 10);
    });
    const mg = new THREE.Group();
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 1 })); mg.add(mp);
    box(1.6, 1.1, .04, M(0x6b4a1f, { metalness: .4, roughness: .4 }), 0, 0, -.025, mg);
    if (yurt) { mg.position.set(-3.6, 1.5, -2.8); mg.rotation.y = .9; } else { mg.position.set(-4.97, 2.2, -1.2); mg.rotation.y = Math.PI / 2; }
    scene.add(mg);
    clickable(mg, 'map', L('mapObj') + ' · ' + w.place[lang], `<p>${w.short[lang]}</p>`);

    // rug
    if (!yurt && w.room !== 'barracks') { const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), M(0xffffff, { map: T.carpet() })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, .005, 0); rug.receiveShadow = true; scene.add(rug); }

    // theme extras
    if (w.room === 'barracks') { // bunk bed
      const bb = new THREE.Group(); bb.position.set(-3.7, 0, -1.6); scene.add(bb); const mt = M(0x333a33, { metalness: .6 });
      [[-.45, -1], [.45, -1], [-.45, 1], [.45, 1]].forEach(([x, z]) => box(.05, 1.9, .05, mt, x, .95, z, bb));
      [.45, 1.4].forEach(y => { box(.95, .05, 2.05, mt, 0, y, 0, bb); box(.85, .1, 1.95, M(0x5c5848), 0, y + .08, 0, bb); });
    }
    if (w.room === 'izba') { const st = box(1.4, 2.2, 1.3, M(0xe9e2d3, { roughness: 1 }), -3.9, 1.1, -3.0); box(.5, .4, .1, M(0x1a1a1a), -3.9, .7, -2.33); }
    if (w.room === 'fort') { // easel with painting of the sea
      const eg = new THREE.Group(); eg.position.set(-3.2, 0, -1.8); eg.rotation.y = .5; scene.add(eg); const ew = M(0x6b4a2a);
      [[-.35, 0], [.35, 0]].forEach(([x]) => { const l = box(.05, 1.8, .05, ew, x, .9, 0, eg); l.rotation.z = x > 0 ? -.08 : .08; });
      const back = box(.05, 1.7, .05, ew, 0, .85, -.4, eg); back.rotation.x = -.25;
      const ptx = cvTex(320, 240, (c, W, H) => Scenes.draw(c, W, H, ['sky:dusk', 'sun', 'sea'], 2));
      const pn = new THREE.Mesh(new THREE.PlaneGeometry(.9, .68), new THREE.MeshStandardMaterial({ map: ptx })); pn.position.set(0, 1.35, .05); eg.add(pn);
    }
    if (w.room === 'museum') {
      [[-3.6, -2.6], [3.0, 0.3]].forEach(([x, z], i) => {
        box(.7, 1.0, .7, M(0x2a2018), x, .5, z);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(.66, .6, .66), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .15, roughness: 0, metalness: 0 })); glass.position.set(x, 1.3, z); scene.add(glass);
        const art = i ? new THREE.Mesh(new THREE.TorusKnotGeometry(.12, .04, 64, 8), M(0xb87333, { metalness: .9, roughness: .3 })) : new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 14), M(0x8a5a2a)); art.position.set(x, 1.2, z); scene.add(art);
        const sp = new THREE.SpotLight(0xfff0d0, 1.2, 6, .4, .5); sp.position.set(x, 3.8, z); sp.target = art; scene.add(sp);
      });
    }
    if (w.room === 'modern') { // radio
      const rd = box(.5, .35, .25, M(0x5a3a22), -.75, top + .17, -1.85); box(.3, .2, .01, M(0xd9c79a), -.75, top + .2, -1.72);
    }

    /* ===== ERA KIT: details of each writer's time & seated figure ===== */
    const anims = scene.userData.anims = [];
    const EXI = ((window.LIT_EXTRA || {}).w || {})[w.id] || {};
    const sideTable = (x, z, h) => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); box(.7, .05, .55, M(0x4a2c17), 0, h, 0, g); cyl(.04, .05, h, M(0x4a2c17), 0, h / 2, 0, g); cyl(.25, .3, .03, M(0x4a2c17), 0, .015, 0, g); return g; };
    function samovar(parent, y) { const g = new THREE.Group(); g.position.y = y; parent.add(g); const brass = M(0xc9953a, { metalness: .9, roughness: .25 }); const pts = [[0, 0], [.09, 0], [.06, .05], [.14, .12], [.16, .28], [.12, .36], [.05, .4], [.05, .46], [0, .46]].map(p => new THREE.Vector2(p[0], p[1])); g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 24), brass)); const sp = new THREE.Mesh(new THREE.CylinderGeometry(.015, .02, .14, 6), brass); sp.position.set(.17, .14, 0); sp.rotation.z = 1.2; g.add(sp); const tp = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), M(0xf0f0f0)); tp.position.y = .52; g.add(tp); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
    function tiledStove(x, z) { const t = cvTex(128, 256, (c, W, H) => { c.fillStyle = '#f3efe6'; c.fillRect(0, 0, W, H); c.strokeStyle = '#2d5a9b'; c.lineWidth = 3; for (let y = 0; y < H; y += 32) for (let xx = 0; xx < W; xx += 32) { c.strokeRect(xx + 2, y + 2, 28, 28); c.beginPath(); c.arc(xx + 16, y + 16, 7, 0, 7); c.stroke(); } }, [1, 2]); const s = box(1.1, 3.0, .8, M(0xffffff, { map: t, roughness: .3 }), x, 1.5, z); box(1.2, .12, .9, M(0xe8e0d0), x, 3.06, z); return s; }
    function globe(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); const gt = cvTex(256, 128, (c, W, H) => { c.fillStyle = '#d9c38f'; c.fillRect(0, 0, W, H); c.fillStyle = '#7a8f5a'; for (let i = 0; i < 26; i++) { c.beginPath(); c.ellipse(Math.random() * W, 20 + Math.random() * 88, 10 + Math.random() * 26, 6 + Math.random() * 14, Math.random(), 0, 7); c.fill(); } c.strokeStyle = 'rgba(80,50,20,.4)'; for (let i = 0; i < W; i += 21) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H); c.stroke(); } }); const s = new THREE.Mesh(new THREE.SphereGeometry(.28, 32, 20), M(0xffffff, { map: gt, roughness: .5 })); s.position.y = 1.0; s.rotation.z = .4; g.add(s); const r = new THREE.Mesh(new THREE.TorusGeometry(.31, .015, 6, 40), M(0xc9953a, { metalness: .9, roughness: .3 })); r.position.y = 1.0; r.rotation.y = Math.PI / 2; r.rotation.x = .4; g.add(r); cyl(.03, .04, .72, M(0x4a2c17), 0, .36, 0, g); cyl(.22, .26, .04, M(0x4a2c17), 0, .02, 0, g); anims.push(t => { s.rotation.y = t * .3; }); return g; }
    function coatOnHook(x, y, z, ry, col, patch) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); box(.06, .06, .12, M(0x3a2414), 0, .05, -.04, g); const pts = [[0, -1.1], [.34, -1.1], [.3, -.5], [.24, -.1], [.12, .02], [0, .04]].map(p => new THREE.Vector2(p[0], p[1])); const c = new THREE.Mesh(new THREE.LatheGeometry(pts, 14, 0, Math.PI), M(col, { side: THREE.DoubleSide })); c.rotation.y = -Math.PI / 2; c.scale.z = .45; c.castShadow = true; g.add(c); [-.24, .24].forEach(sx => { const a = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .7, 8), M(col)); a.position.set(sx, -.45, .05); g.add(a); }); if (patch) { const pt = cvTex(128, 64, (cc, W, H) => { cc.fillStyle = '#eee'; cc.fillRect(0, 0, W, H); cc.fillStyle = '#111'; cc.font = 'bold 38px Inter, sans-serif'; cc.textAlign = 'center'; cc.fillText(patch, W / 2, 46); }); const p = new THREE.Mesh(new THREE.PlaneGeometry(.26, .13), new THREE.MeshStandardMaterial({ map: pt })); p.position.set(.0, -.35, .17); g.add(p); } return g; }
    function musket(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = .12; scene.add(g); box(.06, .55, .1, M(0x5a3518), 0, .3, 0, g); cyl(.018, .018, 1.0, M(0x333333, { metalness: .8, roughness: .3 }), 0, 1.05, 0, g); return g; }
    function shako(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); cyl(.1, .12, .2, M(0x1c1c1c), 0, .1, 0, g); box(.2, .02, .1, M(0x111111), 0, .01, .08, g); cyl(.02, .02, .02, M(0xc9953a, { metalness: .9 }), 0, .16, .11, g); return g; }
    function topHat(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); cyl(.2, .2, .015, M(0x111111), 0, .008, 0, g); cyl(.11, .11, .22, M(0x151515), 0, .12, 0, g); return g; }
    function chest(x, z, ry, col) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; scene.add(g); box(.9, .45, .5, M(col || 0x6b3d1c), 0, .225, 0, g); const lid = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .9, 12, 1, false, 0, Math.PI), M(col || 0x6b3d1c)); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; lid.position.y = .45; lid.scale.set(1, 1, .45); g.add(lid); [-.3, .3].forEach(bx => box(.04, .5, .52, M(0xb08a3a, { metalness: .8, roughness: .3 }), bx, .25, 0, g)); return g; }
    function dombra(x, y, z, ry) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, ry, .25); scene.add(g); const body = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 14), M(0xa0612b, { roughness: .4 })); body.scale.set(1, 1.35, .45); g.add(body); box(.06, .85, .04, M(0x7a4520), 0, .62, 0, g); box(.09, .14, .05, M(0x5a3015), 0, 1.08, 0, g); [-.012, .012].forEach(sx => { const s = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, 1.2, 3), M(0xeeeeee)); s.position.set(sx, .45, .05); g.add(s); }); return g; }
    function saddle(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); box(.12, .5, .7, M(0x3a2414), 0, .25, 0, g); const s = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .5, 14, 1, false, 0, Math.PI), M(0x8b3a1e)); s.rotation.x = Math.PI / 2; s.rotation.z = Math.PI / 2; s.position.y = .5; s.scale.set(1, 1, .7); g.add(s); box(.05, .18, .05, M(0xc9953a, { metalness: .9 }), 0, .82, .2, g); return g; }
    function teaSet(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const por = M(0xf6f6f6, { roughness: .2 }), blue = M(0x2d5a9b); const tp = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), por); tp.scale.y = .8; tp.position.y = .08; g.add(tp); const sp = new THREE.Mesh(new THREE.CylinderGeometry(.01, .02, .1, 6), por); sp.position.set(.1, .1, 0); sp.rotation.z = -1; g.add(sp); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; const b = new THREE.Mesh(new THREE.CylinderGeometry(.05, .03, .045, 14), por); b.position.set(Math.cos(a) * .22, .023, Math.sin(a) * .16); g.add(b); const r = new THREE.Mesh(new THREE.TorusGeometry(.05, .006, 4, 16), blue); r.rotation.x = Math.PI / 2; r.position.copy(b.position).setY(.045); g.add(r); } return g; }
    function typewriter(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); box(.46, .12, .36, M(0x1d2420, { metalness: .4, roughness: .4 }), 0, .06, 0, g); box(.5, .06, .1, M(0x111111), 0, .16, -.12, g); for (let i = 0; i < 4; i++) box(.38, .015, .05, M(0x2a2a2a), 0, .12 + i * .005, .08 + i * .04 - .06, g); const sh = new THREE.Mesh(new THREE.PlaneGeometry(.28, .3), M(0xf3ecd8, { side: THREE.DoubleSide })); sh.position.set(0, .3, -.14); sh.rotation.x = -.25; g.add(sh); return g; }
    function phone(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const m = M(0x151515, { roughness: .3 }); box(.2, .09, .22, m, 0, .045, 0, g); const d = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .015, 20), M(0xdddddd)); d.position.set(0, .095, .02); d.rotation.x = -.3; g.add(d); const h = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .22, 8), m); h.rotation.z = Math.PI / 2; h.position.y = .13; g.add(h); return g; }
    function wallCarpet(x, y, z, ry, w2, h2) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w2 || 2.4, h2 || 1.6), M(0xffffff, { map: T.carpet() })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; }
    function poster(x, y, z, ry, title, sub, col) { const t = cvTex(256, 360, (c, W, H) => { c.fillStyle = col || '#b3261e'; c.fillRect(0, 0, W, H); c.fillStyle = '#f4d58d'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 54; c.lineTo(128 + Math.cos(a) * r, 110 + Math.sin(a) * r); } c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 30px "Cormorant Garamond", serif'; const words = title.split(' '); let line = '', y2 = 220; words.forEach(wd => { if (c.measureText(line + wd).width > 220) { c.fillText(line, 128, y2); line = ''; y2 += 32; } line += wd + ' '; }); c.fillText(line, 128, y2); c.font = '600 18px Inter, sans-serif'; c.fillStyle = '#f4d58d'; c.fillText(sub || '', 128, H - 24); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.05), new THREE.MeshStandardMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; }
    function loudspeaker(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const c = new THREE.Mesh(new THREE.ConeGeometry(.22, .12, 24, 1, true), M(0x1a1a1a, { side: THREE.DoubleSide })); c.rotation.x = -Math.PI / 2; c.position.z = .07; g.add(c); cyl(.04, .04, .05, M(0x333333), 0, 0, .02, g).rotation.x = Math.PI / 2; return g; }
    function gramophone(parent, y) { const g = new THREE.Group(); g.position.y = y; parent.add(g); box(.32, .12, .32, M(0x5a3015), 0, .06, 0, g); const disc = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .01, 24), M(0x111111)); disc.position.y = .125; g.add(disc); const horn = new THREE.Mesh(new THREE.ConeGeometry(.16, .32, 20, 1, true), M(0xc9953a, { metalness: .8, roughness: .3, side: THREE.DoubleSide })); horn.position.set(-.05, .38, -.08); horn.rotation.z = 2.4; g.add(horn); anims.push(t => { disc.rotation.y = t * 3; }); return g; }
    function ironStove(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); const iron = M(0x2a2a2a, { metalness: .6, roughness: .5 }); cyl(.3, .3, .7, iron, 0, .45, 0, g); [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => box(.04, .12, .04, iron, a, .06, b, g)); cyl(.06, .06, 3.2, iron, 0, 2.4, 0, g); const door = new THREE.Mesh(new THREE.PlaneGeometry(.2, .14), new THREE.MeshBasicMaterial({ color: 0xff7a2a })); door.position.set(0, .4, .305); g.add(door); const l = new THREE.PointLight(0xff7a2a, 1.1, 4, 2); l.position.set(0, .45, .6); g.add(l); anims.push(t => { l.intensity = 1 + Math.sin(t * 9) * .15 + Math.sin(t * 3.3) * .1; }); return g; }
    function mugBread(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const tin = M(0x9aa0a6, { metalness: .8, roughness: .35 }); cyl(.045, .045, .1, tin, 0, .05, 0, g); cyl(.11, .08, .05, tin, .2, .025, .05, g); box(.14, .06, .08, M(0x4a2c17, { roughness: 1 }), -.18, .03, .06, g); return g; }
    function bulb(x, y, z) { const wire = cyl(.006, .006, 4.2 - y, M(0x111111), x, (4.2 + y) / 2, z); const b = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); b.position.set(x, y, z); scene.add(b); const l = new THREE.PointLight(0xffd59a, .9, 6, 2); l.position.set(x, y - .05, z); l.castShadow = true; scene.add(l); return b; }
    function tv(x, z, ry) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); [[-.25, -.18], [.25, -.18], [-.25, .18], [.25, .18]].forEach(([a, b]) => box(.03, .45, .03, M(0x3a2414), a, .22, b, g)); box(.7, .5, .45, M(0x6b4a2e, { roughness: .4 }), 0, .7, 0, g); const sc = document.createElement('canvas'); sc.width = 256; sc.height = 192; const st = new THREE.CanvasTexture(sc); const sm = new THREE.Mesh(new THREE.PlaneGeometry(.46, .36), new THREE.MeshBasicMaterial({ map: st })); sm.position.set(-.06, .72, .226); g.add(sm); anims.push(t => { if (Math.floor(t * 10) === sm.userData.f) return; sm.userData.f = Math.floor(t * 10); const c = sc.getContext('2d'); Scenes.draw(c, 256, 192, ['sky:dawn', 'steppe', 'rocket'], t % 7); const d = c.getImageData(0, 0, 256, 192); for (let i = 0; i < d.data.length; i += 4) { const v = (d.data[i] * .3 + d.data[i + 1] * .59 + d.data[i + 2] * .11) * (.9 + Math.random() * .2); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; } c.putImageData(d, 0, 0); st.needsUpdate = true; }); return g; }
    function scrolls(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); for (let i = 0; i < 3; i++) { const s = cyl(.03, .03, .32, M(0xe8d8b0), (i - 1) * .07, .03, 0, g); s.rotation.z = Math.PI / 2; s.rotation.y = i * .3; } return g; }
    function newspaper(x, y, z, title) { const t = cvTex(256, 180, (c, W, H) => { c.fillStyle = '#e9e4d6'; c.fillRect(0, 0, W, H); c.fillStyle = '#222'; c.font = 'bold 30px "Cormorant Garamond", serif'; c.fillText(title, 12, 34); c.fillRect(10, 42, W - 20, 3); c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 12; i++) c.fillRect(10 + (i % 2) * 124, 56 + Math.floor(i / 2) * 18, 112, 6); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(.42, .3), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.rotation.z = .25; m.position.set(x, y + .004, z); scene.add(m); return m; }
    function calendar(x, y, z, ry, yr, place) { const t = cvTex(256, 300, (c, W, H) => { c.fillStyle = '#f6f0e0'; c.fillRect(0, 0, W, H); c.fillStyle = '#b3261e'; c.fillRect(0, 0, W, 60); c.fillStyle = '#fff'; c.font = 'bold 30px Inter, sans-serif'; c.textAlign = 'center'; c.fillText(place, W / 2, 42); c.fillStyle = '#222'; c.font = 'bold 110px "Cormorant Garamond", serif'; c.fillText(yr, W / 2, 190); c.font = '20px Inter, sans-serif'; c.fillStyle = '#666'; c.fillText(lang === 'kz' ? 'жыл' : 'год', W / 2, 240); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(.55, .65), new THREE.MeshStandardMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; }

    // --- seated writer figure ("как он сидел") ---
    function figure(style) {
      const S = {
        frock: { coat: 0x15151c, pants: 0x2a2a30, shirt: 0xf2efe6, hair: 0x2a1a10, curly: true },
        soldier: { coat: 0x5f6458, pants: 0x3f4440, shirt: 0x8a8f80, hair: 0x2a1a10 },
        officer: { coat: 0x2f3d2a, pants: 0x1f2a1c, shirt: 0xc9a043, hair: 0x111111 },
        suit: { coat: 0x4a4038, pants: 0x3a3430, shirt: 0xe9e4d6, hair: 0x9a9a9a },
        suit2: { coat: 0x2f3542, pants: 0x262b36, shirt: 0xe9e4d6, hair: 0x3a2a1a },
        prisoner: { coat: 0x2d3033, pants: 0x2a2d30, shirt: 0x2d3033, hair: 0x2d3033, cap: true },
        sweater: { coat: 0x7a3a2a, pants: 0x2a2d36, shirt: 0x7a3a2a, hair: 0x111111 }
      }[style] || {};
      const g = new THREE.Group(), coat = M(S.coat, { roughness: .9 }), pants = M(S.pants), skin = M(0xe0b08a, { roughness: .7 }), hair = M(S.hair);
      const floor = w.room === 'yurt';
      const hipY = floor ? .24 : .55;
      // legs
      if (floor) { [-.12, .12].forEach(sx => { const l = box(.14, .12, .5, pants, sx, .12, -.05, g); l.rotation.y = sx > 0 ? .9 : -.9; }); }
      else { [-.1, .1].forEach(sx => { box(.13, .13, .44, pants, sx, hipY, -.2, g); box(.11, hipY - .02, .12, pants, sx, (hipY - .02) / 2, -.42, g); box(.12, .06, .22, M(0x111111), sx, .03, -.48, g); }); }
      // torso
      const torso = new THREE.Group(); torso.position.set(0, hipY + .02, 0); torso.rotation.x = -.18; g.add(torso);
      box(.38, .5, .22, coat, 0, .27, 0, torso);
      if (style === 'frock' || style === 'soldier') { const tail = box(.36, .28, .04, coat, 0, -.08, .1, torso); tail.rotation.x = .3; }
      box(.12, .14, .02, M(S.shirt), 0, .42, -.115, torso);
      if (style === 'prisoner') { const pt = cvTex(64, 32, (c, W, H) => { c.fillStyle = '#ddd'; c.fillRect(0, 0, W, H); c.fillStyle = '#111'; c.font = 'bold 18px Inter'; c.textAlign = 'center'; c.fillText('Щ-854', W / 2, 23); }); const p = new THREE.Mesh(new THREE.PlaneGeometry(.16, .08), new THREE.MeshStandardMaterial({ map: pt })); p.position.set(0, .3, .115); p.rotation.y = Math.PI; torso.add(p); }
      // head
      const head = new THREE.Group(); head.position.set(0, .62, -.02); torso.add(head);
      box(.08, .08, .08, skin, 0, -.05, 0, head);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(.11, 18, 14), skin); hd.position.y = .07; hd.castShadow = true; head.add(hd);
      const hr = new THREE.Mesh(new THREE.SphereGeometry(.118, 18, 14, 0, Math.PI * 2, 0, Math.PI * .55), hair); hr.position.y = .085; hr.rotation.x = .5; head.add(hr);
      if (S.curly) for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), hair); const a = i / 9 * Math.PI * 2; c.position.set(Math.cos(a) * .1, .1 + Math.random() * .05, Math.sin(a) * .1 + .02); head.add(c); }
      if (S.cap) { cyl(.12, .12, .07, M(0x222528), 0, .17, 0, head); }
      if (style === 'soldier') { cyl(.1, .11, .12, M(0x2a2d2a), 0, .2, 0, head); }
      // arms (right arm writes)
      const arm = (sx, write) => { const sh = new THREE.Group(); sh.position.set(sx * .23, .46, 0); torso.add(sh); const up = box(.09, .3, .09, coat, 0, -.14, -.04, sh); up.rotation.x = .5; const fore = new THREE.Group(); fore.position.set(0, -.27, -.12); sh.add(fore); box(.08, .08, .3, coat, 0, 0, -.14, fore); const hand = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), skin); hand.position.set(0, 0, -.31); fore.add(hand); sh.rotation.x = -.35; if (write) { const pen = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .16, 4), M(0xf5f1e6)); pen.position.set(0, .05, -.32); pen.rotation.x = .5; fore.add(pen); anims.push(t => { fore.rotation.y = Math.sin(t * 7) * .12; fore.rotation.x = Math.sin(t * 14) * .04; }); } return sh; };
      arm(1, true); arm(-1, false);
      anims.push(t => { head.rotation.x = .15 + Math.sin(t * .7) * .05; head.rotation.y = Math.sin(t * .4) * .12; torso.rotation.x = -.18 + Math.sin(t * 1.3) * .015; });
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      if (floor) g.position.set(0, .05, -.55); else g.position.set(-.15, 0, -.62);
      scene.add(g);
      clickable(g, 'figure', w.name[lang], `<p>${EXI.evText ? '<b>' + EXI.ev + '</b> — ' + EXI.evText[lang] + '</p><p>' : ''}${w.short[lang]}</p>`, 'audio', [EXI.evText ? EXI.evText[lang] : '', w.short[lang]]);
      return g;
    }

    const evY = EXI.ev || w.years.slice(0, 4), placeName = w.place[lang].split(' (')[0];
    clickable(calendar(1.0, 2.75, yurt ? -4.7 : -3.95, 0, evY, placeName), 'calendar', evY + ' · ' + placeName, `<p>${EXI.evText ? EXI.evText[lang] : w.short[lang]}</p>`);
    const RX = 4.96; // right wall
    switch (w.id) {
      case 'pushkin':
        tiledStove(4.35, -1.4); samovar(sideTable(3.4, 1.7, .75), .78); globe(-3.9, 2.0); topHat(-.85, top, -1.95); chest(3.2, .3, -1.3, 0x5a2f14);
        figure('frock'); break;
      case 'shevchenko':
        coatOnHook(RX - .05, 2.0, -.2, -Math.PI / 2, 0x5f6458); musket(4.75, 1.2); shako(-.85, top, -1.95); chest(3.4, .9, -1.2, 0x4a3a28);
        figure('soldier'); break;
      case 'dostoevsky':
        coatOnHook(RX - .05, 2.0, .3, -Math.PI / 2, 0x5f6458); samovar(sideTable(3.4, 1.6, .75), .78); chest(3.6, -.4, -1.4);
        figure('soldier'); break;
      case 'valikhanov':
        dombra(3.6, 1.2, -3.05, -.9); saddle(2.9, 1.4); teaSet(-.55, top, -1.55); chest(-3.4, 1.6, 1.2, 0x8b4a1e);
        figure('officer'); break;
      case 'shukhov':
        wallCarpet(RX, 2.0, -.2, -Math.PI / 2); loudspeaker(2.4, 3.0, -3.95); poster(-4.96, 2.3, 1.3, Math.PI / 2, '«Простор»', 'Алма-Ата', '#1f5a8a'); phone(-.8, top, -1.9); newspaper(-.55, top, -1.25, 'ПРАВДА'); globe(3.6, 1.8);
        figure('suit'); break;
      case 'vasiliev':
        loudspeaker(2.4, 3.0, -3.95); poster(4.96, 2.2, -.3, -Math.PI / 2, w.works[1].t[lang], '1933'); gramophone(sideTable(3.4, 1.6, .75), .78); newspaper(-.55, top, -1.25, 'Газета'); chest(3.6, -.2, -1.4);
        figure('suit2'); break;
      case 'solzhenitsyn':
        ironStove(3.2, .6); coatOnHook(RX - .05, 1.9, -.6, -Math.PI / 2, 0x2d3033, 'Щ-854'); mugBread(-.55, top, -1.6); bulb(0, 3.1, -1.3);
        figure('prisoner'); break;
      case 'dombrovsky':
        loudspeaker(2.4, 3.0, -3.95); phone(-.8, top, -1.9); poster(RX, 2.2, -1.2, -Math.PI / 2, w.works[1].t[lang], '1937', '#5a3a1a'); newspaper(-.55, top, -1.25, 'Казахстанская правда');
        figure('suit2'); break;
      case 'suleimenov':
        wallCarpet(RX, 2.0, -.6, -Math.PI / 2); tv(4.3, 1.4, -Math.PI / 2); poster(-4.96, 2.3, 1.3, Math.PI / 2, w.works[0].t[lang], '12.04.1961', '#1f3a7a'); newspaper(-.55, top, -1.25, 'Известия');
        figure('sweater'); break;
      case 'simashko':
        wallCarpet(RX, 2.0, -.2, -Math.PI / 2); scrolls(-.6, top, -1.3); phone(-.85, top, -1.95); globe(3.6, 1.8);
        figure('suit'); break;
    }

    // signature prop on pedestal
    const ped = new THREE.Group(); ped.position.set(-2.2, 0, .6); scene.add(ped);
    cyl(.32, .38, .95, M(0x2a2420, { roughness: .4 }), 0, .475, 0, ped);
    cyl(.36, .36, .05, M(0xb8913c, { metalness: .8, roughness: .3 }), 0, .97, 0, ped);
    const item = makeProp(w.prop.kind); item.position.y = 1.0; ped.add(item); ped.userData.spin = item;
    const pl = new THREE.SpotLight(0xffe2b0, 1.3, 5, .45, .5); pl.position.set(-2.2, 3.6, 1.2); pl.target = item; scene.add(pl);
    clickable(ped, 'prop', w.prop.name[lang], `<p>${w.prop.text[lang]}</p>`, null, [w.prop.name[lang] + '. ' + w.prop.text[lang]]);

    // hologram
    holo = makeHologram(w); holo.position.set(1.9, 0, -.6); holo.rotation.y = -.35; scene.add(holo);
    clickable(holo.userData.hit, 'holo', w.name[lang] + ' · ' + w.years, `<p>${w.bio[lang]}</p>`, 'audio');

    resize();
    const narrow = camera.aspect < 1;
    controls.maxDistance = yurt ? 4.8 : (narrow ? 11 : 8.5);
    if (yurt) camera.position.set(.3, 2.0, narrow ? 3.9 : 3.4); else camera.position.set(.6, 2.4, narrow ? 8.6 : 5.6);
    controls.target.set(0, 1.35, -1); controls.update();
    resize();
  }

  function makeProp(kind) {
    const g = new THREE.Group();
    const gold = M(0xd4a843, { metalness: .9, roughness: .25 }), dark = M(0x1d1d1d, { metalness: .5, roughness: .3 });
    switch (kind) {
      case 'quill': { const q = new THREE.Mesh(new THREE.ConeGeometry(.06, .7, 8), M(0xf7f3e8)); q.position.set(.05, .35, 0); q.rotation.z = -.3; g.add(q); cyl(.09, .11, .14, dark, -.1, .07, 0, g); break; }
      case 'easel': { const p = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .03), M(0xffffff, { map: cvTex(200, 150, (c, W, H) => Scenes.draw(c, W, H, ['sky:dawn', 'sun', 'sea'], 1)) })); p.position.y = .35; p.rotation.x = -.15; g.add(p); [-.15, .15].forEach(x => { const l = box(.03, .5, .03, M(0x6b4a2a), x, .2, .05, g); }); break; }
      case 'shackles': { [-.12, .12].forEach(x => { const r = new THREE.Mesh(new THREE.TorusGeometry(.09, .025, 10, 24), dark); r.position.set(x, .12, 0); r.rotation.x = Math.PI / 2; g.add(r); }); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(.03, .01, 6, 12), dark); l.position.set(-.06 + i * .03, .12, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); } break; }
      case 'compass': { cyl(.18, .18, .05, gold, 0, .05, 0, g); const f = new THREE.Mesh(new THREE.CircleGeometry(.15, 32), M(0xf3ead2)); f.rotation.x = -Math.PI / 2; f.position.y = .08; g.add(f); const n = new THREE.Mesh(new THREE.ConeGeometry(.02, .24, 4), M(0xb3261e)); n.rotation.x = Math.PI / 2; n.position.y = .09; g.add(n); g.userData.needle = n; break; }
      case 'book': { box(.36, .06, .48, M(0x1f3a6b), 0, .04, 0, g); box(.34, .05, .46, M(0xf3e7c8), .01, .04, 0, g); box(.36, .06, .48, M(0x7a1f1f), 0, .1, 0, g).rotation.y = .2; break; }
      case 'salt': { for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(.07 + Math.random() * .07), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .1, transmission: .6, transparent: true, opacity: .9 })); c.position.set((Math.random() - .5) * .25, .08 + Math.random() * .12, (Math.random() - .5) * .25); c.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(c); } break; }
      case 'rosary': { for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), M(0xd9c7a0, { roughness: 1 })); b.position.set(Math.cos(a) * .17, .04, Math.sin(a) * .12); g.add(b); } break; }
      case 'amphora': { const pts = [[0, 0], [.08, 0], [.12, .05], [.17, .2], [.15, .35], [.07, .45], [.06, .55], [.09, .58]].map(p => new THREE.Vector2(p[0], p[1])); const a = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), M(0xb06a3a, { roughness: .7, side: THREE.DoubleSide })); g.add(a); break; }
      case 'rocket': { const b = cyl(.06, .06, .5, M(0xeeeeee, { metalness: .3 }), 0, .3, 0, g); const n = new THREE.Mesh(new THREE.ConeGeometry(.06, .18, 20), M(0xeeeeee)); n.position.y = .64; g.add(n); for (let i = 0; i < 4; i++) { const f = box(.02, .14, .1, M(0xc0392b), Math.cos(i * Math.PI / 2) * .08, .1, Math.sin(i * Math.PI / 2) * .08, g); f.rotation.y = -i * Math.PI / 2; } break; }
      case 'wormwood': { for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.006, .01, .5, 5), M(0x8fa08a)); s.position.set((Math.random() - .5) * .08, .25, (Math.random() - .5) * .08); s.rotation.set((Math.random() - .5) * .5, 0, (Math.random() - .5) * .5); g.add(s); for (let l = 0; l < 4; l++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), M(0xbccdb4)); lf.scale.set(1, .3, .5); lf.position.set(s.position.x + (Math.random() - .5) * .1, .2 + l * .08, s.position.z + (Math.random() - .5) * .1); g.add(lf); } } break; }
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function makeHologram(w) {
    const g = new THREE.Group();
    const img = new Image(); img.src = window.PORTRAITS[w.id];
    const W = 96, H = 128, Hh = 2.1, Ww = Hh * W / H;
    const geo = new THREE.BufferGeometry(), N = W * H;
    const pos = new Float32Array(N * 3), start = new Float32Array(N * 3), col = new Float32Array(N * 3), rnd = new Float32Array(N);
    for (let i = 0; i < N; i++) { start[i * 3] = (Math.random() - .5) * 6; start[i * 3 + 1] = Math.random() * 4; start[i * 3 + 2] = (Math.random() - .5) * 6; rnd[i] = Math.random(); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uF: { value: 0 }, uTint: { value: new THREE.Color(w.color) } },
      vertexShader: `attribute vec3 aStart; attribute float aRnd; varying vec3 vC; varying float vA; uniform float uT; uniform float uF; uniform vec3 uTint;
        void main(){ float f = clamp(uF*1.4 - aRnd*0.4, 0.0, 1.0); f = f*f*(3.0-2.0*f);
          vec3 p = mix(aStart, position, f);
          p.x += sin(uT*2.0 + position.y*8.0)*0.004*f; p.z += sin(uT*3.0+aRnd*20.0)*0.01;
          float glitch = step(0.985, fract(sin(floor(uT*6.0)*12.9898 + position.y*3.0)*43758.5453));
          p.x += glitch*0.05;
          vC = mix(color, uTint, 0.22) * (0.92 + 0.12*sin(position.y*90.0 - uT*5.0));
          vA = 0.25 + 0.75*f;
          vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = (2.4 + aRnd*0.8) * (5.5 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.15,length(d)); gl_FragColor = vec4(vC*1.45, a*vA*0.95); }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending, vertexColors: true
    });
    const pts = new THREE.Points(geo, mat); g.add(pts);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      const ar = img.naturalWidth / img.naturalHeight, tar = W / H; let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
      if (ar > tar) { sw = sh * tar; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / tar; }
      x.drawImage(img, sx, sy, sw, sh, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = j * W + i, r = d[k * 4] / 255, gg = d[k * 4 + 1] / 255, b = d[k * 4 + 2] / 255, lum = .3 * r + .59 * gg + .11 * b;
        const cx = i / W - .5, cy = j / H - .5, ell = Math.max(0, 1 - (cx * cx * 3 + cy * cy * 1.2));
        pos[k * 3] = (i / W - .5) * Ww; pos[k * 3 + 1] = (1 - j / H) * Hh + .45; pos[k * 3 + 2] = lum * .22 + ell * .35;
        col[k * 3] = Math.pow(r, .9); col[k * 3 + 1] = Math.pow(gg, .9); col[k * 3 + 2] = Math.pow(b, .9);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; mat.uniforms.uF.value = 0; g.userData.form = 0;
    };
    // emitter base
    cyl(.55, .65, .12, M(0x1b2333, { metalness: .8, roughness: .3 }), 0, .06, 0, g);
    const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(w.color), transparent: true, opacity: .8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .02, 8, 48), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = .13; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.7, .5, 2.7, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(w.color), transparent: true, opacity: .06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 1.45; g.add(beam);
    const hl = new THREE.PointLight(new THREE.Color(w.color), .8, 4); hl.position.y = 1.4; g.add(hl);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(Ww, Hh + .4, .6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = Hh / 2 + .4; g.add(hit);
    g.userData = { mat, hit, ring, form: 0 };
    return g;
  }

  /* ---------- interaction ---------- */
  function pickObj(e) {
    const r = canvas.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera); const hits = ray.intersectObjects(clickables, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.click) o = o.parent; if (o) return o; }
    return null;
  }
  function setHover(o) {
    if (hovered === o) return;
    const paint = (obj, on) => obj.traverse(m => { if (m.isMesh && m.material && m.material.emissive) { if (on) { m.userData.em = m.material.emissive.getHex(); m.material.emissive.setHex(0x3a2a08); } else if (m.userData.em !== undefined) m.material.emissive.setHex(m.userData.em); } });
    if (hovered) paint(hovered, false); hovered = o; if (o) paint(o, true);
    canvas.style.cursor = o ? 'pointer' : 'grab';
    if (!o) tip.classList.remove('show');
  }
  function move(e) { const o = pickObj(e); setHover(o); if (o) { const r = canvas.getBoundingClientRect(); tip.textContent = o.userData.click.title; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.classList.add('show'); } }
  function click(e) {
    const o = pickObj(e); if (!o) return; const d = o.userData.click;
    if (window.Music) Music.pluckNote(Math.floor(Math.random() * 8));
    info.hidden = false;
    info.innerHTML = `<button class="x" aria-label="close">✕</button><h3>${d.title}</h3>${d.html}` +
      (d.extra === 'audio' ? `<button class="btn btn-gold btn-small" data-act="audio">▶ ${L('audioGuide')}</button>` : '') +
      (d.extra === 'sim' ? `<button class="btn btn-ghost btn-small" data-act="sim">✒️ ${L('simTitle')}</button>` : '');
    const sayTexts = d.say || [...info.querySelectorAll('p')].map(p => p.textContent.trim()).filter(Boolean);
    const sb = document.createElement('button'); sb.className = 'say'; sb.dataset.ico = '🔊'; sb.textContent = '🔊'; info.appendChild(sb);
    sb.onclick = () => Voice.toggle(sb, sayTexts, getLang());
    if (Voice.auto) Voice.say(sayTexts, getLang(), { btn: sb });
    info.querySelector('.x').onclick = () => { info.hidden = true; Voice.stop(); };
    const a = info.querySelector('[data-act]'); if (a) a.onclick = () => onAudio && onAudio(a.dataset.act);
    if (d.key === 'holo' && holo) holo.userData.form = 0;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop); if (!running) return;
    const t = now / 1000, dt = Math.min(0.1, t - (loop.last || t)); loop.last = t;
    controls.update();
    if (holo) { const u = holo.userData; u.form = Math.min(1, u.form + dt * 0.5); u.mat.uniforms.uF.value = u.form; u.mat.uniforms.uT.value = t; u.ring.scale.setScalar(1 + Math.sin(t * 3) * .05); }
    if (flame) { const f = 1 + Math.sin(t * 13) * .08 + Math.sin(t * 7.7) * .06; flame.scale.x = f; candleLight.intensity = 1.25 * f; }
    scene.traverse(o => { if (o.userData && o.userData.spin) o.userData.spin.rotation.y = t * .6; });
    if (scene.userData.anims) scene.userData.anims.forEach(f => f(t));
    if (winTex && Math.floor(t * 15) !== winTex.userData.f) { winTex.userData.f = Math.floor(t * 15); Scenes.draw(winTex.userData.c, 512, 384, winEls, t); winTex.needsUpdate = true; }
    renderer.render(scene, camera);
  }

  return {
    load(w) { init(); info.hidden = true; if (scene) dispose(); build(w); if (!raf) raf = requestAnimationFrame(loop); running = true; },
    pause() { running = false; },
    resume() { if (scene) { running = true; resize(); } },
    resize, makeProp, cvTex
  };
  function dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); }
};
