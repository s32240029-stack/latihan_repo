/* ScriptWeave site behaviour. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  var TAU = Math.PI * 2;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function onChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  /* ---------- language: Indonesian in the markup, English from window.SW_EN ---------- */

  var EN = window.SW_EN || {};
  var lang = 'id';
  try { if (localStorage.getItem('sw-lang') === 'en') lang = 'en'; } catch (e) { /* default */ }

  function t(str) { return lang === 'en' && EN[str] ? EN[str] : str; }

  /* text an element shows that the script sets: remembered by its Indonesian key */
  function setText(el, idStr) {
    if (!el) return;
    el.setAttribute('data-i18n-key', idStr);
    el.textContent = t(idStr);
  }

  var I18N_SKIP = 'script, style, code, kbd, svg, .code, .diff-lines, .diff-file, [data-no-i18n], [data-i18n-key]';
  var I18N_ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];
  var originals = new WeakMap();

  function translateNode(node) {
    var orig = originals.get(node);
    if (orig === undefined) { orig = node.nodeValue; originals.set(node, orig); }
    var key = orig.replace(/\s+/g, ' ').trim();
    if (!key) return;
    if (lang === 'en' && EN[key]) {
      var lead = orig.match(/^\s*/)[0];
      var trail = orig.match(/\s*$/)[0];
      if (/^[?.,;:!]/.test(EN[key])) lead = '';
      node.nodeValue = lead + EN[key] + trail;
    } else {
      node.nodeValue = orig;
    }
  }

  function applyLang(next) {
    lang = next;
    root.setAttribute('lang', lang);
    document.title = t('ScriptWeave | Asisten Coding AI');
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement && !n.parentElement.closest(I18N_SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(translateNode);
    $$('[data-i18n-key]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n-key')); });
    I18N_ATTRS.forEach(function (attr) {
      $$('[' + attr + ']').forEach(function (el) {
        if (el.closest('svg, .code')) return;
        var store = 'data-i18n-' + attr;
        if (!el.hasAttribute(store)) el.setAttribute(store, el.getAttribute(attr));
        el.setAttribute(attr, t(el.getAttribute(store)));
      });
    });
    $$('.lang-switch [data-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === lang));
    });
    if (typeof onLangChange === 'function') onLangChange();
    try { localStorage.setItem('sw-lang', lang); } catch (e) { /* not persisted */ }
  }
  var onLangChange = null;

  $$('.lang-switch [data-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.getAttribute('data-lang') !== lang) applyLang(btn.getAttribute('data-lang'));
    });
  });

  /* ---------- theme: light by default, dark on request ---------- */

  function isDark() { return root.getAttribute('data-sw-theme') === 'dark'; }
  var themeBtn = $('#theme-toggle');
  var onThemeChange = null;
  function labelTheme() {
    if (!themeBtn) return;
    var key = isDark() ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
    themeBtn.setAttribute('data-i18n-aria-label', key);
    themeBtn.setAttribute('aria-label', t(key));
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      if (isDark()) root.removeAttribute('data-sw-theme'); else root.setAttribute('data-sw-theme', 'dark');
      try { localStorage.setItem('sw-theme', isDark() ? 'dark' : 'light'); } catch (e) { /* not persisted */ }
      labelTheme();
      if (onThemeChange) onThemeChange();
    });
  }
  labelTheme();

  /* ---------- header + mobile nav ---------- */

  var header = $('#site-header');
  var nav = $('#site-nav');
  var navBtn = $('#nav-toggle');

  function setNav(open) {
    if (!nav || !navBtn) return;
    nav.classList.toggle('is-open', open);
    navBtn.setAttribute('aria-expanded', String(open));
    navBtn.setAttribute('data-i18n-aria-label', open ? 'Tutup menu' : 'Buka menu');
    navBtn.setAttribute('aria-label', t(open ? 'Tutup menu' : 'Buka menu'));
  }
  if (navBtn) navBtn.addEventListener('click', function () { setNav(!nav.classList.contains('is-open')); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });

  var progressBar = $('.read-progress span');
  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* highlight the nav link of the section in view */
  var navLinks = $$('.site-nav a');
  if ('IntersectionObserver' in window && navLinks.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + entry.target.id;
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { spy.observe(s); });
  }

  /* ---------- scroll reveal ---------- */

  /* headings decode from scrambled characters, like code compiling into words */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}[]=+*#_';
  function decodeText(el, duration) {
    if (!el || reduceMotion.matches) return;
    var nodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    var jobs = nodes.map(function (node) {
      if (!originals.has(node) && lang === 'id') originals.set(node, node.nodeValue);
      var target = node.nodeValue;
      return { node: node, target: target, order: target.split('').map(function () { return Math.random(); }) };
    });
    var run = (el.__decodeRun || 0) + 1;
    el.__decodeRun = run;
    var start = performance.now();
    function step(now) {
      if (el.__decodeRun !== run) return;
      var p = Math.min(1, (now - start) / (duration || 700));
      jobs.forEach(function (j) {
        var out = '';
        for (var i = 0; i < j.target.length; i++) {
          var ch = j.target.charAt(i);
          if (/\s|[.,?!:;'"’“”-]/.test(ch) || j.order[i] < p * 1.15 - 0.1) out += ch;
          else out += GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        }
        j.node.nodeValue = out;
      });
      if (p < 1) requestAnimationFrame(step);
      else jobs.forEach(function (j) { translateNode(j.node); });
    }
    requestAnimationFrame(step);
  }

  /* things that animate once when they scroll into view */
  if ('IntersectionObserver' in window) {
    var onceSeen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        onceSeen.unobserve(el);
        if (el.matches('h2, .agent-title')) decodeText(el, 800);
        else el.classList.add('in-view');
      });
    }, { threshold: 0.45 });
    $$('main .section h2, .agent-title, .loom, .closing').forEach(function (el) { onceSeen.observe(el); });
  } else {
    $$('.loom, .closing').forEach(function (el) { el.classList.add('in-view'); });
  }

  /* ---------- preloader: count up, then lift away ---------- */
  var preloaderDone = !root.classList.contains('preloading');
  var afterPreload = [];
  function whenLoaded(fn) { if (preloaderDone) fn(); else afterPreload.push(fn); }
  (function () {
    var pl = $('#preloader');
    if (!pl || preloaderDone) return;
    var pct = $('.pl-pct', pl);
    var t0 = performance.now();
    var dur = 1300;
    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      if (pct) pct.textContent = String(Math.round(eased * 100));
      pl.style.setProperty('--pl', eased.toFixed(3));
      if (p < 1) { requestAnimationFrame(tick); return; }
      pl.classList.add('is-done');
      try { sessionStorage.setItem('sw-seen', '1'); } catch (e) { /* fine */ }
      setTimeout(function () {
        root.classList.remove('preloading');
        preloaderDone = true;
        afterPreload.splice(0).forEach(function (fn) { fn(); });
      }, 420);
    }
    requestAnimationFrame(tick);
  })();

  /* ---------- custom cursor: a dot and a trailing ring ---------- */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion.matches) {
    var dot = document.createElement('div');
    var ring = document.createElement('div');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    var cx = -100, cy = -100, rx = -100, ry = -100;
    var PRESSABLE = 'a, button, summary, select, input, textarea, label, [data-plan-card], .feature, .note';
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      cx = e.clientX;
      cy = e.clientY;
      root.classList.add('cursor-on');
      ring.classList.toggle('is-hover', !!(e.target.closest && e.target.closest(PRESSABLE)));
    }, { passive: true });
    document.addEventListener('pointerdown', function () { ring.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { ring.classList.remove('is-down'); });
    document.documentElement.addEventListener('mouseleave', function () { root.classList.remove('cursor-on'); });
    (function follow() {
      rx += (cx - rx) * 0.2;
      ry += (cy - ry) * 0.2;
      dot.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- kinetic words: one big word per stretch of scroll ---------- */
  (function () {
    var kin = $('#alur');
    if (!kin || reduceMotion.matches || window.innerHeight < 420) return;
    kin.classList.add('is-live');
    var words = $$('.kin-word', kin);
    var count = $('.kin-count', kin);
    var bar = $('.kin-bar i', kin);
    var last = -1;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function update() {
      var total = kin.offsetHeight - window.innerHeight;
      var p = total > 0 ? clamp01(-kin.getBoundingClientRect().top / total) : 0;
      var idx = Math.min(words.length - 1, Math.floor(p * words.length));
      if (idx !== last) {
        words.forEach(function (w, i) {
          w.classList.toggle('is-on', i === idx);
          w.classList.toggle('is-past', i < idx);
        });
        if (count) count.textContent = pad(idx + 1) + ' / ' + pad(words.length);
        last = idx;
      }
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* a spotlight that follows the pointer across cards */
  document.addEventListener('pointermove', function (e) {
    var card = e.target && e.target.closest ? e.target.closest('.feature, .plan, .contact-panel, .note') : null;
    if (!card) return;
    var r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
  }, { passive: true });

  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('is-waiting');
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) {
      /* only elements still below the fold wait; anything already on screen stays put */
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('is-waiting');
        revealer.observe(el);
      }
    });
  }

  /* ---------- story stage: one thread, driven by scroll ----------
     progress p runs 0..1 across the pinned stage:
       0.00  yarn ball over the headline, a loose thread hanging from it
       0.24  ball docks above the loom; the thread fans out into warp (chapter 1)
       0.47  weft is thrown row by row, each row shaped like a line of code (chapter 2)
       0.74  the cloth is cut from the loom and hemmed with a running stitch (chapter 3) */

  var story = $('#beranda');
  var stage = $('#stage');
  var cv = $('#loom-canvas');
  var heroEl = $('#story-hero');
  var anchorEl = $('#hero-anchor');
  var hintEl = $('#scroll-hint');
  var chapterEls = $$('.chapter', story || document);
  var dotEls = $$('#stage-dots li');
  var tagEls = {};
  $$('.tag').forEach(function (el) { tagEls[el.getAttribute('data-tag')] = el; });

  /* each weft row is a line of code: [fromColumn, toColumn, tokenKind] */
  var COLS = 12;
  var CODE_ROWS = [
    [[0, 3, 'kw'], [3, 9, 'fn']],
    [[1, 3, 'kw'], [3, 9, 'plain']],
    [[1, 2, 'kw'], [2, 7, 'plain'], [7, 11, 'str']],
    [[1, 2, 'kw'], [2, 8, 'plain'], [8, 12, 'str']],
    [[1, 3, 'kw'], [3, 7, 'str']],
    [[0, 1, 'plain']],
    [],
    [[0, 3, 'kw'], [3, 8, 'fn']],
    [[1, 3, 'kw'], [3, 10, 'plain']]
  ];
  var CHAPTER_WINDOWS = [[0.22, 0.455], [0.47, 0.705], [0.72, 2]];

  var C = {};
  function readColors() {
    var cs = getComputedStyle(root);
    function v(name) { return cs.getPropertyValue(name).trim(); }
    C.bg = v('--bg');
    C.fg = v('--fg');
    C.yarn = v('--yarn');
    C.yarnHi = v('--yarn-hi');
    C.yarnLo = v('--yarn-lo');
    C.kw = v('--turmeric');
    C.str = v('--madder');
    C.fn = v('--ok');
    C.cyan = v('--cyan');
    C.plain = C.yarn;
  }

  function geometry(W, H) {
    var wide = W >= 900;
    var g = { wide: wide, W: W, H: H };
    g.s = wide ? Math.min(W * 0.38, H * 0.57) : Math.min(W * 0.6, H * 0.285);
    g.vx = wide ? W * 0.71 : W * 0.5;
    var top = wide ? (H - g.s * 1.3) / 2 : H * 0.035;
    g.rd = g.s * 0.115;                       /* docked ball radius */
    g.dock = { x: g.vx, y: top + g.rd };
    g.fanTop = top + g.rd * 2 + g.s * 0.05;
    g.fanH = g.s * 0.2;
    g.clothTop = g.fanTop + g.fanH;
    g.clothH = g.s * 0.76;
    g.clothLeft = g.vx - g.s / 2;
    g.cw = g.s / COLS;
    g.pitch = g.clothH / CODE_ROWS.length;
    g.fringe = g.s * 0.05;
    g.tw = Math.max(1.5, g.s * 0.0075);       /* thread width */

    /* the hero ball sits in the open space the headline leaves: to its right on wide
       screens, between the headline and the intro text on phones */
    var rh = wide ? Math.min(W * 0.125, H * 0.26) : W * 0.14;
    var hx = W * 0.72;
    var hy = H * 0.4;
    var footEl = $('.hero-foot');
    if (anchorEl && anchorEl.offsetWidth) {
      var lastLine = anchorEl.nextElementSibling || anchorEl;
      var lineEnd = Math.max(anchorEl.offsetLeft + anchorEl.offsetWidth, lastLine.offsetLeft + lastLine.offsetWidth);
      var titleTop = anchorEl.offsetTop;
      var titleBottom = lastLine.offsetTop + lastLine.offsetHeight;
      var footTop = footEl ? footEl.offsetTop : H * 0.75;
      if (wide) {
        var left = lineEnd + 40;
        var right = W - 40;
        rh = Math.max(40, Math.min(rh, (right - left) / 2));
        hx = (left + right) / 2;
        hy = (titleTop + footTop) / 2;
      } else {
        var gapTop = titleBottom + 16;
        var gapBottom = footTop - 24;
        var fit = (gapBottom - gapTop) / 2;
        if (fit > W * 0.1) {
          rh = Math.min(W * 0.22, fit * 0.78);
          hx = W * 0.6;
          hy = gapTop + fit - rh * 0.1;
        } else {
          hx = lineEnd + rh * 0.42;
          hy = titleBottom;
        }
      }
    }
    g.hero = { x: Math.min(hx, W - rh - 8), y: hy, r: rh };
    /* where the loose thread leaves the stage */
    g.tailX = wide ? g.hero.x - rh * 0.25 : W - 14;
    return g;
  }

  /* how far along its run the loose thread has drifted sideways: on phones it heads for
     the right edge early, so it hangs beside the intro text instead of across it */
  function tailEase(u, wide) {
    return wide ? u * u * (3 - 2 * u) : smooth(0, 0.32, u);
  }

  function strokePartial(ctx, pts, f) {
    if (f <= 0 || pts.length < 2) return;
    var total = 0;
    var i;
    var lens = [];
    for (i = 1; i < pts.length; i++) {
      var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(d);
      total += d;
    }
    var left = total * Math.min(1, f);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) {
      var len = lens[i - 1];
      if (left >= len) {
        ctx.lineTo(pts[i][0], pts[i][1]);
        left -= len;
      } else {
        var t = len ? left / len : 0;
        ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t));
        break;
      }
    }
    ctx.stroke();
  }

  function drawBall(ctx, x, y, r, rot, alpha) {
    if (alpha <= 0.01 || r < 1) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    /* soft ground shadow */
    ctx.save();
    ctx.translate(x, y + r * 1.14);
    ctx.scale(1, 0.15);
    var sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.95);
    sg.addColorStop(0, 'rgba(8, 11, 36, .34)');
    sg.addColorStop(1, 'rgba(8, 11, 36, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = C.yarnLo;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    /* each layer is a band of thread wound around the ball: an ellipse of parallel strands */
    var layers = [
      { phi: rot * 0.6 + 0.4, hw: 1, fill: C.yarn, line: C.yarnHi },
      { phi: -rot * 0.9 + 1.9, hw: 0.68, fill: C.yarn, line: C.yarnHi },
      { phi: rot * 1.25 - 0.7, hw: 0.42, fill: C.yarn, line: C.yarnHi },
      { phi: -rot * 1.1 + 2.7, hw: 0.17, fill: C.kw, line: 'rgba(27, 20, 3, .45)' }
    ];
    for (var l = 0; l < layers.length; l++) {
      var L = layers[l];
      ctx.save();
      ctx.rotate(L.phi);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.02, r * L.hw, 0, 0, TAU);
      ctx.fillStyle = L.fill;
      ctx.fill();
      ctx.lineWidth = r * 0.045;
      ctx.strokeStyle = C.yarnLo;
      ctx.globalAlpha = alpha * 0.55;
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.6;
      ctx.lineWidth = Math.max(0.8, r * 0.014);
      ctx.strokeStyle = L.line;
      var strands = Math.round(L.hw * 9) + 1;
      for (var j = 1; j <= strands; j++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.02, r * L.hw * (j - 0.5) / strands, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* volume: light from the upper left */
    ctx.globalAlpha = alpha;
    var hg = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.05, 0, 0, r * 1.05);
    hg.addColorStop(0, 'rgba(255, 255, 255, .34)');
    hg.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    hg.addColorStop(1, 'rgba(6, 9, 34, .46)');
    ctx.fillStyle = hg;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  function placeTag(el, x, y, rotDeg, alpha, W) {
    if (!el) return;
    var half = el.offsetWidth / 2;
    x = Math.max(half + 8, Math.min(W - half - 8, x));
    el.style.opacity = alpha.toFixed(3);
    el.style.transform = 'translate(' + (x - half).toFixed(1) + 'px,' + (y - el.offsetHeight / 2).toFixed(1) + 'px) rotate(' + rotDeg + 'deg)';
  }

  function render(p, time) {
    if (!cv) return;
    var W = cv.clientWidth;
    var H = cv.clientHeight;
    if (!W || !H) return;

    var g = geometry(W, H);
    var ballT = smooth(0.04, 0.24, p);
    var t1 = smooth(0.24, 0.44, p);
    var t2 = smooth(0.47, 0.7, p);
    var t3 = smooth(0.74, 0.93, p);
    var loomAlpha = 1 - t3;           /* ball, tail and fan fade once the cloth is cut */
    var i, k;
    var ccx = g.vx;
    var ccy = g.clothTop + g.clothH / 2;
    var lift = t3 * (g.wide ? (ccy - H / 2) : (g.fanH + g.rd) * 0.7);

    if (gl3) {
      draw3d(g, p, time, W, H, t1, t2, t3, ballT, lift);
    } else {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      var ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      /* --- ball position --- */
      var bob = Math.sin(time * 0.0013) * g.hero.r * 0.035 * (1 - ballT);
      var bx = lerp(g.hero.x, g.dock.x, ballT);
      var by = lerp(g.hero.y, g.dock.y, ballT) + bob;
      var br = lerp(g.hero.r, g.rd, ballT) * (1 - 0.18 * smooth(0.3, 0.74, p));
      var rot = p * 15 + time * 0.00016;

      /* --- loose thread hanging from the ball, pulled taut as it docks --- */
      var endY = lerp(H + 60, g.fanTop, smooth(0.06, 0.24, p));
      var endX = lerp(g.tailX, g.vx, ballT);
      var amp = g.hero.r * 0.2 * (1 - smooth(0.1, 0.25, p));
      var tail = [];
      for (i = 0; i <= 48; i++) {
        var u = i / 48;
        var wob = Math.sin(u * 8.5 - time * 0.0014 - p * 60) * amp * Math.sin(Math.PI * Math.min(1, u * 1.15));
        tail.push([lerp(bx, endX, tailEase(u, g.wide)) + wob, lerp(by, endY, u)]);
      }
      ctx.globalAlpha = loomAlpha;
      ctx.strokeStyle = C.yarn;
      ctx.lineWidth = g.tw * 1.35;
      strokePartial(ctx, tail, 1);

      /* --- warp fan: the single thread splits into strands --- */
      ctx.lineWidth = g.tw;
      var warpBody = [];
      for (i = 0; i < COLS; i++) {
        var x = g.clothLeft + (i + 0.5) * g.cw;
        var spread = Math.abs(i - (COLS - 1) / 2) / COLS;
        var f = clamp01(t1 * 1.45 - spread * 0.9);
        var fan = [];
        for (k = 0; k <= 16; k++) {
          var v = k / 16;
          var iv = 1 - v;
          /* cubic bezier from the gathering point down to this strand's column */
          fan.push([
            iv * iv * iv * g.vx + 3 * iv * iv * v * g.vx + 3 * iv * v * v * x + v * v * v * x,
            iv * iv * iv * g.fanTop + 3 * iv * iv * v * (g.fanTop + g.fanH * 0.6) + 3 * iv * v * v * (g.clothTop - g.fanH * 0.6) + v * v * v * g.clothTop
          ]);
        }
        strokePartial(ctx, fan, clamp01(f / 0.38));
        warpBody.push(clamp01((f - 0.38) / 0.62));
      }

      drawBall(ctx, bx, by, br, rot, loomAlpha);
      ctx.globalAlpha = 1;

      /* --- the cloth: warp bodies, woven code, hem --- */
      var ccx = g.vx;
      var ccy = g.clothTop + g.clothH / 2;
      var lift = t3 * (g.wide ? (ccy - H / 2) : (g.fanH + g.rd) * 0.7);
      ctx.save();
      ctx.translate(ccx, ccy - lift);
      ctx.rotate(-0.05 * t3);
      ctx.scale(1 + 0.1 * t3, 1 + 0.1 * t3);
      ctx.translate(-ccx, -ccy);

      var clothBottom = g.clothTop + g.clothH;
      ctx.strokeStyle = C.yarn;
      ctx.lineWidth = g.tw;
      ctx.lineCap = 'butt';
      for (i = 0; i < COLS; i++) {
        if (warpBody[i] <= 0) continue;
        var wx = g.clothLeft + (i + 0.5) * g.cw;
        ctx.beginPath();
        ctx.moveTo(wx, g.clothTop - g.fringe * t3);
        ctx.lineTo(wx, lerp(g.clothTop, clothBottom + g.fringe, warpBody[i]));
        ctx.stroke();
      }

      var rowsN = CODE_ROWS.length;
      var hF = g.pitch * 0.5;
      var shuttle = null;
      for (k = 0; k < rowsN; k++) {
        var segs = CODE_ROWS[k];
        if (!segs.length) continue;
        var rp = clamp01(t2 * (rowsN + 0.6) - k);
        if (rp <= 0) continue;
        var reach = (1 - Math.pow(1 - rp, 2)) * COLS;
        var y = g.clothTop + (k + 0.5) * g.pitch;
        var lastX = null;
        for (var sIdx = 0; sIdx < segs.length; sIdx++) {
          var seg = segs[sIdx];
          for (i = seg[0]; i < seg[1]; i++) {
            if (i >= reach) break;
            var x0 = g.clothLeft + i * g.cw + (i === seg[0] ? g.cw * 0.12 : 0);
            var x1 = g.clothLeft + Math.min(i + 1, reach) * g.cw - (i === seg[1] - 1 ? g.cw * 0.12 : 0);
            if (x1 <= x0) continue;
            ctx.fillStyle = C[seg[2]];
            ctx.fillRect(x0, y - hF / 2, x1 - x0, hF);
            lastX = x1;
            if ((i + k) % 2 === 1) {
              /* here the warp passes over the weft */
              var px = g.clothLeft + (i + 0.5) * g.cw;
              if (px + g.tw < x1 && px - g.tw > x0) {
                ctx.fillStyle = C.bg;
                ctx.fillRect(px - g.tw / 2 - 1.6, y - hF / 2 - 0.5, g.tw + 3.2, hF + 1);
                ctx.fillStyle = C.yarn;
                ctx.fillRect(px - g.tw / 2, y - g.pitch / 2, g.tw, g.pitch);
              }
            }
          }
        }
        if (rp < 1 && lastX !== null) shuttle = { x: lastX, y: y };
      }

      if (shuttle) {
        /* the shuttle that carries the weft */
        ctx.fillStyle = C.fg;
        ctx.beginPath();
        ctx.ellipse(shuttle.x + g.cw * 0.5, shuttle.y, g.cw * 0.85, hF * 0.62, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = C.kw;
        ctx.beginPath();
        ctx.ellipse(shuttle.x + g.cw * 0.5, shuttle.y, g.cw * 0.42, hF * 0.24, 0, 0, TAU);
        ctx.fill();
      }

      if (t3 > 0) {
        /* running-stitch hem */
        var pad = g.s * 0.085;
        var rx = g.clothLeft - pad;
        var ry = g.clothTop - pad;
        var rw = g.s + pad * 2;
        var rhh = g.clothH + pad * 2;
        var cr = g.s * 0.05;
        var hem = [];
        var corners = [
          [rx + cr, ry + cr, Math.PI, 1.5 * Math.PI],
          [rx + rw - cr, ry + cr, 1.5 * Math.PI, TAU],
          [rx + rw - cr, ry + rhh - cr, 0, 0.5 * Math.PI],
          [rx + cr, ry + rhh - cr, 0.5 * Math.PI, Math.PI]
        ];
        for (var cI = 0; cI < 4; cI++) {
          for (k = 0; k <= 6; k++) {
            var a = lerp(corners[cI][2], corners[cI][3], k / 6);
            hem.push([corners[cI][0] + Math.cos(a) * cr, corners[cI][1] + Math.sin(a) * cr]);
          }
        }
        hem.push(hem[0]);
        ctx.strokeStyle = C.kw;
        ctx.lineWidth = g.tw * 1.5;
        ctx.lineCap = 'round';
        ctx.setLineDash([g.tw * 4.2, g.tw * 3.4]);
        strokePartial(ctx, hem, t3);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    /* --- DOM layers: only the pinned stage is driven from scroll; the stacked layout keeps its own flow --- */
    if (!live) return;
    if (heroEl) {
      var hv = 1 - smooth(0.05, 0.17, p);
      heroEl.style.opacity = hv.toFixed(3);
      heroEl.style.transform = 'translateY(' + (-smooth(0.02, 0.2, p) * H * 0.22).toFixed(1) + 'px)';
      heroEl.style.pointerEvents = hv > 0.5 ? '' : 'none';
    }
    if (hintEl) hintEl.style.opacity = (1 - smooth(0.01, 0.06, p)).toFixed(3);
    if (dotEls.length) {
      var di = p < 0.22 ? 0 : p < 0.47 ? 1 : p < 0.72 ? 2 : 3;
      dotEls.forEach(function (d, j) { d.classList.toggle('is-on', j === di); });
    }

    chapterEls.forEach(function (el, idx) {
      var win = CHAPTER_WINDOWS[idx];
      if (!win) return;
      var fadeIn = smooth(win[0], win[0] + 0.05, p);
      var fadeOut = 1 - smooth(win[1] - 0.045, win[1], p);
      var vis = fadeIn * fadeOut;
      el.style.opacity = vis.toFixed(3);
      el.style.setProperty('--dy', ((1 - fadeIn) * 46 - (1 - fadeOut) * 46).toFixed(1) + 'px');
      var act = vis > 0.6;
      if (act && !el.classList.contains('is-active')) decodeText(el.querySelector('h2'), 650);
      el.classList.toggle('is-active', act);
    });

    /* file names ride the warp in chapter 1 */
    var edgeL = g.wide ? g.clothLeft - g.s * 0.1 : g.clothLeft + g.s * 0.04;
    var edgeR = g.wide ? g.clothLeft + g.s * 1.1 : g.clothLeft + g.s * 0.96;
    var out1 = 1 - smooth(0.42, 0.47, p);
    var drift = (p - 0.34) * H * -0.5;
    placeTag(tagEls.f0, edgeL, g.clothTop + g.clothH * 0.12 + drift * 0.8, -7, smooth(0.27, 0.31, p) * out1, W);
    placeTag(tagEls.f1, edgeR, g.clothTop + g.clothH * 0.3 + drift * 1.3, 5, smooth(0.3, 0.34, p) * out1, W);
    placeTag(tagEls.f2, edgeL, g.clothTop + g.clothH * 0.62 + drift * 1.1, 4, smooth(0.33, 0.37, p) * out1, W);
    placeTag(tagEls.f3, edgeR, g.clothTop + g.clothH * 0.84 + drift * 0.6, -5, smooth(0.36, 0.4, p) * out1, W);

    /* checks land on the finished cloth in chapter 3 */
    var cy3 = ccy - lift;
    var half = g.s * 0.55;
    var settle = function (a, b) { return (1 - smooth(a, b, p)) * 30; };
    placeTag(tagEls.d0, ccx - half * (g.wide ? 1.12 : 0.8), cy3 - g.clothH * 0.5 + settle(0.8, 0.86), -8, smooth(0.8, 0.86, p), W);
    placeTag(tagEls.d1, ccx + half * (g.wide ? 1.15 : 0.82), cy3 - g.clothH * 0.05 + settle(0.84, 0.9), 6, smooth(0.84, 0.9, p), W);
    placeTag(tagEls.d2, ccx - half * (g.wide ? 1.05 : 0.7), cy3 + g.clothH * 0.52 + settle(0.88, 0.94), 5, smooth(0.88, 0.94, p), W);
  }

  /* ---------- 3D: the same story, lit like a product shot ----------
     three.js draws a wound yarn ball, a loose thread, the warp fan and a woven cloth
     whose weft rows are lines of code. Positions come from geometry(), in CSS pixels,
     so the 3D scene and the 2D fallback share one layout. */

  var gl3 = null;

  /* pointer position, -1..1, eased each frame; only for mouse and trackpad users */
  var lean = { x: 0, y: 0, tx: 0, ty: 0 };
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      lean.tx = e.clientX / window.innerWidth * 2 - 1;
      lean.ty = e.clientY / window.innerHeight * 2 - 1;
    }, { passive: true });
  }
  var introStart = 0;   /* set when the hero intro runs; 0 means no intro */
  function easeOutBack(x) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function seeded(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function init3d() {
    var T = window.THREE;
    if (!T || !cv || !cv.parentNode) return null;
    var canvas = document.createElement('canvas');
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { return null; }
    if (!renderer || !renderer.getContext()) return null;

    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(22, 1, 1, 200);
    camera.position.set(0, 0, 40);

    var hemi = new T.HemisphereLight(0xf2f5ff, 0x6c7290, 0.6);
    scene.add(hemi);
    var key = new T.DirectionalLight(0xffffff, 0.85);
    key.position.set(-6, 9, 26);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);
    var rim = new T.DirectionalLight(0x3de0ff, 0.55);   /* cyan rim from the back right */
    rim.position.set(16, -4, -12);
    scene.add(rim);
    var rim2 = new T.DirectionalLight(0x8a5cff, 0.35);  /* violet rim from the back left */
    rim2.position.set(-16, 6, -10);
    scene.add(rim2);

    /* an invisible wall behind everything that only catches the soft shadow */
    var wall = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: 0.12 }));
    wall.receiveShadow = true;
    scene.add(wall);

    function col(hex) { return new T.Color(hex).convertSRGBToLinear(); }
    /* glossy synthetic thread, lit like a product shot */
    function wool(hex, rough) { return new T.MeshStandardMaterial({ color: col(hex), roughness: rough || 0.36, metalness: 0.15, emissive: col(hex), emissiveIntensity: 0.08 }); }
    var yarnLight = col(C.yarnHi).lerp(col(C.yarn), 0.45);
    var mats = {
      warp: wool(C.yarn),
      kw: wool(C.kw, 0.7),
      str: wool(C.str, 0.74),
      fn: wool(C.fn, 0.76),
      plain: new T.MeshStandardMaterial({ color: yarnLight, roughness: 0.36, metalness: 0.15, emissive: yarnLight, emissiveIntensity: 0.08 }),
      ink: new T.MeshStandardMaterial({ color: col(C.fg), roughness: 0.35, metalness: 0.1 }),
      gold: new T.MeshStandardMaterial({ color: col(C.kw), roughness: 0.32, metalness: 0.35 })
    };

    /* the yarn ball: bands of parallel strands wound in different directions over a core */
    var ball = new T.Group();
    var core = new T.Mesh(new T.SphereGeometry(0.965, 48, 32), new T.MeshStandardMaterial({ color: col(C.yarnLo), roughness: 0.6, emissive: col(C.yarnLo), emissiveIntensity: 0.1 }));
    core.castShadow = true;
    ball.add(core);
    var BUNDLES = 16;
    var PER = 15;
    var strands = new T.InstancedMesh(new T.TorusGeometry(1, 0.03, 6, 140), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.2, emissive: col(C.yarn), emissiveIntensity: 0.06 }), BUNDLES * PER);
    strands.castShadow = true;
    strands.receiveShadow = true;
    var rnd = seeded(7);
    var zAxis = new T.Vector3(0, 0, 1);
    var m4 = new T.Matrix4();
    var q = new T.Quaternion();
    var spin = new T.Quaternion();
    var origin = new T.Vector3();
    var scl = new T.Vector3();
    var base = col(C.yarn);
    var hi = col(C.yarnHi);
    var lo = col(C.yarnLo);
    var accent = col(C.kw);
    var n = 0;
    for (var b = 0; b < BUNDLES; b++) {
      var axis = new T.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      var radius = 0.975 + b * 0.0035;
      for (var j = 0; j < PER; j++) {
        var isAccent = b === BUNDLES - 3 && j % 3 !== 0;
        var a2 = axis.clone().add(new T.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.34)).normalize();
        q.setFromUnitVectors(zAxis, a2);
        spin.setFromAxisAngle(zAxis, rnd() * Math.PI * 2);
        q.multiply(spin);
        var sr = radius + (rnd() - 0.5) * 0.012;
        scl.set(sr, sr, sr);
        m4.compose(origin, q, scl);
        strands.setMatrixAt(n, m4);
        strands.setColorAt(n, isAccent ? accent : base.clone().lerp(rnd() < 0.5 ? hi : lo, rnd() * 0.22));
        n++;
      }
    }
    strands.instanceMatrix.needsUpdate = true;
    if (strands.instanceColor) strands.instanceColor.needsUpdate = true;
    ball.add(strands);

    /* a soft halo behind the ball, so it reads as lit from within */
    var hc = document.createElement('canvas');
    hc.width = hc.height = 128;
    var hx = hc.getContext('2d');
    var hg = hx.createRadialGradient(64, 64, 0, 64, 64, 64);
    hg.addColorStop(0, 'rgba(255,255,255,1)');
    hg.addColorStop(0.35, 'rgba(255,255,255,.35)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    hx.fillStyle = hg;
    hx.fillRect(0, 0, 128, 128);
    var haloTex = new T.CanvasTexture(hc);
    function halo(hex, opacity) {
      return new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: col(hex), transparent: true, opacity: opacity, depthWrite: false }));
    }
    var ballHalo = halo(C.yarn, 0.16);
    ballHalo.userData.opacity = [0.16, 0.55];
    ballHalo.scale.set(3.4, 3.4, 1);
    ballHalo.position.z = -1.2;
    ball.add(ballHalo);
    scene.add(ball);

    var tail = new T.Mesh(new T.BufferGeometry(), mats.warp);
    tail.castShadow = true;
    scene.add(tail);

    return {
      T: T, canvas: canvas, renderer: renderer, scene: scene, camera: camera,
      key: key, wall: wall, mats: mats, ball: ball, tail: tail, halo: halo, built: '', loom: null, k: 1,
      hemi: hemi, rim: rim, rim2: rim2, core: core, strands: strands, ballHalo: ballHalo
    };
  }

  function disposeTree(obj) {
    obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
  }

  function tubeOf(pts, r, mat, parent) {
    var T = gl3.T;
    var segs = Math.max(10, pts.length * 3);
    var geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts), segs, r, 8, false);
    var mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return { mesh: mesh, segs: segs, rad: 8 };
  }

  /* show only the part of a tube between two fractions of its length */
  function reveal(t, from, to) {
    var a = Math.floor(clamp01(from) * t.segs);
    var b = Math.floor(clamp01(to) * t.segs);
    if (b <= a) { t.mesh.visible = false; return; }
    t.mesh.visible = true;
    t.mesh.geometry.setDrawRange(a * t.rad * 6, (b - a) * t.rad * 6);
  }

  function build3d(g, W, H) {
    var T = gl3.T;
    var cam = gl3.camera;
    var k = 2 * cam.position.z * Math.tan(T.MathUtils.degToRad(cam.fov / 2)) / H;
    gl3.k = k;
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    gl3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    gl3.renderer.setSize(W, H, false);

    var hw = W * k * 0.65;
    var hh = H * k * 0.65;
    var sc = gl3.key.shadow.camera;
    sc.left = -hw; sc.right = hw; sc.top = hh; sc.bottom = -hh; sc.near = 1; sc.far = 90;
    sc.updateProjectionMatrix();
    gl3.wall.scale.set(W * k * 2, H * k * 2, 1);
    gl3.wall.position.z = -g.hero.r * k * 1.08;

    if (gl3.loom) {
      disposeTree(gl3.loom.fanGroup);
      disposeTree(gl3.loom.cloth);
      gl3.scene.remove(gl3.loom.fanGroup);
      gl3.scene.remove(gl3.loom.cloth);
    }

    function P(x, y, z) { return new T.Vector3((x - W / 2) * k, -(y - H / 2) * k, z || 0); }
    var L = { fanGroup: new T.Group(), cloth: new T.Group(), fans: [], warps: [], wefts: [] };
    var c = P(g.vx, g.clothTop + g.clothH / 2);
    L.c = c;
    var rw = Math.max(g.tw * 0.6, 1.1) * k;      /* warp: a fine thread */
    var rf = g.pitch * 0.2 * k;                  /* weft: chunky, like a line of code */
    var amp = (rw + rf) * 0.6;                   /* how far threads dip over and under */
    L.rw = rw; L.rf = rf; L.amp = amp;

    var i, j, kk;
    for (i = 0; i < COLS; i++) {
      var x = g.clothLeft + (i + 0.5) * g.cw;
      var len = g.clothH + g.fringe;
      var steps = Math.ceil(len / (g.pitch / 6));
      var pts = [];
      for (j = 0; j <= steps; j++) {
        var y = g.clothTop + len * j / steps;
        var vv = (y - g.clothTop) / g.pitch - 0.5;
        pts.push(P(x, y, -amp * Math.cos(Math.PI * (vv + i))).sub(c));
      }
      L.warps.push(tubeOf(pts, rw, gl3.mats.warp, L.cloth));

      /* the fan: from the point under the ball out to this column */
      var fan = [];
      for (j = 0; j <= 18; j++) {
        var v = j / 18;
        var iv = 1 - v;
        fan.push(P(
          iv * iv * iv * g.vx + 3 * iv * iv * v * g.vx + 3 * iv * v * v * x + v * v * v * x,
          iv * iv * iv * g.fanTop + 3 * iv * iv * v * (g.fanTop + g.fanH * 0.6) + 3 * iv * v * v * (g.clothTop - g.fanH * 0.6) + v * v * v * g.clothTop,
          0
        ));
      }
      L.fans.push(tubeOf(fan, rw, gl3.mats.warp, L.fanGroup));
    }

    for (kk = 0; kk < CODE_ROWS.length; kk++) {
      var segsRow = CODE_ROWS[kk];
      var yRow = g.clothTop + (kk + 0.5) * g.pitch;
      for (var sI = 0; sI < segsRow.length; sI++) {
        var seg = segsRow[sI];
        var x0 = g.clothLeft + seg[0] * g.cw + g.cw * 0.12;
        var x1 = g.clothLeft + seg[1] * g.cw - g.cw * 0.12;
        var n = Math.max(3, Math.ceil((x1 - x0) / (g.cw / 8)));
        var wp = [];
        for (j = 0; j <= n; j++) {
          var xx = x0 + (x1 - x0) * j / n;
          var u = (xx - g.clothLeft) / g.cw - 0.5;
          wp.push(P(xx, yRow, amp * Math.cos(Math.PI * (u + kk))).sub(c));
        }
        var t = tubeOf(wp, rf, gl3.mats[seg[2]], L.cloth);
        t.row = kk; t.c0 = seg[0]; t.c1 = seg[1]; t.y = yRow;
        L.wefts.push(t);
      }
    }

    /* the shuttle that carries the weft */
    var shuttle = new T.Group();
    var body = new T.Mesh(new T.SphereGeometry(1, 28, 18), gl3.mats.ink);
    body.scale.set(g.cw * 0.95 * k, rf * 1.55, rf * 1.55);
    body.castShadow = true;
    var bobbin = new T.Mesh(new T.CylinderGeometry(rf * 0.7, rf * 0.7, g.cw * 0.8 * k, 18), gl3.mats.gold);
    bobbin.rotation.z = Math.PI / 2;
    bobbin.position.z = rf * 0.9;
    shuttle.add(body);
    shuttle.add(bobbin);
    L.cloth.add(shuttle);
    L.shuttle = shuttle;

    /* running-stitch hem around the finished cloth */
    var pad = g.s * 0.085;
    var rx = g.clothLeft - pad;
    var ry = g.clothTop - pad;
    var rwid = g.s + pad * 2;
    var rhei = g.clothH + pad * 2;
    var cr = g.s * 0.05;
    var poly = [];
    var corners = [
      [rx + cr, ry + cr, Math.PI, 1.5 * Math.PI],
      [rx + rwid - cr, ry + cr, 1.5 * Math.PI, 2 * Math.PI],
      [rx + rwid - cr, ry + rhei - cr, 0, 0.5 * Math.PI],
      [rx + cr, ry + rhei - cr, 0.5 * Math.PI, Math.PI]
    ];
    for (i = 0; i < 4; i++) {
      for (j = 0; j <= 6; j++) {
        var ang = lerp(corners[i][2], corners[i][3], j / 6);
        poly.push([corners[i][0] + Math.cos(ang) * cr, corners[i][1] + Math.sin(ang) * cr]);
      }
    }
    poly.push(poly[0]);
    var stitch = g.tw * 4.2;
    var period = g.tw * 7.6;
    var marks = [];
    var acc = 0;
    var next = 0;
    for (i = 1; i < poly.length; i++) {
      var dx = poly[i][0] - poly[i - 1][0];
      var dy = poly[i][1] - poly[i - 1][1];
      var dl = Math.hypot(dx, dy);
      while (next <= acc + dl) {
        var f = (next - acc) / (dl || 1);
        marks.push([poly[i - 1][0] + dx * f, poly[i - 1][1] + dy * f, Math.atan2(dy, dx)]);
        next += period;
      }
      acc += dl;
    }
    var hem = new T.InstancedMesh(new T.CylinderGeometry(rw * 1.6, rw * 1.6, stitch * k, 8), gl3.mats.kw, marks.length);
    hem.castShadow = true;
    var hq = new T.Quaternion();
    var hm = new T.Matrix4();
    var one = new T.Vector3(1, 1, 1);
    var zA = new T.Vector3(0, 0, 1);
    marks.forEach(function (m, idx) {
      hq.setFromAxisAngle(zA, -m[2] - Math.PI / 2);
      hm.compose(P(m[0], m[1], amp + rf).sub(c), hq, one);
      hem.setMatrixAt(idx, hm);
    });
    hem.instanceMatrix.needsUpdate = true;
    hem.count = 0;
    L.cloth.add(hem);
    L.hem = hem;
    var clothHalo = gl3.halo(C.cyan || C.yarn, 0.07);
    clothHalo.scale.set(g.s * k * 1.9, g.clothH * k * 2.1, 1);
    clothHalo.position.z = -L.amp * 6;
    clothHalo.userData.opacity = [0.07, 0.16];
    L.cloth.add(clothHalo);
    L.clothHalo = clothHalo;
    L.hemN = marks.length;

    gl3.scene.add(L.fanGroup);
    gl3.scene.add(L.cloth);
    gl3.loom = L;
    theme3d();
  }

  /* light: glossy thread with soft shadows; dark: the same thread glowing on a night screen */
  function theme3d() {
    if (!gl3) return;
    var T = gl3.T;
    var dark = isDark();
    gl3.hemi.intensity = dark ? 0.4 : 0.6;
    gl3.hemi.groundColor.set(dark ? 0x05060f : 0x6c7290);
    gl3.key.intensity = dark ? 0.7 : 0.85;
    gl3.rim.intensity = dark ? 1.1 : 0.55;
    gl3.rim2.intensity = dark ? 0.7 : 0.35;
    gl3.wall.visible = !dark;
    Object.keys(gl3.mats).forEach(function (k) {
      var m = gl3.mats[k];
      if (k !== 'ink' && k !== 'gold') m.emissiveIntensity = dark ? 0.3 : 0.08;
    });
    gl3.strands.material.emissiveIntensity = dark ? 0.12 : 0.06;
    gl3.core.material.emissiveIntensity = dark ? 0.4 : 0.1;
    [gl3.ballHalo, gl3.loom && gl3.loom.clothHalo].forEach(function (h) {
      if (!h) return;
      h.material.blending = dark ? T.AdditiveBlending : T.NormalBlending;
      h.material.opacity = h.userData.opacity[dark ? 1 : 0];
      h.material.needsUpdate = true;
    });
  }

  function draw3d(g, p, time, W, H, t1, t2, t3, ballT, lift) {
    var T = gl3.T;
    var sig = W + 'x' + H + ':' + Math.round(g.hero.x) + ',' + Math.round(g.hero.y);
    if (gl3.built !== sig) { build3d(g, W, H); gl3.built = sig; }
    var k = gl3.k;
    var L = gl3.loom;
    function P(x, y, z) { return new T.Vector3((x - W / 2) * k, -(y - H / 2) * k, z || 0); }
    var i;

    /* ball */
    var bob = Math.sin(time * 0.0013) * g.hero.r * 0.035 * (1 - ballT);
    var bx = lerp(g.hero.x, g.dock.x, ballT);
    var by = lerp(g.hero.y, g.dock.y, ballT) + bob;
    var br = lerp(g.hero.r, g.rd, ballT) * (1 - 0.18 * smooth(0.3, 0.74, p));
    var rot = p * 9 + time * 0.00012;
    var gone = smooth(0.74, 0.86, p);
    if (!reduceMotion.matches) {
      lean.x += (lean.tx - lean.x) * 0.06;
      lean.y += (lean.ty - lean.y) * 0.06;
    }
    var intro = introStart && time ? clamp01((time - introStart - 250) / 1300) : 1;
    var sBall = br * k * (1 - gone) * Math.max(0.0001, easeOutBack(intro));
    gl3.ball.visible = sBall > 0.002;
    gl3.ball.position.copy(P(bx, by, 0));
    gl3.ball.scale.setScalar(Math.max(sBall, 0.0001));
    gl3.ball.position.x += lean.x * br * k * 0.08;
    gl3.ball.position.y -= lean.y * br * k * 0.06;
    gl3.ball.rotation.set(0.4 + rot * 0.15 + lean.y * 0.35, rot + lean.x * 0.6 + (1 - intro) * 4, 0.25);

    /* loose thread hanging from the ball, pulled taut as it docks */
    var endY = lerp(H + 80, g.fanTop, smooth(0.06, 0.24, p));
    var endX = lerp(g.tailX, g.vx, ballT);
    var amp = g.hero.r * 0.2 * (1 - smooth(0.1, 0.25, p));
    var pts = [];
    for (i = 0; i <= 40; i++) {
      var u = i / 40;
      var wob = Math.sin(u * 8.5 - time * 0.0014 - p * 60) * amp * Math.sin(Math.PI * Math.min(1, u * 1.15));
      var depth = Math.sin(u * 5 - time * 0.001) * amp * k * 0.6;
      pts.push(P(lerp(bx, endX, tailEase(u, g.wide)) + wob, lerp(by, endY, u), depth));
    }
    gl3.tail.geometry.dispose();
    gl3.tail.geometry = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 120, L.rw * 1.25, 8, false);
    gl3.tail.visible = gone < 0.98;
    if (gone > 0) gl3.tail.geometry.setDrawRange(Math.floor(gone * 120) * 8 * 6, Infinity);

    /* fan and warp */
    for (i = 0; i < COLS; i++) {
      var spread = Math.abs(i - (COLS - 1) / 2) / COLS;
      var f = clamp01(t1 * 1.45 - spread * 0.9);
      reveal(L.fans[i], gone, f / 0.38);
      reveal(L.warps[i], 0, (f - 0.38) / 0.62);
    }

    /* weft rows: each row is thrown a little after the one above it */
    var rowsN = CODE_ROWS.length;
    var head = null;
    L.wefts.forEach(function (w) {
      var rp = clamp01(t2 * (rowsN + 0.6) - w.row);
      var reach = (1 - Math.pow(1 - rp, 2)) * COLS;
      var frac = (reach - w.c0) / (w.c1 - w.c0);
      reveal(w, 0, frac);
      if (rp > 0 && rp < 1 && frac > 0) {
        head = { x: g.clothLeft + Math.min(reach, w.c1) * g.cw, y: w.y };
      }
    });
    L.shuttle.visible = !!head;
    if (head) L.shuttle.position.copy(P(head.x + g.cw * 0.45, head.y, L.amp + L.rf * 0.6).sub(L.c));

    /* chapter 3: the cloth is cut, turned towards you and hemmed */
    L.cloth.position.copy(L.c);
    L.cloth.position.y += lift * k;
    L.cloth.rotation.set(-0.14 * t3 + lean.y * 0.1, (g.wide ? 0.3 : 0.18) * t3 + lean.x * 0.16, -0.05 * t3);
    L.cloth.scale.setScalar(1 + 0.1 * t3);
    L.hem.count = Math.floor(t3 * L.hemN);
    L.hem.visible = L.hem.count > 0;

    gl3.renderer.render(gl3.scene, gl3.camera);
  }

  var live = false;
  var inView = true;
  var pNow = 0;
  var rafId = 0;

  function targetProgress() {
    var rect = story.getBoundingClientRect();
    var top = parseFloat(getComputedStyle(stage).top) || 0;
    var total = rect.height - stage.offsetHeight;
    return total > 0 ? clamp01((top - rect.top) / total) : 0;
  }

  function frame(now) {
    rafId = 0;
    if (!live) return;
    var target = targetProgress();
    pNow += (target - pNow) * 0.16;
    if (Math.abs(target - pNow) < 0.0004) pNow = target;
    render(pNow, now);
    if (inView) rafId = requestAnimationFrame(frame);
  }
  function kick() { if (live && !rafId) rafId = requestAnimationFrame(frame); }

  function resetStageStyles() {
    if (heroEl) { heroEl.style.opacity = ''; heroEl.style.transform = ''; heroEl.style.pointerEvents = ''; }
    if (hintEl) hintEl.style.opacity = '';
    chapterEls.forEach(function (el) {
      el.style.opacity = '';
      el.style.removeProperty('--dy');
      el.classList.remove('is-active');
    });
  }

  function setMode() {
    if (!story || !stage || !cv || !cv.getContext) return;
    /* pin only when motion is welcome and the screen is tall enough to hold the stage */
    var wantLive = !reduceMotion.matches && window.innerHeight >= 400;
    if (wantLive === live && (live || cv.classList.contains('is-static'))) {
      if (!live) render(0.97, 0);
      return;
    }
    live = wantLive;
    story.classList.toggle('is-live', live);
    cv.classList.toggle('is-static', !live);
    if (live) {
      pNow = targetProgress();
      kick();
    } else {
      resetStageStyles();
      render(0.97, 0);   /* the stacked layout shows the finished cloth */
    }
  }

  /* hero intro: type the command, then the headline rises and the ball spins in */
  function runIntro() {
    if (reduceMotion.matches || !live || window.scrollY > 40) { introStart = 0; return; }
    root.classList.add('intro-run');
    introStart = performance.now();
    var cmd = $('.prompt .cmd');
    if (cmd) {
      var full = cmd.textContent;
      cmd.textContent = '';
      var i = 0;
      var typer = setInterval(function () {
        i++;
        cmd.textContent = full.slice(0, i);
        if (i >= full.length) { clearInterval(typer); setTimeout(cycleCommands, 2600); }
      }, 38);
    }
    setTimeout(function () { root.classList.remove('intro-run'); }, 2200);
  }

  /* the prompt keeps working: each ScriptWeave command is typed, held, then deleted */
  function cycleCommands() {
    var cmd = $('.prompt .cmd');
    if (!cmd || reduceMotion.matches) return;
    var list = ['scriptweave review', 'scriptweave test', 'scriptweave docs', 'scriptweave agen', 'scriptweave init'];
    var at = 0;
    function erase(done) {
      var t = setInterval(function () {
        var v = cmd.textContent;
        if (v.length <= 'scriptweave '.length) { clearInterval(t); done(); return; }
        cmd.textContent = v.slice(0, -1);
      }, 32);
    }
    function type(word, done) {
      var t = setInterval(function () {
        var v = cmd.textContent;
        if (v.length >= word.length) { clearInterval(t); done(); return; }
        cmd.textContent = word.slice(0, v.length + 1);
      }, 55);
    }
    (function next() {
      var word = list[at % list.length];
      at++;
      erase(function () { type(word, function () { setTimeout(next, 2200); }); });
    })();
  }

  if (story && stage && cv) {
    readColors();
    /* the ball's spin-in is timed from here, so the very first frame already starts small */
    if (!reduceMotion.matches && window.scrollY <= 40) introStart = preloaderDone ? performance.now() : 1e12;
    gl3 = init3d();
    if (gl3) {
      gl3.canvas.id = cv.id;
      gl3.canvas.className = cv.className;
      gl3.canvas.setAttribute('aria-hidden', 'true');
      cv.parentNode.replaceChild(gl3.canvas, cv);
      cv = gl3.canvas;
    }
    setMode();
    window.addEventListener('scroll', kick, { passive: true });
    var storyResize;
    window.addEventListener('resize', function () {
      clearTimeout(storyResize);
      storyResize = setTimeout(function () { setMode(); kick(); }, 100);
    });
    onChange(reduceMotion, setMode);
    whenLoaded(runIntro);
    function recolor() { readColors(); theme3d(); if (live) kick(); else render(0.97, 0); }
    onThemeChange = recolor;
    onChange(darkScheme, recolor);
    if ('MutationObserver' in window) {
      new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) kick();
      }).observe(story);
    }
    /* the headline's metrics change when the display face arrives */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (live) kick(); else render(0.97, 0); });
  }

  /* ---------- editor demo ---------- */

  var codeEl = $('#demo-code');
  var statusEl = $('#demo-status');
  var replayBtn = $('#demo-replay');
  var editorEl = codeEl ? codeEl.closest('.editor') : null;
  var demoRun = 0;

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function textNodes(el) {
    var out = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) out.push(node);
    return out;
  }

  function settleDemo() {
    if (!codeEl) return;
    $$('.line', codeEl).forEach(function (line) {
      line.classList.remove('is-ghost', 'is-hidden', 'is-fresh', 'is-caret');
    });
    if (editorEl) editorEl.classList.remove('is-busy');
    setText(statusEl, 'Diterima, 6 baris ditambahkan');
  }

  function playDemo() {
    if (!codeEl) return;
    var run = ++demoRun;
    var promptLine = $('[data-role="prompt"]', codeEl);
    var suggestLines = $$('[data-role="suggest"]', codeEl);
    if (!promptLine || !suggestLines.length) return;

    function stale() { return run !== demoRun; }

    settleDemo();
    var nodes = textNodes(promptLine);
    var originals = nodes.map(function (n) { return n.nodeValue; });
    function restorePrompt() { nodes.forEach(function (n, i) { n.nodeValue = originals[i]; }); }

    suggestLines.forEach(function (l) { l.classList.add('is-hidden'); });
    nodes.forEach(function (n) { n.nodeValue = ''; });
    promptLine.classList.add('is-caret');
    if (editorEl) editorEl.classList.add('is-busy');
    setText(statusEl, 'Kamu mengetik komentar');

    (async function () {
      await wait(500);
      for (var n = 0; n < nodes.length; n++) {
        for (var c = 1; c <= originals[n].length; c++) {
          if (stale()) { restorePrompt(); return; }
          nodes[n].nodeValue = originals[n].slice(0, c);
          await wait(34);
        }
      }
      if (stale()) { restorePrompt(); return; }
      promptLine.classList.remove('is-caret');
      setText(statusEl, 'Menenun saran dari 3 file konteks');
      await wait(650);

      for (var i = 0; i < suggestLines.length; i++) {
        if (stale()) return;
        suggestLines[i].classList.remove('is-hidden');
        suggestLines[i].classList.add('is-ghost');
        await wait(130);
      }
      if (stale()) return;
      setText(statusEl, 'Saran siap, tekan Tab untuk terima');
      await wait(1100);

      if (stale()) return;
      suggestLines.forEach(function (l) { l.classList.remove('is-ghost'); l.classList.add('is-fresh'); });
      if (editorEl) editorEl.classList.remove('is-busy');
      setText(statusEl, 'Diterima, 6 baris ditambahkan');
      await wait(1200);

      if (stale()) return;
      suggestLines.forEach(function (l) { l.classList.remove('is-fresh'); });
    })();
  }

  /* the finished code is the resting state; the demo plays once when the editor scrolls into view */
  if (editorEl && !reduceMotion.matches && 'IntersectionObserver' in window) {
    var demoWatch = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      demoWatch.disconnect();
      playDemo();
    }, { threshold: 0.6 });
    demoWatch.observe(editorEl);
  }
  if (replayBtn) {
    replayBtn.addEventListener('click', function () {
      if (reduceMotion.matches) { settleDemo(); return; }
      playDemo();
    });
  }

  /* ---------- agent mode: tabs, terminal panels and notes move together ---------- */

  var agentTabs = $$('.agent-tabs [role="tab"]');
  var agentPanels = $$('.term[role="tabpanel"]');
  var agentNotes = $$('.note');

  function selectAgent(key, moveFocus) {
    agentTabs.forEach(function (tab) {
      var on = tab.getAttribute('data-key') === key;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && moveFocus) tab.focus();
      if (on && tab.scrollIntoView && tab.parentNode.scrollWidth > tab.parentNode.clientWidth) {
        tab.parentNode.scrollLeft = tab.offsetLeft - 16;
      }
    });
    agentPanels.forEach(function (panel) { panel.hidden = panel.getAttribute('data-key') !== key; });
    agentNotes.forEach(function (note) {
      var on = note.getAttribute('data-key') === key;
      note.classList.toggle('is-open', on);
      var head = $('.note-head', note);
      if (head) head.setAttribute('aria-expanded', String(on));
    });
  }

  if (agentTabs.length) {
    agentTabs.forEach(function (tab, idx) {
      tab.addEventListener('click', function () { selectAgent(tab.getAttribute('data-key'), false); });
      tab.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = agentTabs[(idx + step + agentTabs.length) % agentTabs.length];
        selectAgent(next.getAttribute('data-key'), true);
      });
    });
    agentNotes.forEach(function (note) {
      var head = $('.note-head', note);
      if (head) head.addEventListener('click', function () { selectAgent(note.getAttribute('data-key'), false); });
    });
    selectAgent(agentTabs[0].getAttribute('data-key'), false);
  }

  /* ---------- pricing ---------- */

  var billButtons = $$('.bill-toggle button');
  var billToggle = $('.bill-toggle');
  var billThumb = $('.bill-thumb');

  /* the thumb slides under whichever period is chosen */
  function placeThumb() {
    if (!billThumb || !billToggle) return;
    var on = $('.bill-toggle button.is-on');
    if (!on || !on.offsetWidth) return;
    billThumb.style.width = on.offsetWidth + 'px';
    billThumb.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    billToggle.classList.add('has-thumb');
  }

  /* replay the price swap animation on an amount */
  function swapAnim(el) {
    el.classList.toggle('is-changing', false);
    requestAnimationFrame(function () { el.classList.toggle('is-changing', true); });
  }

  function setBilling(mode) {
    var changed = mode !== billMode;
    billButtons.forEach(function (b) {
      var on = b.getAttribute('data-bill') === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    billMode = mode;
    $$('.plans [data-' + mode + ']').forEach(function (el) {
      if (el.classList.contains('amt')) {
        el.textContent = el.getAttribute('data-' + mode);
        if (changed && !reduceMotion.matches) swapAnim(el);
      } else {
        setText(el, el.getAttribute('data-' + mode));
      }
    });
    placeThumb();
  }
  window.addEventListener('resize', placeThumb);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeThumb);
  var billMode = 'monthly';
  placeThumb();
  billButtons.forEach(function (b) {
    b.addEventListener('click', function () { setBilling(b.getAttribute('data-bill')); });
  });

  /* the highlight follows the plan you click or tab into */
  var planCards = $$('[data-plan-card]');
  var planSelect = $('#f-paket');
  function selectPlan(card) {
    planCards.forEach(function (c) { c.classList.toggle('is-selected', c === card); });
  }
  planCards.forEach(function (card) {
    card.addEventListener('click', function () {
      selectPlan(card);
      if (planSelect) planSelect.value = card.getAttribute('data-plan-card');
    });
    card.addEventListener('focusin', function () { selectPlan(card); });
  });

  /* a plan button carries its choice into the contact form */
  $$('[data-plan]').forEach(function (el) {
    el.addEventListener('click', function () {
      if (planSelect) planSelect.value = el.getAttribute('data-plan');
    });
  });

  /* ---------- contact ---------- */

  $$('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var source = document.getElementById(btn.getAttribute('data-copy'));
      if (!source) return;
      function done(key) {
        setText(btn, key);
        setTimeout(function () { setText(btn, 'Salin'); }, 1600);
      }
      function selectInstead() {
        var range = document.createRange();
        range.selectNodeContents(source);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        done('Terpilih');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(source.textContent.trim()).then(function () { done('Tersalin'); }, selectInstead);
      } else {
        selectInstead();
      }
    });
  });

  var form = $('#contact-form');
  var doneBox = $('#form-done');

  function setError(input, errorEl, show) {
    if (!input || !errorEl) return;
    errorEl.hidden = !show;
    if (show) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  if (form && doneBox) {
    var nama = $('#f-nama');
    var email = $('#f-email');
    var eNama = $('#e-nama');
    var eEmail = $('#e-email');

    nama.addEventListener('input', function () { setError(nama, eNama, false); });
    email.addEventListener('input', function () { setError(email, eEmail, false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var badNama = !nama.value.trim();
      var badEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      setError(nama, eNama, badNama);
      setError(email, eEmail, badEmail);
      if (badNama) { nama.focus(); return; }
      if (badEmail) { email.focus(); return; }

      $('#done-nama').textContent = nama.value.trim().split(/\s+/)[0];
      $('#done-email').textContent = email.value.trim();
      $('#done-paket').textContent = planSelect ? planSelect.value : 'Starter';
      form.hidden = true;
      doneBox.hidden = false;
      doneBox.focus();
    });

    $('#form-again').addEventListener('click', function () {
      form.reset();
      doneBox.hidden = true;
      form.hidden = false;
      nama.focus();
    });
  }
  onLangChange = function () { setBilling(billMode); };
  if (lang === 'en') applyLang('en');
})();
