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

  /* ---------- theme ---------- */

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return darkScheme.matches ? 'dark' : 'light';
  }

  var themeBtn = $('#theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('sw-theme', next); } catch (e) { /* not persisted */ }
    });
  }

  /* ---------- header + mobile nav ---------- */

  var header = $('#site-header');
  var nav = $('#site-nav');
  var navBtn = $('#nav-toggle');

  function setNav(open) {
    if (!nav || !navBtn) return;
    nav.classList.toggle('is-open', open);
    navBtn.setAttribute('aria-expanded', String(open));
    navBtn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  }
  if (navBtn) navBtn.addEventListener('click', function () { setNav(!nav.classList.contains('is-open')); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });

  function onScroll() { if (header) header.classList.toggle('is-scrolled', window.scrollY > 8); }
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

    /* the hero ball rests where the headline's two lines end, overlapping the last letters */
    var rh = wide ? Math.min(W * 0.125, H * 0.26) : W * 0.14;
    var hx = W * 0.72;
    var hy = H * 0.4;
    if (anchorEl && anchorEl.offsetWidth) {
      var lineEnd = anchorEl.offsetLeft + anchorEl.offsetWidth;
      var next = anchorEl.nextElementSibling;
      if (next && next.offsetWidth) lineEnd = Math.max(lineEnd, next.offsetLeft + next.offsetWidth);
      hx = lineEnd + rh * 0.42;
      hy = anchorEl.offsetTop + anchorEl.offsetHeight * 0.98;
    }
    g.hero = { x: Math.min(hx, W - rh - 8), y: hy, r: rh };
    /* where the loose thread leaves the stage */
    g.tailX = wide ? g.hero.x - rh * 0.25 : W - 26;
    return g;
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
    if (!cv || !cv.getContext) return;
    var W = cv.clientWidth;
    var H = cv.clientHeight;
    if (!W || !H) return;
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

    var g = geometry(W, H);
    var ballT = smooth(0.04, 0.24, p);
    var t1 = smooth(0.24, 0.44, p);
    var t2 = smooth(0.47, 0.7, p);
    var t3 = smooth(0.74, 0.93, p);
    var loomAlpha = 1 - t3;           /* ball, tail and fan fade once the cloth is cut */
    var i, k;

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
      tail.push([lerp(bx, endX, u * u * (3 - 2 * u)) + wob, lerp(by, endY, u)]);
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

    /* --- DOM layers: only the pinned stage is driven from scroll; the stacked layout keeps its own flow --- */
    if (!live) return;
    if (heroEl) {
      var hv = 1 - smooth(0.05, 0.17, p);
      heroEl.style.opacity = hv.toFixed(3);
      heroEl.style.transform = 'translateY(' + (-smooth(0.02, 0.2, p) * H * 0.22).toFixed(1) + 'px)';
      heroEl.style.pointerEvents = hv > 0.5 ? '' : 'none';
    }
    if (hintEl) hintEl.style.opacity = (1 - smooth(0.01, 0.06, p)).toFixed(3);

    chapterEls.forEach(function (el, idx) {
      var win = CHAPTER_WINDOWS[idx];
      if (!win) return;
      var fadeIn = smooth(win[0], win[0] + 0.05, p);
      var fadeOut = 1 - smooth(win[1] - 0.045, win[1], p);
      var vis = fadeIn * fadeOut;
      el.style.opacity = vis.toFixed(3);
      el.style.setProperty('--dy', ((1 - fadeIn) * 46 - (1 - fadeOut) * 46).toFixed(1) + 'px');
      el.classList.toggle('is-active', vis > 0.6);
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

  if (story && stage && cv) {
    readColors();
    setMode();
    window.addEventListener('scroll', kick, { passive: true });
    var storyResize;
    window.addEventListener('resize', function () {
      clearTimeout(storyResize);
      storyResize = setTimeout(function () { setMode(); kick(); }, 100);
    });
    onChange(reduceMotion, setMode);
    function recolor() { readColors(); if (live) kick(); else render(0.97, 0); }
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
    if (statusEl) statusEl.textContent = 'Diterima, 6 baris ditambahkan';
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
    if (statusEl) statusEl.textContent = 'Kamu mengetik komentar';

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
      if (statusEl) statusEl.textContent = 'Menenun saran dari 3 file konteks';
      await wait(650);

      for (var i = 0; i < suggestLines.length; i++) {
        if (stale()) return;
        suggestLines[i].classList.remove('is-hidden');
        suggestLines[i].classList.add('is-ghost');
        await wait(130);
      }
      if (stale()) return;
      if (statusEl) statusEl.textContent = 'Saran siap, tekan Tab untuk terima';
      await wait(1100);

      if (stale()) return;
      suggestLines.forEach(function (l) { l.classList.remove('is-ghost'); l.classList.add('is-fresh'); });
      if (editorEl) editorEl.classList.remove('is-busy');
      if (statusEl) statusEl.textContent = 'Diterima, 6 baris ditambahkan';
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
  function setBilling(mode) {
    billButtons.forEach(function (b) {
      var on = b.getAttribute('data-bill') === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $$('.plans [data-' + mode + ']').forEach(function (el) {
      el.textContent = el.getAttribute('data-' + mode);
    });
  }
  billButtons.forEach(function (b) {
    b.addEventListener('click', function () { setBilling(b.getAttribute('data-bill')); });
  });

  /* a plan button carries its choice into the contact form */
  var planSelect = $('#f-paket');
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
      var label = btn.textContent;
      function done(text) {
        btn.textContent = text;
        setTimeout(function () { btn.textContent = label; }, 1600);
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
})();
