// =============================================
// QUARVO — main.js
// =============================================

// NAV: add .scrolled class on scroll
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// WAITLIST FORM — Loops API via /api/subscribe
function handleSubmit(e) {
  e.preventDefault();

  const email   = document.getElementById('emailInput').value.trim();
  const btn     = document.querySelector('.btn-submit');
  const btnText = document.getElementById('btnText');
  const success = document.getElementById('formSuccess');

  if (!email || !email.includes('@')) return;

  btnText.textContent = 'Joining...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  // Use absolute URL with www to avoid redirect (quarvo.io → www.quarvo.io
  // turns POST into GET, breaking the serverless function)
  const apiUrl = window.location.hostname === 'localhost'
    ? '/api/subscribe'
    : 'https://www.quarvo.io/api/subscribe';

  fetch(apiUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok || data.message) {
      window.location.href = '/thank-you.html';
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(err => {
    console.error('Subscribe error:', err);
    if (btn) btn.style.display = 'none';
    if (success) success.style.display = 'block';
    setTimeout(() => { window.location.href = '/thank-you.html'; }, 1500);
  });
}

// =============================================
// ROI CALCULATOR (Phase 2.3)
//   lost      = AOV × monthly_orders × 0.065  (industry decline rate)
//   recovered = lost × 0.60                    (QUARVO recovery rate)
//   fee       = recovered × 0.02               (2% per recovered sale)
//   net       = recovered - fee
//
// - Number input ↔ slider stay in sync
// - Slider track fill % shown via --p custom property
// - Outputs animate via window.QM.tick() (rAF, ease-out cubic)
// - First reveal animates from $0 when section enters viewport
// =============================================
(function () {
  var root = document.querySelector('[data-roi]');
  if (!root) return;

  var aov     = root.querySelector('#roi-aov');
  var orders  = root.querySelector('#roi-orders');
  var aovSld  = root.querySelector('#roi-aov-slider');
  var ordSld  = root.querySelector('#roi-orders-slider');

  var lostEl  = root.querySelector('[data-roi-out="lost"]');
  var recvEl  = root.querySelector('[data-roi-out="recovered"]');
  var feeEl   = root.querySelector('[data-roi-out="fee"]');
  var netEl   = root.querySelector('[data-roi-out="net"]');
  var netMo   = root.querySelector('[data-roi-out="net-monthly"]');
  var netYr   = root.querySelector('[data-roi-out="net-yearly"]');

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function fmtCurrency(v) {
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  // Update the slider track gradient (% fill via --p custom property)
  function syncSliderTrack(sl, min, max) {
    var v = parseFloat(sl.value);
    var p = ((v - min) / (max - min)) * 100;
    sl.style.setProperty('--p', p.toFixed(2) + '%');
  }

  // Compute + update outputs
  function update(animate) {
    var a = clamp(parseFloat(aov.value)    || 0, 0, 1000000);
    var o = clamp(parseFloat(orders.value) || 0, 0, 1000000);

    var lost      = a * o * 0.065;
    var recovered = lost * 0.60;
    var fee       = recovered * 0.02;
    var net       = recovered - fee;

    var QM = window.QM;
    if (animate && QM && QM.tick) {
      QM.tick(lostEl,  lost,      { duration: 600, prefix: '$', decimals: 0 });
      QM.tick(recvEl,  recovered, { duration: 600, prefix: '$', decimals: 0 });
      QM.tick(feeEl,   fee,       { duration: 600, prefix: '$', decimals: 0 });
      QM.tick(netEl,   net,       { duration: 750, prefix: '$', decimals: 0 });
    } else {
      lostEl.textContent = fmtCurrency(lost);
      recvEl.textContent = fmtCurrency(recovered);
      feeEl.textContent  = fmtCurrency(fee);
      netEl.textContent  = fmtCurrency(net);
      // Keep dataset in sync so future ticks start from correct value
      lostEl.dataset.tickFrom = String(lost);
      recvEl.dataset.tickFrom = String(recovered);
      feeEl.dataset.tickFrom  = String(fee);
      netEl.dataset.tickFrom  = String(net);
    }

    // Net meta (under the big number) updates instantly — too small to tick
    netMo.textContent = fmtCurrency(net) + ' / month';
    netYr.textContent = fmtCurrency(net * 12) + ' / year';
  }

  // Bidirectional sync: number input ↔ slider
  function bindPair(num, sld, sliderMin, sliderMax) {
    function fromNum() {
      var v = clamp(parseFloat(num.value) || 0, sliderMin, sliderMax);
      sld.value = String(v);
      syncSliderTrack(sld, sliderMin, sliderMax);
      update(true);
    }
    function fromSlider() {
      num.value = sld.value;
      syncSliderTrack(sld, sliderMin, sliderMax);
      update(true);
    }
    num.addEventListener('input', fromNum);
    sld.addEventListener('input', fromSlider);
    syncSliderTrack(sld, sliderMin, sliderMax);  // initial paint
  }

  bindPair(aov,    aovSld, 50, 10000);
  bindPair(orders, ordSld, 10,  5000);

  // Initial static render so layout doesn't jump (numbers show real values)
  update(false);

  // First-view animation: re-tick from 0 when section enters viewport
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          // Reset tick-from so we animate from 0
          [lostEl, recvEl, feeEl, netEl].forEach(function (el) {
            el.dataset.tickFrom = '0';
            el.textContent = '$0';
          });
          update(true);
          io.disconnect();
        }
      });
    }, { threshold: 0.35 });
    io.observe(root);
  }
})();

