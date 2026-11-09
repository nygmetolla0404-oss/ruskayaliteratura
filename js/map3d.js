/* 3D-карта Казахстана v2 — медальоны-портреты, 3D-декор, лента времени (three.js r128) */
window.MapView = function (opts) {
  const { canvas, labels, tip, writers, onPick, onHover, getLang } = opts;
  const EX = (window.LIT_EXTRA || { w: {} }).w;
  const LON0 = 67, LAT0 = 48, KX = Math.cos(LAT0 * Math.PI / 180);
  const P = (lon, lat) => [(lon - LON0) * KX, -(lat - LAT0)];
  const DEPTH = 0.7;
  const helper = window.RoomView ? RoomView({ canvas: null, tip: null, info: null, getLang }) : null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050813, 60, 150);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  camera.position.set(0, 34, 3);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 5; controls.maxDistance = 48; controls.maxPolarAngle = Math.PI * 0.44;
  controls.autoRotateSpeed = 0.5;

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a2614, 0.62));
  const sun = new THREE.DirectionalLight(0xffe6bf, 0.95); sun.position.set(-14, 24, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 16, bottom: -16, far: 80 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6fb8ff, 0.35); rim.position.set(14, 8, -16); scene.add(rim);

  /* ---------- stars ---------- */
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 1800; i++) { const r = 120 + Math.random() * 80, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.48; sp.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) - 15, r * Math.sin(ph) * Math.sin(th)); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0.75, fog: false })));

  /* ---------- country shape ---------- */
  const pts = window.KZ_SHAPE.map(([lon, lat]) => { const [x, z] = P(lon, lat); return new THREE.Vector2(x, -z); });
  const shape = new THREE.Shape(pts);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
  const tw = maxX - minX, th2 = maxY - minY;

  // value noise
  const perm = new Uint8Array(512); for (let i = 0; i < 256; i++) perm[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const hsh = (x, y) => perm[(perm[x & 255] + y) & 511] / 255;
  const sm = t => t * t * (3 - 2 * t);
  function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = hsh(xi, yi), b = hsh(xi + 1, yi), c = hsh(xi, yi + 1), d = hsh(xi + 1, yi + 1); const u = sm(xf), v = sm(yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  const fbm = (x, y) => vn(x, y) * .5 + vn(x * 2.1, y * 2.1) * .25 + vn(x * 4.3, y * 4.3) * .15 + vn(x * 8.7, y * 8.7) * .1;
  const STOPS = [[0, [86, 128, 70]], [0.22, [120, 146, 82]], [0.42, [176, 160, 96]], [0.62, [208, 178, 118]], [0.82, [214, 186, 132]], [1, [196, 160, 104]]];
  const lerpC = v => { for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (v - a) / (b - a); return ca.map((c, j) => c + (cb[j] - c) * k); } return STOPS[STOPS.length - 1][1]; };

  function makeTexture() {
    const W = 1600, H = Math.round(W * th2 / tw), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const tx = x => (x - minX) / tw * W, ty = y => (1 - (y - minY) / th2) * H;
    const ll = (lon, lat) => { const [x, z] = P(lon, lat); return [tx(x), ty(-z)]; };
    const id = c.createImageData(W, H), d = id.data, S = 9 / W;
    const lonOf = px => minX / KX + LON0 + px / W * tw / KX;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = fbm(x * S, y * S), hx = fbm((x + 2) * S, y * S), shade = 1 + (h - hx) * 9;
      const lon = lonOf(x), mtn = Math.max(0, (lon - 73) / 14) * Math.max(0, (y / H - 0.55) * 2.2) + Math.max(0, (lon - 82) / 5) * 0.6;
      let col = lerpC(y / H);
      if (lon < 58) col = col.map((cc, j) => cc * (1 - .25) + [224, 196, 140][j] * .25);
      col = col.map((cc, j) => cc * (1 - Math.min(.6, mtn * .5)) + [128, 120, 104][j] * Math.min(.6, mtn * .5));
      const n = (h - .5) * 26, i = (y * W + x) * 4;
      d[i] = Math.min(255, (col[0] + n) * shade); d[i + 1] = Math.min(255, (col[1] + n) * shade); d[i + 2] = Math.min(255, (col[2] + n * .6) * shade); d[i + 3] = 255;
    }
    c.putImageData(id, 0, 0);
    // tulip & feather-grass speckles
    for (let i = 0; i < 2200; i++) { const x = Math.random() * W, y = H * (.25 + Math.random() * .5); c.fillStyle = Math.random() < .08 ? 'rgba(200,60,50,.55)' : 'rgba(255,240,200,.18)'; c.fillRect(x, y, 2, 2); }
    // graticule
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1.2; c.setLineDash([5, 9]);
    for (let lon = 50; lon <= 85; lon += 5) { c.beginPath(); c.moveTo(...ll(lon, 40)); c.lineTo(...ll(lon, 56)); c.stroke(); }
    for (let lat = 42; lat <= 55; lat += 3) { c.beginPath(); c.moveTo(...ll(46, lat)); c.lineTo(...ll(88, lat)); c.stroke(); }
    c.setLineDash([]);
    const river = (arr, w) => { c.beginPath(); arr.forEach((p, i) => { const q = ll(p[0], p[1]); i ? c.lineTo(...q) : c.moveTo(...q); }); c.strokeStyle = 'rgba(30,80,120,.45)'; c.lineWidth = (w || 4) + 3; c.lineCap = c.lineJoin = 'round'; c.stroke(); c.strokeStyle = '#59acd6'; c.lineWidth = w || 4; c.stroke(); };
    river([[84.5, 47.5], [82.6, 49.95], [80.23, 50.41], [78.3, 51.2], [76.95, 52.29], [75.3, 53.4], [74.2, 54.5]], 5);
    river([[68.2, 40.8], [66.7, 42.3], [65.5, 44.8], [63.5, 45.7], [61.6, 46.3]], 4);
    river([[51.37, 51.23], [51.5, 50.2], [51.8, 48.4], [51.9, 47.1], [51.95, 46.9]], 4);
    river([[71.43, 51.13], [70.2, 51.6], [69.2, 52.2], [68.2, 52.9], [67.6, 54.2], [69.15, 54.87]], 3);
    river([[79.8, 44.1], [78.5, 44.3], [77.2, 44.9], [75.6, 45.9], [74.6, 46.35]], 3);
    // soft inner edge glow
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.repeat.set(1 / tw, 1 / th2); tex.offset.set(-minX / tw, -minY / th2);
    return tex;
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 });
  geo.rotateX(-Math.PI / 2);
  const topMat = new THREE.MeshStandardMaterial({ map: makeTexture(), roughness: 0.92 });
  const sideTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c = cv.getContext('2d'); [['#7a5530', 0], ['#5e3f22', .3], ['#8a6236', .45], ['#4a321b', .7], ['#2d1e10', 1]].forEach(([col, p], i, a) => { if (!i) return; const g = c.createLinearGradient(0, a[i - 1][1] * 256, 0, p * 256); g.addColorStop(0, a[i - 1][0]); g.addColorStop(1, col); c.fillStyle = g; c.fillRect(0, a[i - 1][1] * 256, 64, (p - a[i - 1][1]) * 256 + 1); }); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x8a6236, roughness: 0.85, emissive: 0x1e1006 });
  const land = new THREE.Mesh(geo, [topMat, sideMat]); land.receiveShadow = true; land.castShadow = true; scene.add(land);

  const lp = pts.map(p => new THREE.Vector3(p.x, DEPTH + 0.12, -p.y)); lp.push(lp[0].clone());
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: 0xf4d58d, transparent: true, opacity: 0.85 })));

  // ground: soft glow + grid
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); const g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(46,196,214,.32)'); g.addColorStop(1, 'rgba(46,196,214,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(cv); })();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 36), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.38; scene.add(glow);
  const grid = new THREE.GridHelper(70, 35, 0x1c2b55, 0x111a36); grid.position.y = -0.4; grid.material.transparent = true; grid.material.opacity = .45; scene.add(grid);

  /* ---------- water: Caspian, Aral, Balkhash, Zaisan ---------- */
  const waterTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#2b78a8'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(200,235,255,${Math.random() * .25})`; c.lineWidth = 1 + Math.random() * 1.5; const x = Math.random() * 256, y = Math.random() * 256; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 3, x + 16 + Math.random() * 10, y); c.stroke(); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t; })();
  const waterMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0x9fd4ff, roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.93 });
  function water(poly, y, rep) {
    const s = new THREE.Shape(poly.map(([lo, la]) => { const [x, z] = P(lo, la); return new THREE.Vector2(x, -z); }));
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (rep || .4), uv.getY(i) * (rep || .4));
    const m = new THREE.Mesh(g, waterMat); m.position.y = y; m.receiveShadow = true; scene.add(m); return m;
  }
  water([[49.0, 46.6], [50.2, 46.9], [51.2, 47.05], [52.4, 46.9], [53.1, 46.4], [53.2, 45.3], [52.3, 45.0], [51.3, 44.5], [50.9, 44.0], [51.3, 43.2], [52.6, 42.4], [52.8, 41.4], [52.9, 40.4], [53.6, 39.6], [53.9, 38.6], [53.9, 37.3], [52.2, 36.8], [51.0, 36.8], [49.9, 37.4], [48.9, 38.3], [49.0, 39.4], [49.4, 40.2], [50.3, 40.4], [49.6, 40.7], [48.8, 41.6], [47.9, 42.5], [47.5, 43.2], [47.4, 44.3], [46.8, 44.8], [47.3, 45.6], [48.2, 46.2]], -0.05, .3);
  water([[59.4, 46.7], [60.6, 46.8], [61.6, 46.3], [61.2, 45.6], [60.2, 45.4], [59.3, 45.8]], DEPTH + 0.115);
  water([[73.4, 46.4], [74.2, 46.85], [75.4, 46.75], [76.6, 46.6], [78.2, 46.55], [79.3, 46.35], [79.1, 46.05], [77.8, 46.2], [76.4, 46.3], [75.2, 46.4], [74.4, 46.2], [73.7, 45.9]], DEPTH + 0.115);
  water([[83.6, 48.05], [84.4, 48.15], [84.9, 47.95], [84.1, 47.8]], DEPTH + 0.115);

  /* ---------- 3D decorations ---------- */
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8, flatShading: true }, o || {}));
  const at = (lon, lat, y) => { const [x, z] = P(lon, lat); return new THREE.Vector3(x, (y || 0) + DEPTH + 0.1, z); };
  const add = (m, pos) => { m.position.copy(pos); m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(m); return m; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // mountains
  const mtnMat = M(0x8a8173, { roughness: 1 }), snowMat = M(0xffffff, { roughness: .5 });
  const addPeak = (lon, lat, h) => { const g = new THREE.Group(), r = h * .55, ry = Math.random() * 3; const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mtnMat); m.position.y = h / 2 - .1; m.rotation.y = ry; g.add(m); const s = new THREE.Mesh(new THREE.ConeGeometry(r * .4, h * .4, 6), snowMat); s.position.y = h * .8 - .09; s.rotation.y = ry; g.add(s); add(g, at(lon, lat)); };
  [[74.6, 42.9, .8], [75.6, 42.85, 1], [76.5, 43.0, 1.2], [77.4, 42.95, 1.25], [78.3, 42.9, 1.05], [79.2, 42.85, 1], [80.1, 42.6, 1.1], [76.9, 42.7, .9], [78.8, 42.6, .8], [79.7, 45.15, .65], [80.6, 45.3, .7], [81.4, 45.25, .6], [85.6, 49.2, 1], [86.3, 49.1, .9], [84.8, 49.6, .7], [85.9, 49.6, .8], [82.8, 47.1, .5], [70.2, 42.0, .55], [69.8, 42.25, .45]].forEach(a => addPeak(...a));
  // trees
  const leaf = M(0x2f6b3a), leaf2 = M(0x3f7f45), trunk = M(0x5a3a1e);
  const tree = (lon, lat, s) => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, .14, 5), trunk); t.position.y = .07; g.add(t); [[.17, .3, .26], [.13, .24, .42]].forEach(([r, h, y], i) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), i ? leaf2 : leaf); c.position.y = y; g.add(c); }); g.scale.setScalar(s || 1); add(g, at(lon, lat)); };
  const forest = (lon, lat, n, sp) => { for (let i = 0; i < n; i++) tree(lon + rnd(-sp, sp), lat + rnd(-sp * .6, sp * .6), rnd(.8, 1.3)); };
  forest(70.3, 53.1, 14, .6); forest(68.5, 54.3, 10, 1.4); forest(72.5, 54.0, 6, .8); forest(85.3, 49.7, 14, 1.0); forest(77.0, 43.55, 10, 1.2); forest(81.5, 50.2, 8, .9); forest(63.5, 52.8, 5, .8);
  // yurts
  const yurtM = M(0xf2ebdc, { flatShading: false }), red = M(0xb2452f), wood = M(0x7a4520);
  const yurt = (lon, lat, s) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .16, 16), yurtM); b.position.y = .08; g.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(.215, .14, 16), yurtM); r.position.y = .23; g.add(r); const band = new THREE.Mesh(new THREE.CylinderGeometry(.205, .205, .025, 16), red); band.position.y = .12; g.add(band); const d = new THREE.Mesh(new THREE.BoxGeometry(.07, .11, .02), red); d.position.set(0, .055, .2); g.add(d); g.scale.setScalar(s || 1); g.rotation.y = rnd(0, 6); add(g, at(lon, lat)); };
  [[68, 48.3], [68.4, 48.1], [67.7, 48.0], [62, 47.4], [62.4, 47.6], [73.5, 45.8], [73.9, 45.9], [55, 48.2], [55.4, 48.4], [58.5, 50.6], [77.5, 47.6], [78, 47.8]].forEach(([a, b]) => yurt(a, b, rnd(1, 1.4)));
  // camels (caravan)
  const camelM = M(0xc79a5a);
  const camel = () => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, .12), camelM); body.position.y = .2; g.add(body); [-.06, .06].forEach(x => { const h = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), camelM); h.position.set(x, .27, 0); g.add(h); }); const n = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .2, 5), camelM); n.position.set(.17, .3, 0); n.rotation.z = -.5; g.add(n); const hd = new THREE.Mesh(new THREE.BoxGeometry(.09, .05, .05), camelM); hd.position.set(.24, .4, 0); g.add(hd); g.userData.legs = []; [[-.1, .04], [-.1, -.04], [.1, .04], [.1, -.04]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .16, 4), camelM); l.position.set(x, .08, z); g.add(l); g.userData.legs.push(l); }); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g; };
  const cPath = new THREE.CatmullRomCurve3([[65.5, 44.85], [66.6, 44.3], [67.5, 43.8], [68.25, 43.3], [69.0, 42.8], [69.6, 42.35], [68.6, 42.9], [67.3, 43.9], [66.1, 44.6]].map(([a, b]) => at(a, b, -.1)), true);
  const caravan = [0, 1, 2, 3].map(() => camel());
  // horses
  const horseCols = [0x5a3a22, 0x8a5a2b, 0x2a1a10, 0xd8c8a8, 0x6b4428];
  const horses = [];
  for (let i = 0; i < 7; i++) { const hm = M(horseCols[i % 5]); const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.24, .09, .08), hm); b.position.y = .16; g.add(b); const n = new THREE.Mesh(new THREE.BoxGeometry(.06, .13, .05), hm); n.position.set(.13, .23, 0); n.rotation.z = -.5; g.add(n); const hd = new THREE.Mesh(new THREE.BoxGeometry(.08, .04, .04), hm); hd.position.set(.18, .29, 0); g.add(hd); [[-.08, .03], [-.08, -.03], [.08, .03], [.08, -.03]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .13, 4), hm); l.position.set(x, .06, z); g.add(l); }); g.rotation.y = rnd(0, 6); g.userData.ph = rnd(0, 6); g.userData.head = n; add(g, at(71 + rnd(-.8, .8), 49.6 + rnd(-.5, .5), -.1)); horses.push(g); }
  // Baiterek (Astana)
  (() => { const g = new THREE.Group(); const w = M(0xf4f4f4, { flatShading: false }); const t = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 1.1, 8), w); t.position.y = .55; g.add(t); for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .9, 4), w); const a = i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * .08, .7, Math.sin(a) * .08); s.rotation.set(Math.sin(a) * .2, 0, -Math.cos(a) * .2); g.add(s); } const ball = new THREE.Mesh(new THREE.SphereGeometry(.13, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffc94d, metalness: .9, roughness: .15, emissive: 0x6a4a00 })); ball.position.y = 1.18; g.add(ball); add(g, at(71.43, 51.13, -.1)); const l = new THREE.PointLight(0xffd27a, .6, 3); l.position.copy(at(71.43, 51.13, 1.3)); scene.add(l); })();
  // Khoja Ahmed Yasawi mausoleum (Turkestan)
  (() => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.42, .22, .3), M(0xd9b98a)); b.position.y = .11; g.add(b); const p = new THREE.Mesh(new THREE.BoxGeometry(.18, .32, .06), M(0xd9b98a)); p.position.set(0, .16, .17); g.add(p); const d = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2fb3b8, { flatShading: false, metalness: .3, roughness: .3 })); d.position.set(.08, .22, -.04); g.add(d); const d2 = d.clone(); d2.scale.setScalar(.7); d2.position.set(-.12, .22, -.04); g.add(d2); add(g, at(68.27, 43.3, -.1)); })();
  // Baikonur rocket
  const rocket = (() => { const g = new THREE.Group(); const w = M(0xeeeeee, { flatShading: false }); const b = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .6, 12), w); b.position.y = .32; g.add(b); const n = new THREE.Mesh(new THREE.ConeGeometry(.05, .16, 12), w); n.position.y = .7; g.add(n); for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, .3, 8), w); const a = i / 4 * Math.PI * 2 + .78; s.position.set(Math.cos(a) * .07, .17, Math.sin(a) * .07); g.add(s); } const tw2 = new THREE.Mesh(new THREE.BoxGeometry(.05, .8, .05), M(0xb33a2a)); tw2.position.set(.16, .4, 0); g.add(tw2); const pad = new THREE.Mesh(new THREE.CylinderGeometry(.22, .25, .04, 16), M(0x666666)); pad.position.y = .02; g.add(pad); return add(g, at(63.31, 45.96, -.1)); })();
  // clouds
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .55, roughness: 1, depthWrite: false });
  const clouds = [];
  for (let i = 0; i < 7; i++) { const g = new THREE.Group(); for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rnd(.25, .45), 12, 8), cloudMat); s.position.set(k * .45 - .9, rnd(-.1, .15), rnd(-.25, .25)); g.add(s); } g.position.set(rnd(-16, 16), rnd(7, 9), rnd(-8, 8)); g.scale.set(1, .55, .8); g.userData.v = rnd(.15, .35); scene.add(g); clouds.push(g); }
  // eagle (бүркіт)
  const eagle = (() => { const g = new THREE.Group(), m = M(0x3a2a1a, { side: THREE.DoubleSide }); const body = new THREE.Mesh(new THREE.ConeGeometry(.06, .3, 5), m); body.rotation.x = Math.PI / 2; g.add(body); const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.08, 0, 0, .08, .55, 0, 0], 3)); wg.computeVertexNormals(); const L = new THREE.Mesh(wg, m), R = new THREE.Mesh(wg, m); R.rotation.y = Math.PI; g.add(L, R); g.userData = { L, R }; scene.add(g); return g; })();

  /* ---------- portrait medallion pins ---------- */
  const pins = [], hitObjs = [];
  function medallionTex(w, lang) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 330; const c = cv.getContext('2d');
    const img = new Image(); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    const draw = () => {
      c.clearRect(0, 0, 256, 330);
      c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 16;
      c.fillStyle = '#c9a043'; c.beginPath(); c.arc(128, 122, 116, 0, 7); c.fill(); c.shadowBlur = 0;
      const g = c.createLinearGradient(0, 6, 0, 238); g.addColorStop(0, '#fbe6a4'); g.addColorStop(.5, '#c9a043'); g.addColorStop(1, '#7a5a1c');
      c.fillStyle = g; c.beginPath(); c.arc(128, 122, 116, 0, 7); c.fill();
      c.fillStyle = w.color; c.beginPath(); c.arc(128, 122, 104, 0, 7); c.fill();
      c.save(); c.beginPath(); c.arc(128, 122, 96, 0, 7); c.clip();
      if (img.complete && img.naturalWidth) { const s = 192 / Math.min(img.naturalWidth, img.naturalHeight * .9); c.drawImage(img, 128 - img.naturalWidth * s / 2, 26, img.naturalWidth * s, img.naturalHeight * s); } else { c.fillStyle = '#222'; c.fillRect(0, 0, 256, 256); }
      c.restore();
      // ribbon
      const name = w.name[lang].split(' ').slice(-1)[0]; c.font = '700 34px Inter, sans-serif'; const tw = Math.max(150, c.measureText(name).width + 40);
      c.fillStyle = 'rgba(10,15,30,.92)'; c.strokeStyle = w.color; c.lineWidth = 4;
      const x0 = 128 - tw / 2, y0 = 248; c.beginPath(); c.moveTo(x0 + 16, y0); c.lineTo(x0 + tw - 16, y0); c.quadraticCurveTo(x0 + tw, y0, x0 + tw, y0 + 16); c.lineTo(x0 + tw, y0 + 34); c.quadraticCurveTo(x0 + tw, y0 + 50, x0 + tw - 16, y0 + 50); c.lineTo(x0 + 16, y0 + 50); c.quadraticCurveTo(x0, y0 + 50, x0, y0 + 34); c.lineTo(x0, y0 + 16); c.quadraticCurveTo(x0, y0, x0 + 16, y0); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(name, 128, y0 + 37);
      c.font = '600 22px Inter, sans-serif'; c.fillStyle = '#f4d58d'; c.fillText(w.years, 128, y0 + 74);
      t.needsUpdate = true;
    };
    img.onload = draw; img.src = window.PORTRAITS[w.id]; draw();
    t.userData = { draw }; return t;
  }
  // cluster offsets
  const bases = writers.map(w => { const [x, z] = P(w.lon, w.lat); return { w, x, z }; });
  const clusters = []; bases.forEach(b => { let c = clusters.find(c => c.some(o => Math.hypot(o.x - b.x, o.z - b.z) < 1.5)); if (!c) clusters.push(c = []); c.push(b); });
  clusters.forEach(c => { c.sort((a, b) => a.x - b.x); c.forEach((b, k) => { b.dx = (k - (c.length - 1) / 2) * 1.45; b.h = c.length > 1 ? 2.1 : 1.7; }); });

  bases.forEach(({ w, x, z, dx, h }) => {
    const col = new THREE.Color(w.color);
    const g = new THREE.Group(); g.position.set(x, DEPTH + 0.1, z); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .06, 20), new THREE.MeshStandardMaterial({ color: 0xc9a043, metalness: .8, roughness: .3 })); base.position.y = .03; base.castShadow = true; g.add(base);
    const top = new THREE.Vector3(dx, h, 0), dir = top.clone().setY(top.y - .05), len = dir.length();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe9cf86, metalness: .7, roughness: .3, transparent: true });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, len, 8), poleMat); pole.position.copy(dir.clone().multiplyScalar(.5)); pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); pole.castShadow = true; g.add(pole);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.22, .34, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .02; g.add(ring);
    const tex = medallionTex(w, getLang());
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(1.55, 1.55 * 330 / 256, 1); sprite.center.set(.5, .14); sprite.position.copy(top); sprite.renderOrder = 10; g.add(sprite);
    sprite.userData.w = w; hitObjs.push(sprite);
    let prop = null;
    if (helper) { prop = helper.makeProp(w.prop.kind); prop.scale.setScalar(1.25); prop.position.set(.38, .02, .3); g.add(prop); }
    const light = new THREE.PointLight(col, .5, 2.5); light.position.set(0, .4, 0); g.add(light);
    pins.push({ w, g, sprite, ring, pole, prop, light, tex, top, ex: EX[w.id] || {}, op: 1, target: 1, inKz: true, phase: Math.random() * 6, hov: 0 });
  });

  const cities = [['Астана', 71.43, 51.13], ['Шымкент', 69.6, 42.32], ['Ақтөбе', 57.2, 50.28], ['Атырау', 51.9, 47.1], ['Қарағанды', 73.1, 49.8], ['Өскемен', 82.6, 49.95], ['Ақтау', 51.2, 43.65], ['Қостанай', 63.62, 53.2], ['Қызылорда', 65.5, 44.85], ['Түркістан', 68.27, 43.3], ['Байқоңыр', 63.31, 45.96], ['Каспий', 50.5, 42.5], ['Балқаш', 76.2, 46.2]];
  const cityEls = cities.map(([n, lon, lat]) => { const el = document.createElement('div'); el.className = 'pin-label city'; el.textContent = (n === 'Астана' ? '★ ' : (n === 'Каспий' || n === 'Балқаш') ? '' : '• ') + n; labels.appendChild(el); const [x, z] = P(lon, lat); return { el, v: new THREE.Vector3(x, n === 'Каспий' ? 0 : DEPTH + 0.15, z) }; });

  function setLabels() { const lang = getLang(); pins.forEach(p => { const tex = medallionTex(p.w, lang); p.sprite.material.map.dispose(); p.sprite.material.map = tex; p.sprite.material.needsUpdate = true; }); }

  /* ---------- filters: year & group ---------- */
  let year = null, group = 'all';
  function refresh() {
    pins.forEach(p => {
      const e = p.ex; let t = 1, inKz = true;
      if (group !== 'all' && e.group !== group) t = 0;
      else if (year != null) {
        const alive = year >= e.born && year <= (e.died || 2100);
        inKz = year >= e.kzFrom && year <= e.kzTo;
        t = !alive ? 0 : inKz ? 1 : .28;
      }
      p.target = t; p.inKz = inKz;
    });
  }

  /* ---------- interaction ---------- */
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let hovered = null, downAt = null;
  function hover(w) {
    hovered = w; canvas.style.cursor = w ? 'pointer' : '';
    onHover && onHover(w);
    if (!w) { tip.classList.remove('show'); return; }
    const lang = getLang(), e = EX[w.id] || {}, L = window.I18N[lang];
    let st = ''; if (year != null) st = `<small style="color:${year >= e.kzFrom && year <= e.kzTo ? '#9df0c3' : '#a9b0c8'}">${year}: ${year < e.born ? L.notBorn : (year >= e.kzFrom && year <= e.kzTo ? L.inKz : L.notInKz)}</small>`;
    tip.innerHTML = `<img src="${window.PORTRAITS[w.id]}" alt=""><div><b>${w.name[lang]}</b><small>${w.place[lang]} · ${w.years}</small><small>${e.evText ? e.ev + ' — ' + e.evText[lang] : w.short[lang]}</small>${st}</div>`;
    tip.classList.add('show');
  }
  function pick(e) {
    const r = canvas.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(hitObjs.filter(s => pins.find(p => p.sprite === s).op > .2));
    return hits[0] ? hits[0].object.userData.w : null;
  }
  canvas.addEventListener('pointermove', e => {
    const w = pick(e); if (w !== hovered) hover(w);
    if (w) { const r = canvas.getBoundingClientRect(); let x = e.clientX - r.left + 18, y = e.clientY - r.top + 18; if (x + 280 > r.width) x -= 300; if (y + 120 > r.height) y -= 130; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  });
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; const w = pick(e); if (w && onPick) onPick(w); });
  canvas.addEventListener('pointerleave', () => hover(null));

  /* ---------- camera ---------- */
  let anim = null;
  function flyTo(pos, target, dur, cb) { anim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, s: performance.now(), d: dur || 1400, cb }; }
  const fit = () => Math.max(1, 1.25 / (camera.aspect || 1.6));
  const VIEW3D = () => { const f = fit(); controls.maxDistance = 48 * f; flyTo(new THREE.Vector3(1, 21 * f, 22 * f), new THREE.Vector3(1.6, 0, 2.2)); };
  const VIEWTOP = () => { const f = fit(); controls.maxDistance = 48 * f; flyTo(new THREE.Vector3(0, 30 * f, 0.6), new THREE.Vector3(0, 0, 0)); };
  function focus(w, cb) {
    const p = pins.find(p => p.w === w); if (!p) return cb && cb();
    const wp = p.g.position.clone().add(p.top);
    flyTo(new THREE.Vector3(wp.x + 1.2, wp.y + 3.2, wp.z + 4.6), new THREE.Vector3(wp.x, wp.y - .6, wp.z), 1100, cb);
    p.hov = 1; setTimeout(() => { p.hov = 0; }, 1800);
  }

  /* ---------- loop ---------- */
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 600 ? 52 : 40; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();
  let visible = true; new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(canvas);
  const v = new THREE.Vector3();
  function place(el, vec) { v.copy(vec).project(camera); if (v.z > 1) { el.style.opacity = 0; return; } el.style.opacity = ''; el.style.left = ((v.x + 1) / 2 * canvas.clientWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * canvas.clientHeight) + 'px'; }
  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop); if (!visible) return;
    const t = now / 1000, dt = Math.min(.05, t - last || 0); last = t;
    if (anim) { const k = Math.min(1, (now - anim.s) / anim.d), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; camera.position.lerpVectors(anim.p0, anim.p1, e); controls.target.lerpVectors(anim.t0, anim.t1, e); if (k >= 1) { const cb = anim.cb; anim = null; cb && cb(); } }
    controls.update();
    waterTex.offset.set(t * .01, t * .006);
    pins.forEach(p => {
      p.op += (p.target - p.op) * Math.min(1, dt * 6);
      const s = Math.max(.001, p.op);
      p.g.visible = p.op > .02;
      p.sprite.material.opacity = Math.min(1, p.op * 1.1); p.pole.material.opacity = p.op;
      const hv = (hovered === p.w || p.hov) ? 1.18 : 1;
      p.sprite.scale.set(1.55 * hv * (0.6 + .4 * Math.min(1, s)), 1.55 * 330 / 256 * hv * (0.6 + .4 * Math.min(1, s)), 1);
      p.sprite.position.y = p.top.y + Math.sin(t * 1.6 + p.phase) * .06;
      const pulse = ((t + p.phase) % 2) / 2; p.ring.scale.setScalar(1 + pulse * (p.inKz && year != null ? 3 : 1.8)); p.ring.material.opacity = .8 * (1 - pulse) * p.op;
      if (p.prop) { p.prop.rotation.y = t * .5 + p.phase; p.prop.visible = p.op > .5; }
      p.light.intensity = .5 * p.op;
    });
    // caravan
    caravan.forEach((c, i) => { const u = ((t * .012) - i * .012 + 10) % 1; const pos = cPath.getPointAt(u), nx = cPath.getPointAt((u + .002) % 1); c.position.copy(pos); c.lookAt(nx); c.rotateY(-Math.PI / 2); c.userData.legs.forEach((l, k) => { l.rotation.z = Math.sin(t * 6 + k * 1.6 + i) * .35; }); });
    horses.forEach(h => { h.userData.head.rotation.z = -.5 - Math.max(0, Math.sin(t * .8 + h.userData.ph)) * .7; });
    clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 20) c.position.x = -20; });
    const ea = t * .25; eagle.position.set(4 + Math.cos(ea) * 5, 3.6 + Math.sin(t * .7) * .3, 1 + Math.sin(ea) * 3.5); eagle.rotation.set(0, -ea, Math.sin(t) * .1); const fl = Math.sin(t * 5) * .45; eagle.userData.L.rotation.x = fl; eagle.userData.R.rotation.x = -fl;
    rocket.rotation.y = t * .2;
    const dist = camera.position.distanceTo(controls.target);
    cityEls.forEach(c => { place(c.el, c.v); if (dist > 40) c.el.style.opacity = 0; });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
  setTimeout(VIEW3D, 300);

  return {
    view3d: VIEW3D, viewTop: VIEWTOP, focus, setLabels,
    spin() { controls.autoRotate = !controls.autoRotate; return controls.autoRotate; },
    highlight(w) { pins.forEach(p => { p.hov = p.w === w ? 1 : 0; }); },
    setYear(y) { year = y; refresh(); }, setGroup(g) { group = g; refresh(); }
  };
};
