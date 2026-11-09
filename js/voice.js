/* Озвучка всего сайта: готовые нейро-записи (assets/audio/v) + запасной голос браузера */
window.Voice = (function () {
  const MAP = () => window.AUDIO_MAP || {};
  const enc = new TextEncoder();
  function key(lang, text) {
    let h = 0x811c9dc5;
    for (const b of enc.encode(lang + '|' + text)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  const src = (lang, text) => { const k = key(lang, text); return MAP()[k] ? 'assets/audio/v/' + k + '.mp3' : null; };
  const dur = (lang, text) => MAP()[key(lang, text)] || 0;
  const workText = (x, lang) => `«${x.t[lang]}», ${x.y}. ${x.n[lang]}`;

  let auto = true; try { auto = localStorage.getItem('lit_autovoice') !== '0'; } catch (e) {}
  let cur = null, token = 0;

  function pickSynthVoice(lang) {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const code = lang === 'kz' ? 'kk' : 'ru';
    const list = vs.filter(v => v.lang && v.lang.toLowerCase().startsWith(code));
    return list.find(v => /natural|online|neural/i.test(v.name)) || list.find(v => /google/i.test(v.name)) || list[0] || null;
  }
  function synth(text, lang) {
    return new Promise(res => {
      if (!window.speechSynthesis) return res();
      const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'kz' ? 'kk-KZ' : 'ru-RU';
      const v = pickSynthVoice(lang); if (v) u.voice = v; u.rate = 1;
      u.onend = u.onerror = () => res(); speechSynthesis.speak(u);
    });
  }

  /* say(texts, lang, {btn, onTime(ct,dur,reset), onEnd}) — plays a queue of texts */
  function say(texts, lang, o) {
    o = o || {}; stop();
    const my = ++token; texts = [].concat(texts).filter(Boolean);
    cur = { btn: o.btn, onTime: o.onTime, audio: null };
    setBtn(o.btn, true); window.Music && Music.duck(true);
    (async () => {
      for (let i = 0; i < texts.length; i++) {
        if (my !== token) return;
        const s = src(lang, texts[i]);
        if (s) {
          await new Promise(res => {
            const a = new Audio(s); cur.audio = a;
            a.ontimeupdate = () => o.onTime && my === token && o.onTime(a.currentTime, a.duration || 1, false, i);
            a.onended = res; a.onerror = () => { synth(texts[i], lang).then(res); };
            a.play().catch(() => { synth(texts[i], lang).then(res); });
          });
        } else await synth(texts[i], lang);
      }
      if (my === token) { const end = o.onEnd; finish(); end && end(); }
    })();
  }
  function finish() { if (!cur) return; const c = cur; cur = null; setBtn(c.btn, false); c.onTime && c.onTime(0, 1, true); window.Music && Music.duck(false); }
  function stop() { token++; if (cur && cur.audio) cur.audio.pause(); if (window.speechSynthesis) speechSynthesis.cancel(); finish(); }
  function setBtn(b, on) {
    if (!b) return; b.classList.toggle('playing', on);
    const pi = b.querySelector('.pi'); if (pi) pi.textContent = on ? '❚❚' : '▶';
    else if (b.dataset.ico !== undefined) b.textContent = on ? '■' : b.dataset.ico;
    else b.textContent = on ? '❚❚' : '▶';
  }
  /* toggle helper for buttons: second click stops */
  function toggle(btn, texts, lang, o) { if (cur && cur.btn === btn) { stop(); return; } say(texts, lang, Object.assign({ btn }, o)); }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
  return {
    key, src, dur, workText, say, stop, toggle,
    get playing() { return !!cur; },
    get audio() { return cur && cur.audio; },
    get auto() { return auto; },
    set auto(v) { auto = v; try { localStorage.setItem('lit_autovoice', v ? '1' : '0'); } catch (e) {} if (!v) stop(); }
  };
})();
