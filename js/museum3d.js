/* Виртуальный литературный музей — прогулка от первого лица */
window.MuseumView = function (opts) {
  const { canvas, tip, card, help, pad, writers, getLang, onOpenWriter } = opts;
  const helper = RoomView({ canvas: null, tip: null, info: null, getLang });
  let renderer, scene, camera, raf, running = false, built = false, lang = null;
  let yaw = 0, pitch = 0, keys = {}, clickables = [], hovered = null, inspect = null, last = 0, drag = null, bob = 0;
  const pos = new THREE.Vector3(0, 1.65, 16);
  const HALL = { w: 14, l: 40, h: 5.5 };
  const obstacles = [];
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const L = k => window.I18N[getLang()][k];
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .7 }, o || {}));
  const box = (w, h, d, m, x, y, z, p) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (p || scene).add(b); return b; };

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    camera = new THREE.PerspectiveCamera(70, 1, .05, 120); camera.rotation.order = 'YXZ';
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => { if (!running) return; keys[e.code] = true; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); if (e.code === 'Escape') { inspect ? endInspect() : opts.onExit && opts.onExit(); } });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        if (inspect) { inspect.obj.rotation.y += dx * .01; inspect.obj.rotation.x += dy * .01; }
        else { yaw -= dx * .0042; pitch = Math.max(-1.1, Math.min(1.1, pitch - dy * .0042)); }
      } else hoverAt(e);
    });
    canvas.addEventListener('pointerup', e => { if (drag && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) clickAt(e); drag = null; });
    canvas.addEventListener('wheel', e => { if (inspect) { inspect.dist = Math.max(.6, Math.min(2, inspect.dist + e.deltaY * .001)); } }, { passive: true });
    pad.querySelectorAll('button').forEach(b => {
      const k = { f: 'KeyW', b: 'KeyS', l: 'KeyA', r: 'KeyD' }[b.dataset.mv];
      b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { keys[k] = false; }));
    });
  }
  function resize() { if (!renderer) return; const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  function tex(w, h, fn, rep) { const t = helper.cvTex(w, h, fn, rep); return t; }
  function build() {
    lang = getLang(); clickables = []; obstacles.length = 0;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0a0f); scene.fog = new THREE.Fog(0x0b0a0f, 18, 46);
    scene.add(new THREE.AmbientLight(0xfff2e0, .35));
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a2614, .45));
    const { w: W, l: Ln, h: H } = HALL;
    // floor — parquet herringbone
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, Ln), M(0xffffff, { roughness: .45, map: tex(512, 512, (c, w, h) => { c.fillStyle = '#5a3a20'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 128) { c.fillStyle = `hsl(28,${40 + Math.random() * 15}%,${28 + Math.random() * 10}%)`; const o = (y / 32) % 2 ? 64 : 0; c.fillRect(x + o, y, 124, 30); if (o) c.fillRect(x - 64, y, 60, 30); } }, [4, 10]) }));
    fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    // carpet runner with ornament
    const run = new THREE.Mesh(new THREE.PlaneGeometry(3, Ln - 4), M(0xffffff, { map: tex(256, 1024, (c, w, h) => { c.fillStyle = '#6e1a1a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e3b55b'; c.lineWidth = 6; c.strokeRect(12, 12, w - 24, h - 24); c.lineWidth = 4; for (let y = 60; y < h; y += 110) { c.beginPath(); c.moveTo(w / 2, y + 30); c.lineTo(w / 2, y); c.bezierCurveTo(w / 2, y - 30, w / 2 - 50, y - 30, w / 2 - 48, y); c.moveTo(w / 2, y); c.bezierCurveTo(w / 2, y - 30, w / 2 + 50, y - 30, w / 2 + 48, y); c.stroke(); } }) }));
    run.rotation.x = -Math.PI / 2; run.position.y = .01; scene.add(run);
    // walls
    const wallTex = tex(256, 256, (c, w, h) => { c.fillStyle = '#1f3b36'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(227,181,91,.12)'; c.lineWidth = 2; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } }, [10, 2]);
    const wm = M(0xffffff, { map: wallTex });
    [[-W / 2, Math.PI / 2], [W / 2, -Math.PI / 2]].forEach(([x, r]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(Ln, H), wm); m.position.set(x, H / 2, 0); m.rotation.y = r; m.receiveShadow = true; scene.add(m); box(.1, 1.1, Ln, M(0x2a1a10), x - Math.sign(x) * .05, .55, 0); box(.12, .08, Ln, M(0xb8913c, { metalness: .8, roughness: .3 }), x - Math.sign(x) * .06, 1.12, 0); });
    // end walls
    const title = tex(1024, 400, (c, w, h) => { c.fillStyle = '#16120e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e3b55b'; c.lineWidth = 6; c.strokeRect(20, 20, w - 40, h - 40); c.fillStyle = '#f4d58d'; c.textAlign = 'center'; c.font = '700 64px "Cormorant Garamond", serif'; c.fillText(lang === 'kz' ? 'Қазақстанда туған' : 'Русская литература,', w / 2, 160); c.fillText(lang === 'kz' ? 'орыс әдебиеті' : 'рождённая в Казахстане', w / 2, 240); c.font = '500 30px Inter, sans-serif'; c.fillStyle = '#a9b0c8'; c.fillText(lang === 'kz' ? 'Виртуалды әдеби мұражай' : 'Виртуальный литературный музей', w / 2, 320); });
    const endM = M(0x241c26);
    [-Ln / 2, Ln / 2].forEach((z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), endM); m.position.set(0, H / 2, z); m.rotation.y = i ? Math.PI : 0; scene.add(m); });
    const tb = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.73), new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: .35 })); tb.position.set(0, 3, -Ln / 2 + .02); scene.add(tb);
    // ceiling with skylights
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, Ln), M(0x15131a)); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);
    for (let z = -Ln / 2 + 4; z < Ln / 2; z += 8) { const s = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ color: 0xcfe0ff })); s.rotation.x = Math.PI / 2; s.position.set(0, H - .01, z); scene.add(s); }
    // shanyrak chandelier
    const sh = new THREE.Group(); sh.position.set(0, H - .9, 0); scene.add(sh);
    const gold = M(0xc9a043, { metalness: .9, roughness: .25 });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.4, .06, 10, 64), gold); r1.rotation.x = Math.PI / 2; sh.add(r1);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, .06, .06), gold); b.rotation.y = i * Math.PI / 3; b.position.y = .25; sh.add(b); const b2 = b.clone(); b2.rotation.y += Math.PI / 6; b2.position.y = .3; sh.add(b2); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })); bulb.position.set(Math.cos(a) * 1.4, -.1, Math.sin(a) * 1.4); sh.add(bulb); }
    const chl = new THREE.PointLight(0xffd9a0, 1.1, 18, 2); chl.position.set(0, H - 1.2, 0); scene.add(chl);
    sh.userData.spin = true; scene.userData.sh = sh;
    // central 3D map of Kazakhstan on a plinth
    const mapG = new THREE.Group(); mapG.position.set(0, 0, 0); scene.add(mapG);
    box(4.2, .9, 2.6, M(0x1a1410, { roughness: .4 }), 0, .45, 0, mapG); obstacles.push({ x: 0, z: 0, rx: 2.5, rz: 1.7 });
    const pts = window.KZ_SHAPE.map(([lo, la]) => new THREE.Vector2((lo - 67) * .66 * .13, (la - 48) * .13));
    const mg = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .08, bevelEnabled: false }); mg.rotateX(-Math.PI / 2);
    const mm = new THREE.Mesh(mg, M(0xc9a764, { metalness: .3, roughness: .5, emissive: 0x2a1a05 })); mm.position.y = .92; mapG.add(mm);
    writers.forEach(w => { const d = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(w.color) })); d.position.set((w.lon - 67) * .66 * .13, 1.05, -(w.lat - 48) * .13); mapG.add(d); });
    const mapSpot = new THREE.SpotLight(0xffffff, 1.2, 10, .5, .5); mapSpot.position.set(0, H - .2, 0); mapSpot.target = mm; scene.add(mapSpot);
    mapG.userData.click = { type: 'map' }; clickables.push(mapG);

    // exhibits: portraits on walls + props on pedestals
    writers.forEach((w, i) => {
      const side = i % 2 ? 1 : -1, z = -Ln / 2 + 5 + Math.floor(i / 2) * 7.2, x = side * (W / 2 - .06);
      const g = new THREE.Group(); g.position.set(x, 2.55, z); g.rotation.y = -side * Math.PI / 2; scene.add(g);
      const img = new Image(); const t = new THREE.Texture(img); t.encoding = THREE.sRGBEncoding; img.onload = () => { t.needsUpdate = true; const ar = img.naturalWidth / img.naturalHeight; pic.scale.x = ar / .75; frameAdj(ar); }; img.src = window.PORTRAITS[w.id];
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); pic.position.z = .07; g.add(pic);
      const fr = new THREE.Group(); g.add(fr);
      const fm = M(0xb58b3e, { metalness: .85, roughness: .3 });
      function frameAdj(ar) { fr.clear(); const pw = 1.5 * ar / .75, ph = 2; [[0, ph / 2 + .1, pw + .4, .2], [0, -ph / 2 - .1, pw + .4, .2]].forEach(([fx, fy, a, b]) => box(a, b, .14, fm, fx, fy, .05, fr)); [[-pw / 2 - .1], [pw / 2 + .1]].forEach(([fx]) => box(.2, ph + .4, .14, fm, fx, 0, .05, fr)); }
      frameAdj(.75);
      const plaque = helper.cvTex(512, 160, (c, cw, ch) => { c.fillStyle = '#1a140c'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#c9a043'; c.lineWidth = 4; c.strokeRect(6, 6, cw - 12, ch - 12); c.fillStyle = '#f4d58d'; c.textAlign = 'center'; c.font = '700 44px "Cormorant Garamond", serif'; c.fillText(w.name[lang], cw / 2, 70); c.font = '500 26px Inter, sans-serif'; c.fillStyle = '#c8c8d0'; c.fillText(w.years + ' · ' + w.place[lang], cw / 2, 118); });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .44), new THREE.MeshStandardMaterial({ map: plaque })); pl.position.set(0, -1.42, .2); g.add(pl);
      const sp = new THREE.SpotLight(0xfff0d0, 1.4, 9, .38, .6); sp.position.set(x - side * 2.6, H - .3, z); sp.target = pic; scene.add(sp);
      g.userData.click = { type: 'portrait', w }; clickables.push(g);
      // pedestal with prop
      const px = side * (W / 2 - 2.3);
      const ped = new THREE.Group(); ped.position.set(px, 0, z); scene.add(ped);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.34, .4, 1.05, 24), M(0xece4d4, { roughness: .35 })); col.position.y = .525; col.castShadow = true; ped.add(col);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 24), fm); cap.position.y = 1.07; ped.add(cap);
      const item = helper.makeProp(w.prop.kind); item.position.y = 1.1; ped.add(item);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .9, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .1, roughness: 0, side: THREE.DoubleSide, depthWrite: false })); glass.position.y = 1.55; ped.add(glass);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .015, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(w.color) })); ring.rotation.x = Math.PI / 2; ring.position.y = 2.0; ped.add(ring);
      ped.userData.click = { type: 'prop', w, item }; ped.userData.item = item; clickables.push(ped);
      obstacles.push({ x: px, z, rx: .6, rz: .6 });
    });
    built = true;
  }

  /* ---- interaction ---- */
  function pickAt(e) {
    const r = canvas.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera); ray.far = 14; const hits = ray.intersectObjects(clickables, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.click) o = o.parent; if (o) return o; }
    return null;
  }
  function hoverAt(e) {
    if (inspect) return; const o = pickAt(e); hovered = o; canvas.style.cursor = o ? 'pointer' : 'grab';
    if (o) { const d = o.userData.click, r = canvas.getBoundingClientRect(); tip.textContent = d.type === 'map' ? (L('mapObj')) : d.type === 'prop' ? d.w.prop.name[getLang()] : d.w.name[getLang()]; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.classList.add('show'); }
    else tip.classList.remove('show');
  }
  function clickAt(e) {
    if (inspect) return; const o = pickAt(e); if (!o) return; const d = o.userData.click, lg = getLang();
    tip.classList.remove('show'); window.Music && Music.pluckNote(Math.floor(Math.random() * 8));
    if (d.type === 'portrait') {
      showCard(`<img src="${window.PORTRAITS[d.w.id]}" alt=""><h3>${d.w.name[lg]}</h3><p style="color:var(--gold2)">${d.w.years} · ${d.w.place[lg]}</p><p>${d.w.short[lg]}</p><p><small>${L('value')}:</small> <b>${d.w.value[lg]}</b></p><button class="btn btn-gold btn-small" data-open="${d.w.id}">${L('enterRoom')} →</button>`, [d.w.short[lg], d.w.value[lg]]);
    } else if (d.type === 'prop') {
      startInspect(o, d);
      showCard(`<h3>${d.w.prop.name[lg]}</h3><p>${d.w.prop.text[lg]}</p><p style="color:var(--muted);font-size:.8rem">🖐 ${lg === 'kz' ? 'Затты тінтуірмен/саусақпен айналдырыңыз' : 'Вращайте предмет мышью или пальцем'}</p><p><b>${d.w.name[lg]}</b></p><button class="btn btn-ghost btn-small" data-open="${d.w.id}">${L('more')} →</button>`, [d.w.prop.name[lg] + '. ' + d.w.prop.text[lg]]);
    } else if (d.type === 'map') {
      showCard(`<h3>${L('mapObj')}</h3><p>${window.I18N[lg].mapLead}</p>` + writers.map(w => `<p style="margin:0 0 4px"><span style="color:${w.color}">●</span> ${w.name[lg]} — ${w.place[lg]}</p>`).join(''), [window.LIT_DATA.intro[lg]]);
    }
  }
  function showCard(html, say) {
    card.hidden = false; card.innerHTML = `<button class="x" aria-label="close">✕</button>` + html;
    card.querySelector('.x').onclick = () => { card.hidden = true; endInspect(); Voice.stop(); };
    if (say && say.length) { const sb = document.createElement('button'); sb.className = 'say'; sb.dataset.ico = '🔊'; sb.textContent = '🔊'; card.appendChild(sb); sb.onclick = () => Voice.toggle(sb, say, getLang()); if (Voice.auto) Voice.say(say, getLang(), { btn: sb }); }
    const b = card.querySelector('[data-open]'); if (b) b.onclick = () => { const w = writers.find(x => x.id === b.dataset.open); endInspect(); card.hidden = true; onOpenWriter(w); };
  }
  function startInspect(ped, d) {
    const item = ped.userData.item; const clone = item.clone(true); clone.traverse(o => { if (o.material) o.material = o.material.clone(); });
    item.visible = false; scene.add(clone); clone.scale.setScalar(1.6);
    const l = new THREE.PointLight(0xffffff, 1, 3); scene.add(l);
    inspect = { obj: clone, src: item, dist: 1.1, light: l, t: 0 };
  }
  function endInspect() { if (!inspect) return; scene.remove(inspect.obj); scene.remove(inspect.light); inspect.src.visible = true; inspect = null; }

  function collide(nx, nz) {
    const { w: W, l: Ln } = HALL; nx = Math.max(-W / 2 + .5, Math.min(W / 2 - .5, nx)); nz = Math.max(-Ln / 2 + .6, Math.min(Ln / 2 - .6, nz));
    for (const o of obstacles) { const dx = (nx - o.x) / (o.rx + .3), dz = (nz - o.z) / (o.rz + .3); if (dx * dx + dz * dz < 1) return null; }
    return [nx, nz];
  }
  function loop(now) {
    raf = requestAnimationFrame(loop); if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (!inspect) {
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
      yaw += turn * dt * 1.8;
      if (f || s) {
        const sp = (keys.ShiftLeft ? 6 : 3.4) * dt;
        const dx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp, dz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
        let r = collide(pos.x + dx, pos.z + dz) || collide(pos.x + dx, pos.z) || collide(pos.x, pos.z + dz);
        if (r) { pos.x = r[0]; pos.z = r[1]; bob += dt * 9; }
        help.style.opacity = 0;
      }
    }
    camera.position.set(pos.x, pos.y + Math.sin(bob) * .03, pos.z);
    camera.rotation.set(pitch, yaw, 0);
    if (inspect) {
      inspect.t = Math.min(1, inspect.t + dt * 2.5);
      const target = new THREE.Vector3(0, -.12, -inspect.dist).applyQuaternion(camera.quaternion).add(camera.position);
      const from = new THREE.Vector3(); inspect.src.getWorldPosition(from);
      inspect.obj.position.lerpVectors(from, target, inspect.t * (2 - inspect.t));
      if (!drag) inspect.obj.rotation.y += dt * .5;
      inspect.light.position.copy(camera.position);
    }
    const sh = scene.userData.sh; if (sh) sh.rotation.y += dt * .08;
    clickables.forEach(c => { if (c.userData.item && c.userData.item.visible) c.userData.item.rotation.y += dt * .6; });
    renderer.render(scene, camera);
  }
  return {
    open() {
      if (!renderer) init();
      if (!built || lang !== getLang()) build();
      running = true; resize(); last = performance.now(); help.style.opacity = 1; card.hidden = true;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    close() { running = false; keys = {}; endInspect(); card.hidden = true; Voice.stop(); }
  };
};