// =============================================
// HOW IT WORKS — sticky-scroll narrative (Phase 2.4)
//   The 3 visuals on the LEFT change to match whichever
//   .how-step on the RIGHT is closest to viewport center.
//   Uses a single IntersectionObserver tuned with rootMargin
//   so each step "activates" when it crosses ~40% from top.
// =============================================
(function () {
  var root = document.querySelector('[data-how]');
  if (!root) return;

  var steps   = Array.prototype.slice.call(root.querySelectorAll('.how-step'));
  var visuals = Array.prototype.slice.call(root.querySelectorAll('.how-visual'));
  var dots    = Array.prototype.slice.call(root.querySelectorAll('.how-progress-dot'));
  if (!steps.length || !visuals.length) return;

  var current = 0;

  function setActive(idx) {
    if (idx === current) return;
    current = idx;
    visuals.forEach(function (v, i) { v.classList.toggle('is-active', i === idx); });
    dots.forEach(function (d, i)    { d.classList.toggle('is-active', i === idx); });
    steps.forEach(function (s, i)   { s.classList.toggle('is-active', i === idx); });
  }

  // Mobile: visuals stack vertically, no sticky scroll. Skip observer logic.
  function isStacked() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  if (isStacked()) {
    visuals.forEach(function (v) { v.classList.add('is-active'); });
    steps.forEach(function (s)   { s.classList.add('is-active'); });
    return;
  }

  // Desktop: rootMargin shrinks the viewport so a step is "active" only
  // when its center crosses near 40% from top. Threshold 0 fires on every
  // crossing.
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var i = parseInt(entry.target.dataset.step, 10);
        if (!isNaN(i)) setActive(i);
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

  steps.forEach(function (s) { io.observe(s); });

  // First step gets active immediately on load (initial sweep)
  setActive(0);
})();

// COPY MERCHANT LINK
function copyMerchantLink() {
  const url = 'https://quarvo.io/for-merchants';
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copyBtn');
    if (btn) {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
      btn.style.background = 'rgba(34,197,94,0.15)';
      btn.style.borderColor = 'rgba(34,197,94,0.3)';
      btn.style.color = '#4ADE80';
      setTimeout(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy link';
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 2500);
    }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}
