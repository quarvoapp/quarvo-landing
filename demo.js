// =============================================
// QUARVO — demo.js (Phase 5)
//   Interactive split-payment simulation
//
// State machine: ready → declining → quarvo → processing → success
// Modes: AUTO_PLAY (full sequence) and INTERACTIVE (user controls split)
// Triggered: first-view via IntersectionObserver, manual replay via button
// =============================================
(function () {
  var root = document.querySelector('[data-demo]');
  if (!root) return;

  // ─── DOM refs ────────────────────────────────────────────────────────
  var stage      = root.querySelector('[data-demo-stage]');
  var screens    = Array.prototype.slice.call(root.querySelectorAll('.demo-screen'));
  var payBtn     = root.querySelector('[data-demo-pay]');
  var confirmBtn = root.querySelector('[data-demo-confirm]');
  var warnEl     = root.querySelector('[data-demo-warn]');
  var sliders    = Array.prototype.slice.call(root.querySelectorAll('.demo-slider'));
  var allocEl    = root.querySelector('[data-demo-allocated]');
  var feeEl      = root.querySelector('[data-demo-fee]');
  var clockNum   = root.querySelector('[data-demo-clock-num]');
  var replayBtn  = root.querySelector('[data-demo-replay]');
  var tryBtn     = root.querySelector('[data-demo-try]');
  var stateName  = root.querySelector('[data-demo-state-name]');
  var stepEl     = root.querySelector('[data-demo-step]');
  var commentary = root.querySelector('[data-demo-commentary]');
  var commentaryT= root.querySelector('[data-demo-commentary-title]');

  if (!stage || !screens.length) return;

  // ─── Constants ───────────────────────────────────────────────────────
  var TARGET = 2400;
  var STATES = ['ready', 'decline', 'quarvo', 'processing', 'success'];
  var MODE_AUTO = 'auto';
  var MODE_INTERACTIVE = 'interactive';

  var COMMENTARY = {
    ready: {
      title: 'Customer hits checkout',
      body: '<p>The customer reaches your checkout with a $2,400 cart. Their best card has $1,800 of available credit. The straight charge is going to fail.</p><p>This is the moment where 6.5% of high-AOV customers normally walk away.</p>'
    },
    decline: {
      title: 'Card declines (insufficient credit)',
      body: '<p>The card auth comes back with <code>insufficient_credit</code>. The customer\'s card has $1,800 available — they\'re short $600 on this single card.</p><p>Their <strong>combined credit across all cards</strong> is well above $2,400. The checkout just can\'t see across them.</p>'
    },
    quarvo: {
      title: 'Quarvo recovers the transaction',
      body: '<p>Quarvo\'s recovery surface appears in-place. The customer\'s saved cards are pre-loaded with available-credit data. They drag the sliders to allocate the split.</p><p>Try it: drag the sliders. The allocated total updates live. <strong>You only confirm when allocation matches $2,400.</strong></p>'
    },
    processing: {
      title: 'Two-phase atomic commit',
      body: '<p>Phase 1: both card authorizations fire <strong>in parallel</strong> with <code>capture_method: manual</code>. Stripe holds the funds without charging.</p><p>Phase 2: once both succeed, both capture in parallel. If either fails in Phase 1, both are voided atomically — the customer never sees a partial charge.</p>'
    },
    success: {
      title: 'Order placed in 0.86 seconds',
      body: '<p>Both cards charged. Merchant settles the full $2,400 via Stripe Connect, less the 2% Quarvo fee on the recovered transaction.</p><p>The customer pays nothing extra, takes on no new debt, and earns rewards on each card normally — preserved by going through their existing cards instead of a third-party loan.</p>'
    }
  };

  var current = 'ready';
  var mode = MODE_AUTO;
  var autoTimers = [];
  var hasPlayed = false;

  // ─── Utilities ───────────────────────────────────────────────────────
  function clearTimers() {
    autoTimers.forEach(clearTimeout);
    autoTimers = [];
  }

  function fmtCurrency(v) {
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  function syncSliderTrack(sl) {
    var v = parseFloat(sl.value);
    var min = parseFloat(sl.min);
    var max = parseFloat(sl.max);
    var p = ((v - min) / (max - min)) * 100;
    sl.style.setProperty('--p', p.toFixed(2) + '%');
  }

  function updateAllocation(animate) {
    var total = 0;
    sliders.forEach(function (sl) {
      var v = parseFloat(sl.value) || 0;
      total += v;
      var key = sl.dataset.cardKey;
      var amtEl = root.querySelector('[data-card-amount="' + key + '"]');
      if (amtEl) amtEl.textContent = fmtCurrency(v);
      syncSliderTrack(sl);
    });

    if (allocEl) {
      allocEl.textContent = fmtCurrency(total);
      allocEl.classList.toggle('is-match', total === TARGET);
      allocEl.classList.toggle('is-mismatch', total !== TARGET);
    }

    var matches = total === TARGET;
    if (confirmBtn) confirmBtn.disabled = !matches;
    if (warnEl) warnEl.classList.toggle('is-visible', !matches);
    if (feeEl) feeEl.textContent = '$0';
  }

  function setActiveScreen(stateKey) {
    screens.forEach(function (s) {
      s.classList.toggle('is-active', s.dataset.screen === stateKey);
    });
    current = stateKey;

    // Side commentary update with subtle fade
    if (commentary && commentaryT && COMMENTARY[stateKey]) {
      commentary.style.opacity = '0';
      commentaryT.style.opacity = '0';
      setTimeout(function () {
        commentaryT.textContent = COMMENTARY[stateKey].title;
        commentary.innerHTML = COMMENTARY[stateKey].body;
        commentary.style.opacity = '1';
        commentaryT.style.opacity = '1';
      }, 180);
    }

    if (stateName) stateName.textContent = stateKey;
    if (stepEl) {
      var idx = STATES.indexOf(stateKey);
      stepEl.textContent = (idx + 1) + ' / ' + STATES.length;
    }
  }

  // ─── Processing animation: progressive auth steps + clock ─────────────
  function animateProcessing(onComplete) {
    var step1 = root.querySelector('[data-auth="1"]');
    var step2 = root.querySelector('[data-auth="2"]');
    var step3 = root.querySelector('[data-auth="3"]');

    [step1, step2, step3].forEach(function (s) {
      if (s) { s.classList.remove('is-running', 'is-done'); }
    });

    // Animate clock from 0 → 0.86
    var startTime = null;
    var DURATION = 1700; // ms — visual; real flow is faster but we want to show the steps
    function tickClock(ts) {
      if (!startTime) startTime = ts;
      var elapsed = (ts - startTime) / DURATION;
      if (elapsed >= 1) {
        if (clockNum) clockNum.textContent = '0.86';
        return;
      }
      // ease-out
      var eased = 1 - Math.pow(1 - elapsed, 3);
      var val = (0.86 * eased).toFixed(2);
      if (clockNum) clockNum.textContent = val;
      requestAnimationFrame(tickClock);
    }
    requestAnimationFrame(tickClock);

    // Step 1 starts immediately, finishes at ~620ms (mapped to ~1230ms in demo time)
    if (step1) step1.classList.add('is-running');
    if (step2) step2.classList.add('is-running');

    autoTimers.push(setTimeout(function () {
      if (step1) { step1.classList.remove('is-running'); step1.classList.add('is-done'); }
    }, 1100));
    autoTimers.push(setTimeout(function () {
      if (step2) { step2.classList.remove('is-running'); step2.classList.add('is-done'); }
    }, 1180));
    autoTimers.push(setTimeout(function () {
      if (step3) step3.classList.add('is-running');
    }, 1200));
    autoTimers.push(setTimeout(function () {
      if (step3) { step3.classList.remove('is-running'); step3.classList.add('is-done'); }
      if (onComplete) onComplete();
    }, 1700));
  }

  // ─── Auto-play sequence ──────────────────────────────────────────────
  function autoPlay() {
    clearTimers();
    mode = MODE_AUTO;
    setActiveScreen('ready');
    if (clockNum) clockNum.textContent = '0.00';

    autoTimers.push(setTimeout(function () {
      if (payBtn) payBtn.classList.add('is-pressed');
      setActiveScreen('decline');
    }, 1400));

    autoTimers.push(setTimeout(function () {
      setActiveScreen('quarvo');
    }, 3200));

    autoTimers.push(setTimeout(function () {
      // Briefly highlight sliders (optional gentle motion)
      setActiveScreen('processing');
      animateProcessing(function () {
        autoTimers.push(setTimeout(function () {
          setActiveScreen('success');
        }, 350));
      });
    }, 6000));
  }

  // ─── Interactive mode ────────────────────────────────────────────────
  function startInteractive() {
    clearTimers();
    mode = MODE_INTERACTIVE;
    setActiveScreen('quarvo');
    // Reset sliders to user-friendly defaults
    sliders.forEach(function (sl, i) {
      sl.value = i === 0 ? 1800 : 600;
    });
    updateAllocation(false);
  }

  // ─── Replay (resets to auto-play) ────────────────────────────────────
  function replay() {
    autoPlay();
  }

  // ─── Wire up controls ────────────────────────────────────────────────
  sliders.forEach(function (sl) {
    sl.addEventListener('input', function () { updateAllocation(true); });
    syncSliderTrack(sl);
  });

  if (payBtn) {
    payBtn.addEventListener('click', function () {
      clearTimers();
      mode = MODE_AUTO;
      setActiveScreen('decline');
      autoTimers.push(setTimeout(function () { setActiveScreen('quarvo'); }, 1700));
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      clearTimers();
      setActiveScreen('processing');
      if (clockNum) clockNum.textContent = '0.00';
      animateProcessing(function () {
        autoTimers.push(setTimeout(function () { setActiveScreen('success'); }, 350));
      });
    });
  }

  if (replayBtn) replayBtn.addEventListener('click', replay);
  if (tryBtn)    tryBtn.addEventListener('click', startInteractive);

  // ─── First-view trigger ─────────────────────────────────────────────
  // Initial state is ready; auto-play kicks in when the section enters viewport.
  setActiveScreen('ready');
  updateAllocation(false);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !hasPlayed) {
          hasPlayed = true;
          // Small delay so the user sees the "ready" state first
          autoTimers.push(setTimeout(autoPlay, 600));
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(root);
  } else {
    // Fallback: just auto-play after a moment
    autoTimers.push(setTimeout(autoPlay, 1200));
  }

  // Reduced motion: skip auto sequence, show ready + interactive controls only
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hasPlayed = true; // prevent IO autoplay
    setActiveScreen('ready');
  }
})();
