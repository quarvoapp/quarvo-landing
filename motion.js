// =============================================
// QUARVO — motion.js
// Phase 2.1: motion infrastructure
//
// Vanilla, no deps. All effects gated by:
//   - prefers-reduced-motion → noop
//   - hover: hover + pointer: fine for cursor-driven effects
// All long-running loops paused via IntersectionObserver.
//
// Public API (auto-initialized on DOMContentLoaded):
//   data attribute    | what it does
//   ------------------+-----------------------------------------
//   .reveal           | fade-up on enter viewport
//   .reveal-group     | parent: stagger child --i indexes
//   .split-words      | wrap each word, reveal sequentially
//   .scan-line        | enable CRT sweep when on-screen
//   .shimmer-text     | start shimmer when on-screen
//   .float-y          | start float when on-screen
//   .magnetic         | pull element toward cursor
//   .tilt + .tilt-inner | 3D tilt on hover
//   .spotlight        | radial light follows cursor
//   [data-grid-bg]    | inverse-parallax of nested .grid-bg
//   [data-tick]       | animated number on enter (rAF)
//
// Number-tick programmatic API (used by ROI calc later):
//   window.QM.tick(el, target, { duration?, prefix?, suffix?, decimals? })
// =============================================

(function () {
  'use strict';

  // ---------------------------------------------
  // Reduced-motion helper
  // ---------------------------------------------
  var prefersReduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var hasFineHover = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function noop() {}

  // ---------------------------------------------
  // 1) REVEAL ON SCROLL
  // Toggles .is-visible on enter; idempotent (can re-enter for repeats if desired).
  // For groups: indexes children with --i so CSS can stagger.
  // ---------------------------------------------
  function initReveal() {
    if (prefersReduced) {
      // Make everything visible immediately
      document.querySelectorAll('.reveal, .reveal-group, .split-words, .scan-line, .shimmer-text, .float-y')
        .forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    // Index children of stagger groups
    document.querySelectorAll('.reveal-group').forEach(function (group) {
      var kids = group.children;
      for (var i = 0; i < kids.length; i++) {
        kids[i].style.setProperty('--i', String(i));
      }
    });

    var SELECTOR = '.reveal, .reveal-group, .split-words, .scan-line, .shimmer-text, .float-y';
    var nodes = document.querySelectorAll(SELECTOR);

    // Initial sweep: anything already in viewport at load → reveal immediately.
    // This is BOTH a UX win (no half-second pause for above-fold content)
    // AND a defensive fallback for environments where IO is sluggish/broken.
    function inViewport(el) {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var vw = window.innerWidth  || document.documentElement.clientWidth;
      // Element counts as visible if any portion overlaps viewport
      return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
    }

    var pending = [];
    nodes.forEach(function (el) {
      if (inViewport(el)) {
        el.classList.add('is-visible');
      } else {
        pending.push(el);
      }
    });

    // Observe everything that was below the fold for scroll reveals
    if (pending.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

      pending.forEach(function (el) { io.observe(el); });
    }
  }

  // ---------------------------------------------
  // 2) WORD STAGGER
  // Wraps each visible word in <span class="word"> and sets --i.
  // Preserves nested elements (it walks text nodes only).
  // ---------------------------------------------
  function initWordStagger() {
    document.querySelectorAll('.split-words').forEach(function (root) {
      // Already processed?
      if (root.dataset.split === 'done') return;
      root.dataset.split = 'done';

      var idx = 0;
      // Skip text nodes inside .shimmer-text or [data-no-split] — they need to
      // remain whole so background-clip: text / gradient effects don't break
      // due to inline-block reformatting context introduced by .word wrappers.
      var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var p = node.parentElement;
          while (p && p !== root) {
            if (p.classList && p.classList.contains('shimmer-text')) return NodeFilter.FILTER_REJECT;
            if (p.dataset && p.dataset.noSplit !== undefined)        return NodeFilter.FILTER_REJECT;
            p = p.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var textNodes = [];
      var n;
      while ((n = walk.nextNode())) {
        if (n.nodeValue && n.nodeValue.trim()) textNodes.push(n);
      }
      textNodes.forEach(function (tn) {
        var frag = document.createDocumentFragment();
        var parts = tn.nodeValue.split(/(\s+)/);
        parts.forEach(function (part) {
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else if (part.length) {
            var span = document.createElement('span');
            span.className = 'word';
            span.style.setProperty('--i', String(idx++));
            span.textContent = part;
            frag.appendChild(span);
          }
        });
        tn.parentNode.replaceChild(frag, tn);
      });
    });
  }

  // ---------------------------------------------
  // 3) MAGNETIC HOVER
  // Pulls element toward cursor within a max distance.
  // ---------------------------------------------
  function initMagnetic() {
    if (prefersReduced || !hasFineHover) return;

    document.querySelectorAll('.magnetic').forEach(function (el) {
      var strength = parseFloat(el.dataset.magnetic) || 0.35;  // 0–1
      var maxOffset = parseFloat(el.dataset.magneticMax) || 14; // px

      var rect = null;
      var raf = 0;

      function update(e) {
        if (!rect) return;
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) * strength;
        var dy = (e.clientY - cy) * strength;
        // Clamp to maxOffset
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxOffset) {
          dx = (dx / d) * maxOffset;
          dy = (dy / d) * maxOffset;
        }
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          el.style.setProperty('--mx', dx.toFixed(2) + 'px');
          el.style.setProperty('--my', dy.toFixed(2) + 'px');
        });
      }
      function reset() {
        cancelAnimationFrame(raf);
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      }

      el.addEventListener('mouseenter', function () {
        rect = el.getBoundingClientRect();
      });
      el.addEventListener('mousemove', update);
      el.addEventListener('mouseleave', reset);
      // Recompute rect on resize/scroll while hovering
      window.addEventListener('scroll', function () { rect = null; }, { passive: true });
      window.addEventListener('resize', function () { rect = null; }, { passive: true });
    });
  }

  // ---------------------------------------------
  // 4) 3D TILT
  // Requires <div class="tilt"><div class="tilt-inner">...</div></div>
  // ---------------------------------------------
  function initTilt() {
    if (prefersReduced || !hasFineHover) return;

    document.querySelectorAll('.tilt').forEach(function (wrap) {
      var inner = wrap.querySelector('.tilt-inner');
      if (!inner) return;
      var maxDeg = parseFloat(wrap.dataset.tiltMax) || 7;

      var rect = null;
      var raf = 0;

      wrap.addEventListener('mouseenter', function () {
        rect = wrap.getBoundingClientRect();
      });
      wrap.addEventListener('mousemove', function (e) {
        if (!rect) rect = wrap.getBoundingClientRect();
        var nx = (e.clientX - rect.left) / rect.width;   // 0..1
        var ny = (e.clientY - rect.top)  / rect.height;  // 0..1
        var ry = (nx - 0.5) *  2 * maxDeg;               // y-axis (left/right)
        var rx = (ny - 0.5) * -2 * maxDeg;               // x-axis (inverted)
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          inner.style.setProperty('--rx', rx.toFixed(2) + 'deg');
          inner.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        });
      });
      wrap.addEventListener('mouseleave', function () {
        cancelAnimationFrame(raf);
        inner.style.setProperty('--rx', '0deg');
        inner.style.setProperty('--ry', '0deg');
      });
    });
  }

  // ---------------------------------------------
  // 5) CURSOR SPOTLIGHT
  // Updates --spot-x / --spot-y on container while hovered.
  // ---------------------------------------------
  function initSpotlight() {
    if (prefersReduced || !hasFineHover) return;

    document.querySelectorAll('.spotlight').forEach(function (el) {
      var raf = 0;
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width)  * 100;
        var y = ((e.clientY - rect.top)  / rect.height) * 100;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          el.style.setProperty('--spot-x', x.toFixed(2) + '%');
          el.style.setProperty('--spot-y', y.toFixed(2) + '%');
        });
      });
    });
  }

  // ---------------------------------------------
  // 6) ANIMATED GRID PARALLAX
  // Container has data-grid-bg; child .grid-bg moves inverse to cursor.
  // ---------------------------------------------
  function initGridParallax() {
    if (prefersReduced || !hasFineHover) return;

    document.querySelectorAll('[data-grid-bg]').forEach(function (host) {
      var grid = host.querySelector('.grid-bg');
      if (!grid) return;
      var range = parseFloat(host.dataset.gridRange) || 24; // max px
      var raf = 0;

      host.addEventListener('mousemove', function (e) {
        var rect = host.getBoundingClientRect();
        var nx = (e.clientX - rect.left) / rect.width  - 0.5;  // -0.5..0.5
        var ny = (e.clientY - rect.top)  / rect.height - 0.5;
        var dx = nx * -range;
        var dy = ny * -range;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          grid.style.setProperty('--grid-x', dx.toFixed(2) + 'px');
          grid.style.setProperty('--grid-y', dy.toFixed(2) + 'px');
        });
      });
      host.addEventListener('mouseleave', function () {
        cancelAnimationFrame(raf);
        grid.style.setProperty('--grid-x', '0px');
        grid.style.setProperty('--grid-y', '0px');
      });
    });
  }

  // ---------------------------------------------
  // 7) NUMBER TICK (programmatic + auto)
  // Auto: any [data-tick] with target value animates on enter.
  // Programmatic: window.QM.tick(el, target, opts) — used by ROI calc.
  // ---------------------------------------------
  function tick(el, target, opts) {
    opts = opts || {};
    var duration = opts.duration || 900;
    var prefix   = opts.prefix   || '';
    var suffix   = opts.suffix   || '';
    var decimals = opts.decimals != null ? opts.decimals : 0;

    if (prefersReduced) {
      el.textContent = prefix + Number(target).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
      return;
    }

    var startVal = parseFloat(el.dataset.tickFrom);
    if (isNaN(startVal)) startVal = 0;
    var t0 = performance.now();
    cancelAnimationFrame(el._tickRaf || 0);

    function frame(t) {
      var p = Math.min((t - t0) / duration, 1);
      // ease-out cubic
      var eased = 1 - Math.pow(1 - p, 3);
      var val = startVal + (Number(target) - startVal) * eased;
      el.textContent = prefix +
        val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
        suffix;
      if (p < 1) {
        el._tickRaf = requestAnimationFrame(frame);
      } else {
        el.dataset.tickFrom = String(target);
      }
    }
    el._tickRaf = requestAnimationFrame(frame);
  }

  function initAutoTick() {
    var nodes = document.querySelectorAll('[data-tick]');
    if (!nodes.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = parseFloat(el.dataset.tick);
        if (isNaN(target)) return;
        tick(el, target, {
          duration: parseFloat(el.dataset.tickDuration) || 1100,
          prefix:   el.dataset.tickPrefix   || '',
          suffix:   el.dataset.tickSuffix   || '',
          decimals: parseFloat(el.dataset.tickDecimals) || 0
        });
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    nodes.forEach(function (el) {
      // Lock starting render so layout doesn't jump
      var initialPrefix   = el.dataset.tickPrefix   || '';
      var initialSuffix   = el.dataset.tickSuffix   || '';
      var initialDecimals = parseFloat(el.dataset.tickDecimals) || 0;
      el.textContent = initialPrefix + (0).toFixed(initialDecimals) + initialSuffix;
      io.observe(el);
    });
  }

  // ---------------------------------------------
  // Bootstrap
  // ---------------------------------------------
  function boot() {
    initWordStagger();   // must run before initReveal so word --i are set
    initReveal();
    initMagnetic();
    initTilt();
    initSpotlight();
    initGridParallax();
    initAutoTick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Public API
  window.QM = {
    tick: tick,
    prefersReduced: prefersReduced,
    hasFineHover: hasFineHover,
    rebootStagger: initWordStagger,
    rebootReveal: initReveal
  };
})();
