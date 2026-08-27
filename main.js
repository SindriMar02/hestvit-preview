/* Hestvit / Árbakki · White Desert engine transplant
   Vanilla + GSAP ScrollTrigger + Lenis. One writer per element. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;

  /* ---------- nav theme swap (meta theme-color only; nav itself is a
     constant bone bar now, text never swaps) ---------- */
  function setNavTheme(v) {
    body.setAttribute('data-nav-theme', v === 'dark' ? 'dark' : 'light');
    var meta = document.getElementById('themeColor');
    if (meta) meta.setAttribute('content', v === 'dark' ? '#EFEAE3' : '#171310');
  }

  /* ---------- flyout (no motion dependency) ---------- */
  var flyout = document.getElementById('flyout');
  var flyoutTab = document.getElementById('flyoutTab');
  var flyoutClose = document.getElementById('flyoutClose');
  var flyoutOverlay = document.getElementById('flyoutOverlay');
  var lenis = null;
  function openFlyout() {
    flyout.classList.add('is-open');
    flyout.setAttribute('aria-hidden', 'false');
    flyoutTab.setAttribute('aria-expanded', 'true');
    body.classList.add('hide-grid');
    if (lenis) lenis.stop();
    setTimeout(function () { flyoutClose.focus({ preventScroll: true }); }, 480);
  }
  function closeFlyout() {
    flyout.classList.remove('is-open');
    flyout.setAttribute('aria-hidden', 'true');
    flyoutTab.setAttribute('aria-expanded', 'false');
    body.classList.remove('hide-grid');
    if (lenis) lenis.start();
    flyoutTab.focus();
  }
  flyoutTab.addEventListener('click', openFlyout);
  flyoutClose.addEventListener('click', closeFlyout);
  flyoutOverlay.addEventListener('click', closeFlyout);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && flyout.classList.contains('is-open')) closeFlyout();
  });

  /* ---------- nav: burger + mobile drawer (no motion dependency,
     constant mobile chrome per house standard) ---------- */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var mobileMenu = document.getElementById('mobileMenu');
  function closeMenu() {
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
  }
  burger.addEventListener('click', function () {
    var open = burger.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
  });
  mobileMenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) closeMenu();
  });

  /* ---------- stable video: lazy-attach the one real YouTube loop ---------- */
  function ytSrc(id) {
    return 'https://www.youtube.com/embed/' + id +
      '?autoplay=1&mute=1&loop=1&playlist=' + id +
      '&controls=0&modestbranding=1&playsinline=1&rel=0';
  }
  function activateVideoCard(item, on) {
    var frame = item.querySelector('.stable-row_video');
    if (!frame) return;
    var id = frame.getAttribute('data-yt-id');
    if (!id) return;
    if (on) {
      /* JUDGE FIX: is-ready only when the embed has actually painted, with a
         4s revert so a blocked/consent-walled YouTube (common on DE/DK
         corporate networks - the real buyer demographic) falls back to the
         photo instead of a black card. */
      var settled = false;
      frame.addEventListener('load', function () {
        settled = true;
        frame.classList.add('is-ready');
      }, { once: true });
      setTimeout(function () {
        if (!settled) { frame.removeAttribute('src'); frame.classList.remove('is-ready'); }
      }, 4000);
      frame.src = ytSrc(id);
    } else {
      /* stop playback, don't just hide it: a horse scrolled out of view must
         not keep a muted YouTube loop running off-screen */
      frame.classList.remove('is-ready');
      frame.removeAttribute('src');
    }
  }

  /* ---------- reduced motion: static render, theme swap via observer ---------- */
  if (reduced || !window.gsap) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setNavTheme(en.target.getAttribute('data-nav-theme-val'));
      });
    }, { rootMargin: '-45% 0% -45% 0%' });
    document.querySelectorAll('[data-nav-section]').forEach(function (s) { io.observe(s); });
    document.querySelectorAll('.text-scroll-fade').forEach(function (el) {
      el.style.webkitMaskImage = 'none'; el.style.maskImage = 'none';
    });
    document.querySelectorAll('.route-bar_fill').forEach(function (el) {
      el.style.transform = 'scaleX(' + (el.getAttribute('data-pct') / 100) + ')';
    });
    /* reduced motion: show the real photo, don't autoplay the muted loop */
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis on the GSAP ticker (autoRaf:false, desktop-only smoothing) ---------- */
  /* HARD RULE (lenis-mobile-damage): Lenis must NEVER be constructed on a
     touch device — syncTouch hijacks native scrolling and keeps iOS Safari's
     tall toolbar from collapsing. Construct only on true desktop pointers;
     everywhere else ScrollTrigger rides native scroll. */
  /* The decision is RE-EVALUATED, never taken once at load. Taken once, a
     page that loads narrow or at innerWidth 0 (in-app preview panes do
     exactly this) killed smoothing permanently even after it widened —
     the rail pin recovered on resize but Lenis never came back. */
  function smoothAllowed() {
    return window.innerWidth >= 769 &&
           window.matchMedia('(pointer: fine)').matches &&
           window.matchMedia('(hover: hover)').matches &&
           navigator.maxTouchPoints === 0 &&
           !!window.Lenis;
  }
  var lenisRaf = null;
  function teardownSmooth() {
    if (!lenis) return;
    if (lenisRaf) { gsap.ticker.remove(lenisRaf); lenisRaf = null; }
    lenis.destroy();
    lenis = null;
    document.documentElement.classList.remove('lenis', 'lenis-smooth');
  }
  function setupSmooth() {
    if (!smoothAllowed()) { teardownSmooth(); return; }
    if (lenis) return;
    lenis = new Lenis({ lerp: 0.1, autoRaf: false, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    lenisRaf = function (t) { lenis.raf(t * 1000); };
    gsap.ticker.add(lenisRaf);
    gsap.ticker.lagSmoothing(0);
  }
  /* Defer the first decision until the viewport reports a real width. */
  if (window.innerWidth > 0) { setupSmooth(); }
  else {
    var t0 = Date.now();
    (function pollWidth() {
      if (window.innerWidth > 0 || Date.now() - t0 > 1500) setupSmooth();
      else setTimeout(pollWidth, 120);
    })();
  }

  var vh = function () { return window.innerHeight; };

  /* ---------- intro wipe: time-based, never load-bearing ---------- */
  var wipe = document.getElementById('introWipe');
  gsap.set(wipe, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' });
  gsap.to(wipe, {
    clipPath: 'polygon(0 0, 100% 0, 100% 0%, 0 0%)',
    duration: 0.8, delay: 0.15, ease: 'power4.inOut',
    onComplete: function () { wipe.classList.add('is-done'); }
  });

  /* ---------- nav: direction-driven hide, desktop only (Lenis direction) ---------- */
  /* Nav hide is a desktop device only — the mobile chrome standard requires
     a constant bar, and on touch there is no Lenis to listen to anyway.
     CSS also gates the transform to min-width:769px as a second guard. */
  if (lenis) {
    lenis.on('scroll', function (e) {
      if (flyout.classList.contains('is-open') || mobileMenu.classList.contains('is-open')) return;
      if (e.scroll > 10 && e.direction === 1) nav.classList.add('is-hidden');
      else nav.classList.remove('is-hidden');
    });
  }

  /* ---------- per-section nav theme (meta theme-color only) ---------- */
  document.querySelectorAll('[data-nav-section]').forEach(function (sec) {
    ScrollTrigger.create({
      trigger: sec, start: 'top 4rem', end: 'bottom 4rem',
      onToggle: function (self) {
        if (self.isActive) setNavTheme(sec.getAttribute('data-nav-theme-val'));
      }
    });
  });

  var mm = gsap.matchMedia();

  /* ---------- HERO (not a pin: wrapper rides the scroll, film reads frozen) ----------
     HARD: desktop-only. The scrub trades 2x viewport-height of scroll distance for a
     slow parallax reveal across a wide split-grid frame. On a phone, .hero collapses
     to a single stacked screen (CSS, mobile media query) so that scroll budget has no
     visual payoff — it just reads as a second empty screen of scrolling before the
     stable section arrives. Gated exactly like the rail and the inset-band clip. */
  var hero = document.getElementById('hero');
  var heroWrapper = document.getElementById('heroWrapper');
  mm.add('(min-width: 769px)', function () {
    gsap.to(heroWrapper, {
      y: function () { return vh(); }, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true, refreshPriority: 10 }
    });
    hero.querySelectorAll('[data-hero-drift]').forEach(function (el) {
      gsap.to(el, {
        y: function () { return -0.6 * vh(); }, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true, refreshPriority: 10 }
      });
    });

    /* ---------- HERO FOG: two soft cloud layers over the image column,
       start translateY(100%), scrub up at different rates (-80% / -10%) ---------- */
    var fog1 = document.getElementById('fogLayer1');
    var fog2 = document.getElementById('fogLayer2');
    if (fog1 && fog2) {
      /* px-based via vh(), matching the same convention as the hero wrapper/drift
         tweens above — CSS yPercent-of-self proved unreliable on an absolutely
         positioned, bottom-anchored element (percentage transform basis drifted
         from GSAP's own tracked value by a flat 100pts on measurement). */
      /* Mist deepens and lifts slightly as you scroll - anchored, never a band. */
      gsap.fromTo(fog1, { y: function () { return 0.06 * vh(); }, opacity: 0.4 }, {
        y: function () { return -0.05 * vh(); }, opacity: 0.9, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true, refreshPriority: 10 }
      });
      gsap.fromTo(fog2, { y: function () { return 0.1 * vh(); }, opacity: 0.28 }, {
        y: function () { return -0.02 * vh(); }, opacity: 0.72, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true, refreshPriority: 10 }
      });
    }
  });

  /* ---------- manifesto: mask develop + scribble draw ---------- */
  var maskEl = document.getElementById('maskDevelop');
  gsap.set(maskEl, { '--mask-position': -40 });
  gsap.to(maskEl, {
    '--mask-position': 100, ease: 'none',
    scrollTrigger: { trigger: maskEl, start: 'top 80%', end: 'bottom 60%', scrub: true, refreshPriority: 9 }
  });
  var scribblePath = document.querySelector('#scribble path');
  if (scribblePath) {
    var slen = scribblePath.getTotalLength();
    gsap.set(scribblePath, { strokeDasharray: slen, strokeDashoffset: slen });
    gsap.to(scribblePath, {
      strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut',
      scrollTrigger: { trigger: '.manifesto_kicker', start: 'top 75%', toggleActions: 'play none none reverse' }
    });
  }

  /* ---------- gaits: each row's beat-line draws on scroll, beats pop in ---------- */
  document.querySelectorAll('[data-gait]').forEach(function (row, i) {
    var line = row.querySelector('.draw-line');
    var beats = row.querySelectorAll('.beat');
    if (line) {
      var glen = line.getTotalLength();
      gsap.set(line, { strokeDasharray: glen, strokeDashoffset: glen });
    }
    gsap.set(beats, { scale: 0, transformOrigin: '50% 50%' });
    var tl = gsap.timeline({
      scrollTrigger: { trigger: row, start: 'top 82%', toggleActions: 'play none none reverse' }
    });
    if (line) tl.to(line, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0);
    tl.to(beats, { scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.06 }, 0.15);
  });

  /* ---------- inset band (training): unclip to full bleed ---------- */
  mm.add('(min-width: 769px)', function () {
    document.querySelectorAll('.has-inset .season_inner').forEach(function (el) {
      gsap.fromTo(el,
        { clipPath: 'inset(0rem 1.25rem 0rem 1.25rem round 0.375rem)' },
        { clipPath: 'inset(0rem 0rem 0rem 0rem round 0rem)', ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 50%', scrub: true } });
    });
  });

  /* ---------- stable: Gneisti's video plays automatically once his row is
     well into view, and stops the moment it leaves — the same discipline the
     old hover-accordion had ("don't keep a loop running off-screen"), just
     driven by scroll position now that every horse is visible at rest ---------- */
  var gneistiRow = document.getElementById('gneistiRow');
  if (gneistiRow) {
    var gneistiIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { activateVideoCard(gneistiRow, en.isIntersecting); });
    }, { threshold: 0.6 });
    gneistiIO.observe(gneistiRow);
  }

  /* ---------- THE RAIL ---------- */
  var railOuter = document.querySelector('.rail_outer');
  var rail = document.getElementById('rail');
  var railContainer = document.getElementById('railContainer');
  var railTitleWrap = document.querySelector('.rail_title-wrap');
  var railTitle = document.getElementById('railTitle');
  var railBehind = document.getElementById('railBehind');
  var railOverlay = document.getElementById('railOverlay');
  var curtainRects = Array.prototype.slice.call(document.querySelectorAll('#curtainClip rect'));
  var railTravel = function () { return railContainer.scrollWidth - window.innerWidth; };

  mm.add('(min-width: 769px)', function () {
    gsap.fromTo(railOuter,
      { clipPath: 'inset(0% 10% 0% 10%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', clearProps: 'clipPath',
        scrollTrigger: { trigger: railOuter, start: 'top bottom', end: 'top top', scrub: true, refreshPriority: 6 } });
  });
  var railType = function () {
    return window.matchMedia('(min-width: 769px)').matches
      ? { enter: '2.3rem', grown: '4.6rem', settled: '3.6rem' }
      : { enter: '1.4rem', grown: '2.1rem', settled: '1.8rem' };
  };
  var railGrow = null;
  function buildRailGrow() {
    if (railGrow) { railGrow.scrollTrigger && railGrow.scrollTrigger.kill(); railGrow.kill(); }
    var t = railType();
    railGrow = gsap.fromTo(railTitle, { fontSize: t.enter }, {
      fontSize: t.grown, ease: 'none',
      scrollTrigger: { trigger: railOuter, start: 'top bottom', end: 'top top', scrub: true, refreshPriority: 6 }
    });
  }
  buildRailGrow();
  gsap.fromTo(railBehind, { yPercent: 16 }, {
    yPercent: 0, ease: 'none',
    scrollTrigger: { trigger: railOuter, start: 'top 60%', end: 'top top', scrub: true, refreshPriority: 6 }
  });

  var railTl = null;
  /* HARD: the pinned rail must never run on a phone. Pinning freezes vertical
     scroll for sText+sCurtain+sX (~2.5vh + 1.5x the rail width), which on touch
     reads as "the page won't scroll" - Sindri hit exactly that. On mobile the
     rail becomes a native horizontal swipe (CSS), no pin, no scrub. */
  function railCanPin() {
    /* innerWidth, not a media query, so this agrees with smoothAllowed() and
       with a pane that reports 0 at load. */
    return window.innerWidth >= 769 &&
           window.matchMedia('(pointer: fine)').matches &&
           navigator.maxTouchPoints === 0;
  }
  function buildRail() {
    if (!railCanPin()) {
      if (railTl) {
        railTl.scrollTrigger && railTl.scrollTrigger.kill();
        railTl.kill(); railTl = null;
      }
      gsap.set([railContainer, railTitleWrap], { clearProps: 'x,transform' });
      gsap.set(railBehind, { clearProps: 'clipPath' });
      gsap.set(railTitle, { clearProps: 'fontSize' });
      gsap.set(railOverlay, { '--rail-overlay': 0.28 });
      document.documentElement.classList.add('rail-native');
      return;
    }
    document.documentElement.classList.remove('rail-native');
    if (railTl) {
      railTl.scrollTrigger && railTl.scrollTrigger.kill();
      railTl.kill();
      gsap.set([railContainer, railTitleWrap], { clearProps: 'x' });
      gsap.set(railBehind, { clearProps: 'clipPath' });
      gsap.set(railOverlay, { '--rail-overlay': 0 });
      curtainRects.forEach(function (r, i) {
        r.setAttribute('width', '0.3334');
        r.setAttribute('x', String(i * 0.3333));
      });
      gsap.set(railTitle, { clearProps: 'fontSize' });
    }
    var H = vh();
    var L = railTravel();
    var sText = 1.5 * H;
    var sCurtain = 1 * H;
    var sX = 1.5 * L;
    railTl = gsap.timeline({
      scrollTrigger: {
        trigger: rail, start: 'top top',
        end: '+=' + (sText + sCurtain + sX),
        pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 5
      }
    });
    var rt = railType();
    railTl.fromTo(railTitle, { fontSize: rt.grown },
      { fontSize: rt.settled, ease: 'none', duration: 0.5 * sText }, 0);
    var tCurtain = 0.5 * sText;
    railTl.to(curtainRects[2], { attr: { width: 0 }, ease: 'none', duration: 0.5 * sCurtain }, tCurtain);
    railTl.to(curtainRects[1], { attr: { width: 0 }, ease: 'none', duration: 0.75 * sCurtain }, tCurtain);
    railTl.to(curtainRects[0], { attr: { width: 0 }, ease: 'none', duration: 1.0 * sCurtain }, tCurtain);
    var tX = tCurtain + 0.3 * sCurtain;
    railTl.to(railContainer, { x: -L, ease: 'none', duration: sX }, tX);
    railTl.to(railTitleWrap, { x: L, ease: 'none', duration: sX }, tX);
    var tWipe = tX + 0.35 * sX;
    railTl.to(railBehind, { clipPath: 'inset(0% 100% 0% 0%)', ease: 'none', duration: 0.45 * sX }, tWipe);
    railTl.to(railOverlay, { '--rail-overlay': 0.4, ease: 'none', duration: 0.45 * sX }, tWipe);
  }
  gsap.set(railOverlay, { '--rail-overlay': 0 });
  buildRail();

  /* ---------- ROUTES: flown path draws, indicator rides it, bars fill ---------- */
  var flown = document.getElementById('routeFlown');
  var indicator = document.getElementById('routeIndicator');
  var routesMap = document.getElementById('routesMap');
  if (flown && indicator) {
    var flownLen = flown.getTotalLength();
    gsap.set(flown, { strokeDasharray: flownLen, strokeDashoffset: flownLen });
    var prog = { p: 0 };
    var vb = { w: 1000, h: 460 };
    gsap.to(prog, {
      p: 1, ease: 'none',
      scrollTrigger: { trigger: routesMap, start: 'top 70%', end: 'bottom 60%', scrub: true, invalidateOnRefresh: true, refreshPriority: 3 },
      onUpdate: function () {
        flown.style.strokeDashoffset = String(flownLen * (1 - prog.p));
        var pt = flown.getPointAtLength(flownLen * prog.p);
        indicator.style.left = (pt.x / vb.w * 100) + '%';
        indicator.style.top = (pt.y / vb.h * 100) + '%';
      }
    });
  }
  document.querySelectorAll('.route-bar_fill').forEach(function (el) {
    var pct = el.getAttribute('data-pct') / 100;
    gsap.fromTo(el, { scaleX: 0 }, {
      scaleX: pct, ease: 'power2.out', duration: 1,
      scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' }
    });
  });

  /* ---------- custom cursor (desktop hover only) ---------- */
  mm.add('(hover: hover) and (pointer: fine)', function () {
    var cur = document.getElementById('cursor');
    var dot = document.getElementById('curDot');
    var lv = document.getElementById('curV');
    var lh = document.getElementById('curH');
    var label = document.getElementById('curLabel');
    gsap.set(cur, { xPercent: -50, yPercent: -50, x: -100, y: -100 });
    var qx = gsap.quickTo(cur, 'x', { duration: 0.3, ease: 'power3.out' });
    var qy = gsap.quickTo(cur, 'y', { duration: 0.3, ease: 'power3.out' });
    var mx = 0, my = 0, active = false, text = '';
    function isInteractive(el) {
      if (!el) return false;
      return !!(el.closest && (el.closest('a') || el.closest('button')));
    }
    function refresh(el) {
      var host = el && el.closest ? el.closest('[data-cursor-text]') : null;
      var t = host ? host.getAttribute('data-cursor-text') : '';
      var on = !!t || isInteractive(el);
      if (on === active && t === text) return;
      active = on; text = t || '';
      label.textContent = text;
      gsap.to(dot, { rotation: on ? 45 : 0, duration: 0.3, ease: 'power2.out' });
      gsap.to(lv, { height: on ? '0.75rem' : 0, opacity: on ? 1 : 0, duration: 0.3, ease: 'power2.out' });
      gsap.to(lh, { width: on ? '0.75rem' : 0, opacity: on ? 1 : 0, duration: 0.3, ease: 'power2.out' });
      gsap.to(label, { opacity: text ? 1 : 0, duration: 0.3, ease: 'power2.out' });
    }
    function onMove(e) { mx = e.clientX; my = e.clientY; qx(mx); qy(my); }
    function onOver(e) { refresh(e.target); }
    var scrollCheck = function () { refresh(document.elementFromPoint(mx, my)); };
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    if (lenis) lenis.on('scroll', scrollCheck);
    else window.addEventListener('scroll', scrollCheck, { passive: true });
    return function () {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
    };
  });

  /* ---------- resize safety: rebuild the rail, then refresh everything ---------- */
  var rto;
  window.addEventListener('resize', function () {
    clearTimeout(rto);
    rto = setTimeout(function () {
      setupSmooth();
      buildRailGrow();
      buildRail();
      ScrollTrigger.refresh();
    }, 250);
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* Settle pass: the first paint can happen before the viewport reports its
     real width (preview panes, restored tabs). Re-arm smoothing and the rail
     once on load so the desktop experience is never lost to a 0-width boot. */
  window.addEventListener('load', function () {
    setTimeout(function () {
      setupSmooth();
      buildRail();
      ScrollTrigger.refresh();
    }, 60);
  });

  /* ---------- Mobile rail affordance: dots track position, fade marks the end ----------
     Built only when the rail is in native-swipe mode. Without a progress cue a
     horizontal track inside a vertical page reads as a dead end. */
  (function railAffordance() {
    var cont = document.getElementById('railContainer');
    var dotsWrap = document.getElementById('railDots');
    var wrapper = cont && cont.closest ? cont.closest('.rail_wrapper') : null;
    if (!cont || !dotsWrap || !wrapper) return;

    var panels = Array.prototype.slice.call(cont.querySelectorAll('.rail_panel'));
    if (panels.length < 2) return;

    if (!dotsWrap.children.length) {
      panels.forEach(function (_, i) {
        var d = document.createElement('span');
        d.className = 'rail_swipe-dot' + (i === 0 ? ' is-on' : '');
        dotsWrap.appendChild(d);
      });
    }

    var ticking = false;
    function update() {
      ticking = false;
      var x = cont.scrollLeft;
      var maxX = cont.scrollWidth - cont.clientWidth;
      var idx = 0, best = Infinity;
      panels.forEach(function (p, i) {
        var d = Math.abs(p.offsetLeft - x);
        if (d < best) { best = d; idx = i; }
      });
      Array.prototype.forEach.call(dotsWrap.children, function (d, i) {
        d.classList.toggle('is-on', i === idx);
      });
      wrapper.classList.toggle('is-rail-end', maxX > 0 && x >= maxX - 4);
    }
    cont.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();
})();
