(function () {
  const D = window.LIT_DATA, W = D.writers, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  let lang = 'kz';
  try { lang = localStorage.getItem('lit_lang') || 'kz'; } catch (e) {}
  const t = k => (window.I18N[lang] || {})[k] || k;
  const img = id => window.PORTRAITS[id];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const toast = (msg) => { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2400); };

  /* ================= AUDIO (narration) ================= */
  const Narr = {
    play(texts, btn, onTime, onEnd) { Voice.toggle(btn, texts, lang, { onTime, onEnd }); },
    stop() { Voice.stop(); },
    get a() { return Voice.audio; }
  };
  const SAY = '🔊';
  const sayBtn = (i) => `<button class="say" data-ico="${SAY}" data-say="${i}" aria-label="voice">${SAY}</button>`;
  function bindSay(root, texts) { root.querySelectorAll('[data-say]').forEach(b => b.onclick = e => { e.stopPropagation(); Voice.toggle(b, texts[+b.dataset.say], lang); }); }
  const autoSay = (texts) => { if (Voice.auto) Voice.say(texts, lang); };

  /* ================= I18N ================= */
  function applyLang() {
    document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru';
    $$('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
    $$('.lang-switch button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    $('#introText').textContent = D.intro[lang];
    document.title = t('title');
    renderList(); renderTimeBar(); renderCards(); renderTimeline(); renderValues(); renderAuthor();
    if (map) map.setLabels();
    if (current) openWriter(current, curTab);
  }
  function setLang(l) { lang = l; try { localStorage.setItem('lit_lang', l); } catch (e) {} Narr.stop(); applyLang(); }
  $$('.lang-switch button').forEach(b => b.onclick = () => setLang(b.dataset.lang));

  /* ================= SPLASH ================= */
  const splashLoop = Scenes.loop($('#splashCanvas'), ['sky:night', 'stars', 'moon', 'mountains', 'steppe'], { speed: .6, maxDpr: 1 });
  let firstVisit = true; try { firstVisit = !localStorage.getItem('lit_lang'); } catch (e) {}
  $$('[data-pick]').forEach(b => b.onclick = () => {
    setLang(b.dataset.pick); Music.start(); $('#musicBtn').classList.add('on');
    $('#splash').classList.add('hide'); setTimeout(() => { $('#splash').remove(); splashLoop.stop(); }, 900);
  });

  /* ================= HEADER ================= */
  addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 40), { passive: true });
  $('#musicBtn').onclick = () => { const on = Music.toggle(); $('#musicBtn').classList.toggle('on', on); };
  const vb = $('#voiceBtn'); vb.classList.toggle('off', !Voice.auto);
  vb.onclick = () => { Voice.auto = !Voice.auto; vb.classList.toggle('off', !Voice.auto); toast(Voice.auto ? '🔊 ' + t('voiceOn') : '🔇 ' + t('voiceOff')); };
  $('#burger').onclick = () => $('#nav').classList.toggle('open');
  $$('#nav a').forEach(a => a.addEventListener('click', () => $('#nav').classList.remove('open')));

  /* ================= HERO ================= */
  Scenes.loop($('#heroCanvas'), ['sky:dusk', 'stars', 'sun', 'mountains', 'steppe', 'yurt', 'rider'], { speed: .5 });
  const aboutT = $('#aboutToggle'); let aboutOpen = true;
  try { aboutOpen = localStorage.getItem('lit_about') !== '0'; } catch (e) {}
  const setAbout = o => { aboutOpen = o; aboutT.setAttribute('aria-expanded', o); $('#aboutBody').classList.toggle('closed', !o); try { localStorage.setItem('lit_about', o ? '1' : '0'); } catch (e) {} };
  setAbout(aboutOpen); aboutT.onclick = () => setAbout(!aboutOpen);
  $('#introAudioBtn').onclick = () => Narr.play(D.intro[lang], $('#introAudioBtn'));
  $('#openMuseumHero').onclick = openMuseum;

  /* ================= MAP ================= */
  let map = null, game = null, curYear = null, curGroup = 'all';
  const EXW = (window.LIT_EXTRA || {}).w || {}, GR = (window.LIT_EXTRA || {}).groups || {}, ERAS = (window.LIT_EXTRA || {}).eras || [];
  const eraOf = y => ERAS.find(e => y >= e.from && y <= e.to) || ERAS[0];
  function renderList() {
    let html = '';
    ['ru', 'rusl'].forEach(g => {
      if (curGroup !== 'all' && curGroup !== g) return;
      html += `<li class="grp">${GR[g] ? GR[g][lang] : g}</li>`;
      W.filter(w => (EXW[w.id] || {}).group === g).forEach(w => {
        const e = EXW[w.id] || {}, alive = curYear == null || (curYear >= e.born && curYear <= (e.died || 2100)), inKz = curYear != null && curYear >= e.kzFrom && curYear <= e.kzTo;
        html += `<li class="${alive ? '' : 'dim'}"><button data-id="${w.id}" style="--c:${w.color}"><img src="${img(w.id)}" alt=""><span><b>${w.name[lang]}${inKz ? `<i class="kzbadge">${t('inKz')}</i>` : ''}</b><small>${w.place[lang]} · ${w.years}</small></span></button></li>`;
      });
    });
    $('#writerList').innerHTML = html;
    $$('#writerList button').forEach(b => {
      const w = W.find(x => x.id === b.dataset.id);
      b.onclick = () => { if (game) return gameAnswer(w); enterWorld(w); };
      b.onmouseenter = () => map && map.highlight(w); b.onmouseleave = () => map && map.highlight(null);
    });
  }
  // map click → fly to medallion → time-travel overlay → writer's room
  function enterWorld(w) {
    const go = () => travel(w, () => openWriter(w, 'room'));
    if (map) map.focus(w, go); else go();
  }
  function travel(w, done) {
    const e = EXW[w.id] || {}, target = e.ev || +w.years.match(/\d{4}/)[0], from = curYear || 2026;
    const ov = $('#travel'); ov.hidden = false;
    $('#travelPlace').textContent = w.place[lang] + ' · ' + w.name[lang];
    const era = eraOf(target); $('#travelEra').textContent = era ? era[lang] : '';
    const t0 = performance.now(), D = 1700;
    try { Music.pluckNote(7); setTimeout(() => Music.pluckNote(4), 300); setTimeout(() => Music.pluckNote(0), 650); } catch (x) {}
    (function step(now) {
      const k = Math.min(1, (now - t0) / D), ease = 1 - Math.pow(1 - k, 3);
      $('#travelYear').textContent = Math.round(from + (target - from) * ease);
      if (k < 1) requestAnimationFrame(step); else setTimeout(() => { ov.hidden = true; done(); if (e.evText) setTimeout(() => autoSay([e.evText[lang]]), 600); }, 450);
    })(t0);
  }
  function initMap() {
    if (!window.THREE) { $('#mapLoading').textContent = '⚠ three.js — internet?'; return; }
    try {
      map = MapView({
        canvas: $('#mapCanvas'), labels: $('#mapLabels'), tip: $('#mapTip'), writers: W, getLang: () => lang,
        onPick: w => game ? gameAnswer(w) : enterWorld(w),
        onHover: w => $$('#writerList button').forEach(b => b.classList.toggle('hl', w && b.dataset.id === w.id))
      });
      $('#mapLoading').remove();
      map.setYear(curYear); map.setGroup(curGroup);
    } catch (e) { console.error(e); $('#mapLoading').textContent = 'WebGL ⚠'; }
  }
  $('#mapTop').onclick = () => map && map.viewTop();
  $('#map3d').onclick = () => map && map.view3d();
  $('#mapSpin').onclick = () => { if (map) $('#mapSpin').classList.toggle('on', map.spin()); };
  $$('[data-group]').forEach(b => b.onclick = () => {
    curGroup = b.dataset.group; $$('[data-group]').forEach(x => x.classList.toggle('on', x === b));
    map && map.setGroup(curGroup); renderList();
  });
  // collapsible writer panel
  const side = $('#mapSide'), stg = $('#sideToggle');
  function setSide(open) { side.classList.toggle('collapsed', !open); stg.setAttribute('aria-expanded', open); try { localStorage.setItem('lit_side', open ? '1' : '0'); } catch (e) {} }
  let sideOpen = innerWidth > 900; try { const v = localStorage.getItem('lit_side'); if (v && innerWidth > 900) sideOpen = v === '1'; } catch (e) {}
  setSide(sideOpen); stg.onclick = () => setSide(side.classList.contains('collapsed'));

  // ---- time bar ----
  const Y0 = 1799, Y1 = 2026, pctY = y => (y - Y0) / (Y1 - Y0) * 100;
  function renderTimeBar() {
    $('#tbEras').innerHTML = ERAS.map(e => { const a = Math.max(Y0, e.from), b = Math.min(Y1, e.to); return `<i style="width:${pctY(b) - pctY(a)}%;background:${e.color}" title="${e[lang]}"></i>`; }).join('');
    $('#tbMarks').innerHTML = W.map(w => { const e = EXW[w.id] || {}; return e.ev ? `<span style="left:${pctY(e.ev)}%;--c:${w.color}" title="${e.ev} · ${w.name[lang]}"></span>` : ''; }).join('') +
      [1800, 1850, 1900, 1950, 2000].map(y => `<em style="left:${pctY(y)}%">${y}</em>`).join('');
    updateTimeLabels();
  }
  function updateTimeLabels() {
    const y = curYear, tE = $('#tbEra');
    if (y == null) { $('#tbYear').textContent = '∞'; tE.textContent = t('allTime'); tE.style.color = 'var(--gold2)'; $('#tbEvent').textContent = ''; return; }
    $('#tbYear').textContent = y; const era = eraOf(y); tE.textContent = era ? era[lang] : ''; tE.style.color = era ? era.color : '';
    let best = null; W.forEach(w => { const e = EXW[w.id]; if (e && e.ev != null && Math.abs(e.ev - y) <= 3 && (!best || Math.abs(e.ev - y) < Math.abs(best.e.ev - y))) best = { w, e }; });
    $('#tbEvent').textContent = best ? `📜 ${best.e.ev} — ${best.e.evText[lang]}` : '';
  }
  function setYear(y) {
    curYear = y; $('#tbAll').classList.toggle('on', y == null);
    if (y != null) $('#tbRange').value = y;
    map && map.setYear(y); updateTimeLabels(); renderList();
  }
  $('#tbRange').oninput = e => { stopPlay(); setYear(+e.target.value); };
  $('#tbAll').onclick = () => { stopPlay(); setYear(null); $('#tbRange').value = Y1; };
  let playT = null;
  function stopPlay() { clearInterval(playT); playT = null; $('#tbPlay').textContent = '▶'; }
  $('#tbPlay').onclick = () => {
    if (playT) return stopPlay();
    let y = curYear == null || curYear >= Y1 ? Y0 : curYear; setYear(y);
    $('#tbPlay').textContent = '❚❚';
    playT = setInterval(() => {
      y += 1; if (y > Y1) { stopPlay(); return; }
      setYear(y);
      if (W.find(w => (EXW[w.id] || {}).ev === y)) { try { Music.pluckNote(5); } catch (e) {} }
    }, 110);
  };

  // --- map game ---
  function startMapGame() {
    document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
    game = { order: shuffle(W).slice(0, 6), i: 0, score: 0, tries: 0 };
    $('#mapGameBar').hidden = false; map && map.view3d(); nextGameQ();
  }
  function nextGameQ() {
    if (game.i >= game.order.length) { const s = game.score; stopGame(); toast(t('mapGameEnd') + s + ' / 6 🏆'); return; }
    $('#mapGameQ').textContent = t('findWriter') + game.order[game.i].name[lang];
    $('#mapGameScore').textContent = `⭐ ${game.score} · ${game.i + 1}/${game.order.length}`;
  }
  function gameAnswer(w) {
    const target = game.order[game.i];
    if (w === target) { if (!game.tries) game.score++; Music.pluckNote(7); toast('✅ ' + t('wellDone') + ' ' + w.place[lang]); game.i++; game.tries = 0; nextGameQ(); }
    else { game.tries++; Music.pluckNote(0); toast('❌ ' + t('tryAgain') + w.name[lang]); }
  }
  function stopGame() { game = null; $('#mapGameBar').hidden = true; }
  $('#mapGameStop').onclick = stopGame; $('#mapGameBtn').onclick = startMapGame; $('#gMap').onclick = startMapGame;

  /* ================= TIMELINE / CARDS / VALUES / AUTHOR ================= */
  function renderTimeline() {
    const Y0 = 1790, Y1 = 2030, pct = y => (y - Y0) / (Y1 - Y0) * 100;
    let html = '<div class="tl-inner"><div class="tl-axis"></div>';
    for (let y = 1800; y <= 2020; y += 20) html += `<span class="tl-year" style="left:${pct(y)}%">${y}</span>`;
    W.forEach((w, i) => {
      const m = w.years.match(/(\d{4})/g); const a = +m[0], b = m[1] ? +m[1] : 2026;
      html += `<div class="tl-bar" data-id="${w.id}" style="--c:${w.color};left:${pct(a)}%;width:${pct(b) - pct(a)}%;top:${10 + (i % 5) * 21}px"><span>${w.name[lang]}</span></div>`;
    });
    $('#timelineBox').innerHTML = html + '</div>';
    $$('.tl-bar').forEach(b => b.onclick = () => openWriter(W.find(x => x.id === b.dataset.id)));
  }
  function renderCards() {
    $('#cards').innerHTML = W.map(w => `<button class="card" data-id="${w.id}" style="--c:${w.color}"><div class="card-img"><span class="card-place">📍 ${w.place[lang]}</span><img src="${img(w.id)}" alt="${w.name[lang]}" loading="lazy"></div><div class="card-body"><h3>${w.name[lang]}</h3><span class="yrs">${w.years}</span><p>${w.short[lang]}</p></div></button>`).join('');
    $$('.card').forEach(c => c.onclick = () => openWriter(W.find(x => x.id === c.dataset.id)));
    $('#mpFrames').innerHTML = W.slice(0, 5).map(w => `<img src="${img(w.id)}" alt="">`).join('');
  }
  function renderValues() {
    $('#valuesBox').innerHTML = W.map(w => `<div class="value" data-id="${w.id}" style="--c:${w.color}"><img src="${img(w.id)}" alt=""><div><b>${w.value[lang]}</b><small>${w.name[lang]}</small></div></div>`).join('');
    $$('.value').forEach(c => c.onclick = () => openWriter(W.find(x => x.id === c.dataset.id)));
  }
  function renderAuthor() {
    const a = window.CONFIG.author;
    $('#authorImg').src = a.photo; $('#authorName').textContent = a.name[lang]; $('#authorRole').textContent = a.role[lang];
    $('#authorSchool').textContent = a.school[lang]; $('#authorText').textContent = a.text[lang];
    $('#authorTags').innerHTML = a.tags[lang].map(x => `<span>${x}</span>`).join('');
  }

  /* ================= WRITER MODAL ================= */
  let current = null, curTab = 'about', room = null, trailer = null;
  const modal = $('#writerModal');
  function openWriter(w, tab) {
    current = w; Narr.stop(); if (trailer) trailer.stop();
    modal.hidden = false; document.body.classList.add('locked');
    modal.querySelector('.modal-box').style.setProperty('--c', w.color);
    $('#mAva').src = img(w.id); $('#mName').textContent = w.name[lang];
    $('#mMeta').textContent = `${w.years} · ${w.place[lang]} · ${w.role[lang]}`;
    renderAbout(w); renderSim(w); renderQuiz(w);
    if (!trailer) { trailer = Scenes.Trailer($('#trailerCanvas'), $('#trailerCap'), $('#trBar')); }
    trailer.build(w, lang); trailer.onEnd = () => setTrBtn(false, true); setTrBtn(false);
    if (room) room.pause();
    showTab(tab || 'about');
  }
  function closeWriter() { modal.hidden = true; document.body.classList.remove('locked'); Narr.stop(); if (trailer) trailer.stop(); if (room) room.pause(); stopSim(); current = null; }
  modal.querySelector('[data-close]').onclick = closeWriter;
  modal.addEventListener('click', e => { if (e.target === modal) closeWriter(); });
  function showTab(tab) {
    curTab = tab;
    $$('#mTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $$('#writerModal .tab').forEach(p => p.classList.toggle('on', p.dataset.pane === tab));
    if (tab !== 'trailer' && trailer && trailer.playing) { trailer.stop(); setTrBtn(false); }
    if (tab !== 'sim') stopSim();
    if (tab === 'room') {
      if (!window.THREE) return;
      if (!room) room = RoomView({ canvas: $('#roomCanvas'), tip: $('#roomTip'), info: $('#roomInfo'), getLang: () => lang, onAudio: act => { if (act === 'audio') { showTab('about'); setTimeout(() => $('#agBtn').click(), 200); } else showTab('sim'); } });
      if (room._w !== current || room._l !== lang) { room.load(current); room._w = current; room._l = lang; } else room.resume();
    } else if (room) room.pause();
  }
  $$('#mTabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

  // --- about tab ---
  function renderAbout(w) {
    const sentences = w.bio[lang].match(/[^.!?]+[.!?]+(\s|$)/g) || [w.bio[lang]];
    $('#paneAbout').innerHTML = `<div class="about-grid">
      <aside>
        <div class="portrait-frame"><img src="${img(w.id)}" alt="${w.name[lang]}"></div>
        <div class="value-badge">${sayBtn(0)}<small>${t('value')}</small><b>${w.value[lang]}</b></div>
        <div class="side-btns">
          <button class="btn btn-gold btn-small" data-go="room">🏛 ${t('openRoom')}</button>
          <button class="btn btn-ghost btn-small" data-go="trailer">🎬 ${t('openTrailer')}</button>
          <button class="btn btn-ghost btn-small" data-go="sim">✒️ ${t('simTitle')}</button>
          <button class="btn btn-ghost btn-small" data-go="quiz">📝 ${t('quizTitle')}</button>
        </div>
      </aside>
      <div>
        <div class="audio-guide">
          <button class="ag-btn" id="agBtn" aria-label="play">▶</button>
          <div class="ag-main"><b>🎧 ${t('audioGuide')} · ${lang === 'kz' ? 'қазақ тілінде' : 'на русском языке'}</b><div class="ag-bar" id="agBar"><i></i></div></div>
          <div class="ag-wave" id="agWave">${'<i></i>'.repeat(14)}</div>
        </div>
        <h3 class="pane-h">${t('bio')}</h3>
        <p class="bio-text" id="bioText">${sentences.map((s, i) => `<span data-s="${i}">${s}</span>`).join('')}</p>
        <h3 class="pane-h">${t('facts')}</h3>
        <ul class="facts">${w.facts.map((f, i) => `<li><span>${f[lang]}</span>${sayBtn(1 + i)}</li>`).join('')}</ul>
        <h3 class="pane-h">${t('works')}</h3>
        <div class="works">${w.works.map((x, i) => `<div class="work">${sayBtn(4 + i)}<b>«${x.t[lang]}»</b><span>${x.y}</span><p>${x.n[lang]}</p></div>`).join('')}</div>
      </div></div>`;
    $$('#paneAbout [data-go]').forEach(b => b.onclick = () => showTab(b.dataset.go));
    bindSay($('#paneAbout'), [w.value[lang], ...w.facts.map(f => f[lang]), ...w.works.map(x => Voice.workText(x, lang))]);
    const lens = sentences.map(s => s.length), total = lens.reduce((a, b) => a + b, 0);
    const bars = $$('#agWave i'), bar = $('#agBar i');
    let waveT = null;
    $('#agBtn').onclick = () => Narr.play(w.bio[lang], $('#agBtn'), (ct, dur, reset) => {
      bar.style.width = (reset ? 0 : ct / dur * 100) + '%';
      let acc = 0, idx = -1; const pos = ct / dur * total; for (let i = 0; i < lens.length; i++) { acc += lens[i]; if (pos <= acc) { idx = i; break; } }
      $$('#bioText span').forEach(s => s.classList.toggle('hl', !reset && +s.dataset.s === idx));
      if (reset) { clearInterval(waveT); waveT = null; bars.forEach(b => b.style.height = '4px'); }
      else if (!waveT) waveT = setInterval(() => bars.forEach(b => b.style.height = (4 + Math.random() * 22) + 'px'), 110);
    });
    $('#agBar').onclick = e => { if (Narr.a) { const r = e.currentTarget.getBoundingClientRect(); Narr.a.currentTime = (e.clientX - r.left) / r.width * (Narr.a.duration || 0); } };
  }

  // --- trailer tab ---
  function setTrBtn(on, ended) { $('#trPlay').innerHTML = (on ? '■ ' : '▶ ') + `<span>${on ? t('stop') : ended ? t('trReplay') : t('trPlay')}</span>`; }
  $('#trPlay').onclick = () => { Narr.stop(); if (trailer.playing) { trailer.stop(); setTrBtn(false); } else { trailer.build(current, lang); trailer.onEnd = () => setTrBtn(false, true); trailer.play(); setTrBtn(true); } };
  $('#trFull').onclick = () => { const b = $('#trailerBox'); if (document.fullscreenElement) document.exitFullscreen(); else if (b.requestFullscreen) b.requestFullscreen(); };

  // --- simulator ---
  let sim = null;
  function renderSim(w) {
    const date = w.sim[lang].split('.')[0];
    $('#paneSim').innerHTML = `<div class="sim">
      <div class="parchment" id="parch" tabindex="0"><span class="date">${date}</span><span class="ink" id="ink"></span><span id="caret">​</span>
        <svg class="quill" id="quill" viewBox="0 0 64 64"><path d="M8 60 L14 46 C20 30 34 12 58 4 C52 22 40 38 22 50 Z" fill="#fbf7ee" stroke="#a89878" stroke-width="1.2"/><path d="M8 60 L30 30" stroke="#a89878" stroke-width="1.2"/><path d="M8 60 l3-7 3 3z" fill="#222"/></svg>
      </div>
      <div class="sim-side">
        <h3>${t('simTitle')}</h3><p>${t('simLead')}</p>
        <div class="sim-progress"><i id="simBar"></i></div>
        <div class="sim-btns">
          <button class="btn btn-gold btn-small" id="simAuto">⏵ ${t('simAuto')}</button>
          <button class="btn btn-ghost btn-small" id="simReset">↺ ${t('simReset')}</button>
          <button class="btn btn-ghost btn-small" id="simFree">✍ ${t('simFree')}</button>
          <button class="btn btn-ghost btn-small" id="simListen"><span class="pi">▶</span> 🔊 ${t('listen')}</button>
        </div>
        <div class="sim-done" id="simDone"></div>
        <p class="note">${t('simNote')}</p>
      </div></div>`;
    const text = w.sim[lang].slice(date.length + 1).trim();
    sim = { text, i: 0, auto: null, free: false };
    const ink = $('#ink'), parch = $('#parch'), quill = $('#quill'), caret = $('#caret');
    function placeQuill() { const r = caret.getBoundingClientRect(), pr = parch.getBoundingClientRect(); quill.style.left = (r.left - pr.left) + 'px'; quill.style.top = (r.top - pr.top + r.height * .8) + 'px'; }
    function write(n) {
      if (sim.free) return; if (sim.i >= text.length) return finish();
      const chunk = text.slice(sim.i, sim.i + n); sim.i += n;
      const sp = document.createElement('span'); sp.className = 'fresh'; sp.textContent = chunk; ink.appendChild(sp);
      $('#simBar').style.width = (sim.i / text.length * 100) + '%'; placeQuill(); Music.scratch();
      if (sim.i >= text.length) finish();
    }
    function finish() { if (sim.auto) { clearInterval(sim.auto); sim.auto = null; } const d = $('#simDone'); d.textContent = t('simDone').replace('{name}', w.name[lang]); d.classList.add('show'); Music.pluckNote(7); }
    sim.key = e => { if (curTab !== 'sim' || modal.hidden || sim.free) return; if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') { e.preventDefault(); write(2 + Math.floor(Math.random() * 3)); } };
    parch.onclick = () => write(4 + Math.floor(Math.random() * 4));
    $('#simAuto').onclick = () => { if (sim.auto) { clearInterval(sim.auto); sim.auto = null; return; } sim.auto = setInterval(() => write(1 + Math.floor(Math.random() * 2)), 55); };
    $('#simReset').onclick = () => { stopSim(); renderSim(w); };
    $('#simListen').onclick = () => Narr.play(w.sim[lang], $('#simListen'));
    $('#simFree').onclick = () => { stopSim(); sim.free = true; ink.innerHTML = ''; quill.style.display = 'none'; const ta = document.createElement('textarea'); ta.className = 'free-area'; ta.placeholder = t('simFreePh'); ta.oninput = () => Music.scratch(); ink.appendChild(ta); ta.focus(); };
    setTimeout(placeQuill, 50);
  }
  function stopSim() { if (sim && sim.auto) { clearInterval(sim.auto); sim.auto = null; } }
  addEventListener('keydown', e => sim && sim.key && sim.key(e));

  // --- quiz engine ---
  function runQuiz(box, qs, opts) {
    opts = opts || {}; let i = 0, score = 0; const res = [];
    function draw() {
      if (i >= qs.length) return end();
      const q = qs[i], ord = shuffle(q.o.map((o, k) => ({ o, k })));
      box.innerHTML = `<div class="quiz">${opts.title ? `<h3 style="font-size:1.1rem;color:var(--muted);margin-bottom:6px">${opts.title}</h3>` : ''}
        <div class="quiz-top"><span>${i + 1} / ${qs.length}</span><span class="quiz-dots">${qs.map((_, k) => `<i class="${res[k] === true ? 'ok' : res[k] === false ? 'bad' : k === i ? 'cur' : ''}"></i>`).join('')}</span></div>
        ${q.work ? `<div class="match-work">«${q.work}»</div><h3 style="font-size:1.3rem">${t('matchQ')}</h3>` : `<h3>${q.q}<button class="say" data-ico="🔊" id="qSay" aria-label="voice">🔊</button></h3>`}
        <div class="opts ${q.imgs ? 'grid4' : ''}">${ord.map((x, n) => `<button class="opt" data-k="${x.k}">${q.imgs ? `<img src="${q.imgs[x.k]}" alt="">` : `<span class="k">${'ABCD'[n]}</span>`}<span>${x.o}</span></button>`).join('')}</div>
        <div class="quiz-fb" id="qfb"></div><div id="qnext"></div></div>`;
      const qs2 = box.querySelector('#qSay'); if (qs2) { qs2.onclick = () => Voice.toggle(qs2, q.q, lang); if (Voice.auto && !box.closest('[hidden]')) setTimeout(() => { if (box.isConnected && box.offsetParent) Voice.say(q.q, lang, { btn: qs2 }); }, 250); }
      box.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = +b.dataset.k === q.a; res[i] = ok; if (ok) score++;
        box.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (+x.dataset.k === q.a) x.classList.add('ok'); });
        if (!ok) b.classList.add('bad');
        const fb = box.querySelector('#qfb'); fb.className = 'quiz-fb ' + (ok ? 'ok' : 'bad'); fb.textContent = ok ? '✓ ' + t('correct') : '✗ ' + t('wrong') + q.o[q.a];
        Music.pluckNote(ok ? 7 : 0);
        box.querySelector('#qnext').innerHTML = `<button class="btn btn-gold">${t('next')} →</button>`;
        box.querySelector('#qnext button').onclick = () => { i++; draw(); };
      });
    }
    function end() {
      const p = score / qs.length, stars = p >= .99 ? 3 : p >= .6 ? 2 : p > 0 ? 1 : 0;
      box.innerHTML = `<div class="quiz quiz-res"><p class="eyebrow">${t('result')}</p><div class="big">${score} / ${qs.length}</div><div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><p>${p >= .99 ? t('wellDone') + ' 🎉' : ''}</p><button class="btn btn-gold">↺ ${t('again')}</button></div>`;
      box.querySelector('button').onclick = () => { opts.regen ? runQuiz(box, opts.regen(), opts) : runQuiz(box, qs, opts); };
      if (stars === 3) for (let n = 0; n < 5; n++) setTimeout(() => Music.pluckNote(3 + n), n * 140);
    }
    draw();
  }
  const mkQ = (w, q) => ({ q: q.q[lang], o: q.o.map(o => o[lang]), a: q.a });
  function renderQuiz(w) { runQuiz($('#paneQuiz'), w.quiz.map(q => mkQ(w, q)), { title: w.name[lang] }); }

  /* ================= GAMES ================= */
  const gm = $('#gameModal');
  function openGame(title, fn) { $('#gmTitleH').textContent = title; gm.hidden = false; document.body.classList.add('locked'); fn($('#gameBody')); }
  gm.querySelector('[data-close]').onclick = () => { gm.hidden = true; document.body.classList.remove('locked'); };
  gm.addEventListener('click', e => { if (e.target === gm) gm.querySelector('[data-close]').click(); });
  const bigQuiz = () => shuffle(W.flatMap(w => w.quiz.map(q => mkQ(w, q)))).slice(0, 10);
  const matchQuiz = () => shuffle(W).slice(0, 8).map(w => {
    const work = w.works[Math.floor(Math.random() * w.works.length)];
    const others = shuffle(W.filter(x => x !== w)).slice(0, 3); const all = [w, ...others];
    return { work: work.t[lang], o: all.map(x => x.name[lang]), imgs: all.map(x => img(x.id)), a: 0 };
  });
  $('#gQuiz').onclick = () => openGame(t('g2t'), b => runQuiz(b, bigQuiz(), { regen: bigQuiz }));
  $('#gMatch').onclick = () => openGame(t('g3t'), b => runQuiz(b, matchQuiz(), { regen: matchQuiz }));

  /* ================= MUSEUM ================= */
  let museum = null;
  function openMuseum() {
    if (!window.THREE) { toast('three.js ⚠'); return; }
    if (!museum) museum = MuseumView({ canvas: $('#museumCanvas'), tip: $('#muTip'), card: $('#muCard'), help: $('#muHelp'), pad: $('#muPad'), writers: W, getLang: () => lang,
      onOpenWriter: w => { closeMuseum(); openWriter(w); }, onExit: closeMuseum });
    $('#museumFull').hidden = false; document.body.classList.add('locked'); museum.open();
  }
  function closeMuseum() { $('#museumFull').hidden = true; document.body.classList.remove('locked'); museum && museum.close(); }
  $('#openMuseum').onclick = openMuseum; $('#muExit').onclick = closeMuseum;

  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!modal.hidden) closeWriter(); else if (!gm.hidden) gm.querySelector('[data-close]').click(); } });

  /* ================= BOOT ================= */
  const qp = new URLSearchParams(location.search), hp = new URLSearchParams(location.hash.slice(1));
  if (qp.get('lang') === 'kz' || qp.get('lang') === 'ru') { lang = qp.get('lang'); $('#splash').remove(); splashLoop.stop(); }
  applyLang();
  if (hp.get('w')) { const w = W.find(x => x.id === hp.get('w')); if (w) openWriter(w, hp.get('tab') || 'about'); }
  if (hp.has('museum')) setTimeout(openMuseum, 300);
  // lazy-init the map when near viewport
  const mo = new IntersectionObserver(es => { if (es[0].isIntersecting) { initMap(); mo.disconnect(); } }, { rootMargin: '300px' });
  mo.observe($('#mapStage'));
})();
