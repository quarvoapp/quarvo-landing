// =============================================
// QUARVO — conversion.js (Phase 7)
//   Conversion optimization layer:
//     - Exit-intent modal (mouseout via top edge)
//     - Floating scroll-depth CTA
//
// Activated per-page via data attributes on <body>:
//   <body data-exit-modal="true">       → enable exit-intent modal
//   <body data-floating-cta="true">     → enable floating scroll CTA
//
// Both honor prefers-reduced-motion + localStorage dismissal flags.
// =============================================
(function () {
  'use strict';

  var body = document.body;
  if (!body) return;

  var enableExit = body.dataset.exitModal === 'true';
  var enableFloat = body.dataset.floatingCta === 'true';
  if (!enableExit && !enableFloat) return;

  var REDUCED_MOTION = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Storage helpers ───────────────────────────────────────────────
  function getFlag(key) {
    try { return localStorage.getItem('quarvo:' + key); }
    catch (e) { return null; }
  }
  function setFlag(key, val) {
    try { localStorage.setItem('quarvo:' + key, val); }
    catch (e) { /* swallow — incognito etc */ }
  }

  // =============================================
  // EXIT-INTENT MODAL
  // =============================================
  function initExitModal() {
    if (getFlag('exit-dismissed') === '1') return;

    // Build modal lazily — only inject DOM if it'll fire
    var modal = document.createElement('div');
    modal.className = 'qv-modal-root';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = [
      '<div class="qv-modal-backdrop" data-modal-close></div>',
      '<div class="qv-modal" role="dialog" aria-labelledby="qv-modal-title" aria-modal="true">',
      '  <button class="qv-modal-x" data-modal-close aria-label="Close">',
      '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '  </button>',
      '  <div class="qv-modal-tag">// BEFORE YOU GO</div>',
      '  <h2 id="qv-modal-title" class="qv-modal-title">Want the high-AOV<br/><em>decline recovery checklist?</em></h2>',
      '  <p class="qv-modal-deck">A 1-page audit framework: pull your decline data, isolate the recoverable cohort, model the topline lift. Used by every merchant in the pilot list before they signed.</p>',
      '  <form class="qv-modal-form" data-modal-form>',
      '    <input type="email" class="qv-modal-input" name="email" placeholder="merchant@yourdomain.com" required aria-label="Email address"/>',
      '    <button type="submit" class="qv-modal-submit">',
      '      <span class="qv-btn-label">Send the checklist</span>',
      '      <span class="qv-btn-arrow">&rarr;</span>',
      '    </button>',
      '  </form>',
      '  <p class="qv-modal-foot">No spam. One email with the checklist + an invite to the pilot list. Unsubscribe in one click.</p>',
      '  <div class="qv-modal-success" data-modal-success>',
      '    <div class="qv-modal-check"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>',
      '    <h3>Sent.</h3>',
      '    <p>Check your inbox in the next 60 seconds. If it&rsquo;s not there, look in promotions or spam &mdash; and let us know at <a href="mailto:hello@quarvo.io">hello@quarvo.io</a>.</p>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    function open() {
      if (modal.classList.contains('is-open')) return;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      // focus the input for keyboard users
      var input = modal.querySelector('.qv-modal-input');
      setTimeout(function () { if (input) input.focus(); }, 80);
      // ESC to close
      document.addEventListener('keydown', escHandler);
    }

    function close() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      setFlag('exit-dismissed', '1');
      document.removeEventListener('keydown', escHandler);
    }

    function escHandler(e) {
      if (e.key === 'Escape') close();
    }

    // Wire close buttons
    Array.prototype.forEach.call(
      modal.querySelectorAll('[data-modal-close]'),
      function (el) { el.addEventListener('click', close); }
    );

    // Form submit — canonical lead-capture endpoint on app.quarvo.io
    // (Loops fan-out + Supabase write happen server-side)
    var form = modal.querySelector('[data-modal-form]');
    var success = modal.querySelector('[data-modal-success]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var emailInput = form.querySelector('input[type="email"]');
        if (!emailInput || !emailInput.value || !emailInput.value.includes('@')) return;

        var email = emailInput.value.trim();
        var apiUrl = 'https://app.quarvo.io/api/leads/checklist';

        // Optimistic UI — show success immediately, retry in background
        if (success) {
          form.style.display = 'none';
          success.classList.add('is-visible');
        }
        setFlag('exit-dismissed', '1');

        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            metadata: {
              source: 'exit-modal-merchant',
              page: window.location.pathname
            }
          })
        }).catch(function (err) {
          console.error('Exit modal subscribe error:', err);
        });
      });
    }

    // ─── Trigger conditions ───────────────────────────────────────
    var triggered = false;
    function safeOpen() {
      if (triggered) return;
      triggered = true;
      open();
    }

    // Desktop: mouseout via top edge (exit intent)
    document.addEventListener('mouseout', function (e) {
      // Only trigger if leaving via top edge, not just to another element
      if (e.relatedTarget === null && e.clientY < 8) {
        safeOpen();
      }
    });

    // Mobile fallback: scroll past 75% of page + idle for 5s
    var scrollHit = false;
    function checkScrollHit() {
      var pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct > 0.75) scrollHit = true;
    }
    window.addEventListener('scroll', checkScrollHit, { passive: true });

    // After 30s of session activity + scroll-hit, open
    setTimeout(function () {
      if (scrollHit) safeOpen();
    }, 30000);
  }

  // =============================================
  // FLOATING SCROLL-DEPTH CTA
  // =============================================
  function initFloatingCta() {
    if (getFlag('floating-dismissed') === '1') return;

    var cta = document.createElement('div');
    cta.className = 'qv-float-cta';
    cta.setAttribute('aria-hidden', 'true');
    cta.innerHTML = [
      '<button class="qv-float-x" data-float-close aria-label="Dismiss">',
      '  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '</button>',
      '<div class="qv-float-tag">// FOR MERCHANTS</div>',
      '<div class="qv-float-body">',
      '  <p class="qv-float-text">Recover the high-ticket sales your checkout is losing.</p>',
      '  <a href="/for-merchants" class="qv-float-link">',
      '    Get on the pilot list',
      '    <span aria-hidden="true">&rarr;</span>',
      '  </a>',
      '</div>'
    ].join('');
    document.body.appendChild(cta);

    var visible = false;
    function show() {
      if (visible) return;
      visible = true;
      cta.classList.add('is-visible');
      cta.setAttribute('aria-hidden', 'false');
    }
    function hide(persist) {
      visible = false;
      cta.classList.remove('is-visible');
      cta.setAttribute('aria-hidden', 'true');
      if (persist) setFlag('floating-dismissed', '1');
    }

    var closeBtn = cta.querySelector('[data-float-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () { hide(true); });

    // Show after 60% scroll depth
    function checkScroll() {
      var pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct > 0.6) {
        show();
      } else if (visible && pct < 0.55) {
        // If user scrolls back up past 55%, hide (but don't persist)
        hide(false);
      }
    }
    window.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();
  }

  // ─── Inject styles once (shared across both components) ──────────────
  function injectStyles() {
    if (document.getElementById('qv-conversion-styles')) return;
    var style = document.createElement('style');
    style.id = 'qv-conversion-styles';
    style.textContent = [
      /* ── EXIT MODAL ─────────────────────────────────────────── */
      '.qv-modal-root { position: fixed; inset: 0; z-index: 9999; display: none; align-items: center; justify-content: center; padding: 24px; }',
      '.qv-modal-root.is-open { display: flex; }',
      '.qv-modal-backdrop { position: absolute; inset: 0; background: rgba(6,6,10,0.78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); animation: qvFadeIn 220ms cubic-bezier(0.22, 1, 0.36, 1); }',
      '@keyframes qvFadeIn { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes qvLift { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }',
      '.qv-modal { position: relative; max-width: 480px; width: 100%; background: linear-gradient(180deg, #14142A 0%, #0E0E1C 100%); border: 1px solid rgba(123,47,255,0.35); border-radius: 22px; padding: 36px 36px 28px; box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset; animation: qvLift 320ms cubic-bezier(0.22, 1, 0.36, 1); }',
      '.qv-modal-x { position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); border-radius: 50%; color: #9090B0; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s, color 0.15s, background 0.15s; }',
      '.qv-modal-x:hover { border-color: rgba(247,84,84,0.4); color: #F75454; background: rgba(247,84,84,0.06); }',
      '.qv-modal-tag { font-family: "JetBrains Mono", "DM Mono", monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #00F5FF; background: rgba(0,245,255,0.06); border: 1px solid rgba(0,245,255,0.25); padding: 4px 10px; border-radius: 16px; display: inline-block; margin-bottom: 18px; }',
      '.qv-modal-title { font-family: "Syne", sans-serif; font-weight: 800; font-size: 26px; line-height: 1.15; letter-spacing: -0.02em; color: #F0F0F8; margin: 0 0 14px; }',
      '.qv-modal-title em { font-style: normal; background: linear-gradient(135deg, #00F5FF 0%, #7B2FFF 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }',
      '.qv-modal-deck { font-family: "DM Sans", sans-serif; font-size: 14.5px; color: #9090B0; line-height: 1.65; margin: 0 0 22px; }',
      '.qv-modal-form { display: flex; flex-direction: column; gap: 10px; }',
      '.qv-modal-input { padding: 13px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-family: "DM Sans", sans-serif; font-size: 14px; color: #F0F0F8; transition: border-color 0.2s; }',
      '.qv-modal-input::placeholder { color: #6A6A88; }',
      '.qv-modal-input:focus { outline: none; border-color: rgba(0,245,255,0.5); }',
      '.qv-modal-submit { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 13px; background: linear-gradient(135deg, #7B2FFF 0%, #00F5FF 100%); border: none; border-radius: 10px; font-family: "Syne", sans-serif; font-weight: 700; font-size: 14px; color: #fff; cursor: pointer; transition: transform 0.15s, box-shadow 0.2s; }',
      '.qv-modal-submit:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(123,47,255,0.4); }',
      '.qv-btn-arrow { font-size: 16px; line-height: 1; }',
      '.qv-modal-foot { font-family: "JetBrains Mono", "DM Mono", monospace; font-size: 10.5px; letter-spacing: 0.04em; color: #6A6A88; line-height: 1.6; margin: 18px 0 0; text-align: center; }',
      '.qv-modal-success { display: none; text-align: center; padding: 16px 0; }',
      '.qv-modal-success.is-visible { display: block; }',
      '.qv-modal-check { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; background: linear-gradient(135deg, #34D399, #00F5FF); display: flex; align-items: center; justify-content: center; color: #06060A; box-shadow: 0 12px 30px rgba(52,211,153,0.3); animation: qvPop 480ms cubic-bezier(0.34, 1.56, 0.64, 1); }',
      '@keyframes qvPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }',
      '.qv-modal-success h3 { font-family: "Syne", sans-serif; font-weight: 800; font-size: 22px; color: #6EE7B7; margin: 0 0 10px; letter-spacing: -0.01em; }',
      '.qv-modal-success p { font-family: "DM Sans", sans-serif; font-size: 14px; color: #9090B0; line-height: 1.6; margin: 0; }',
      '.qv-modal-success a { color: #00F5FF; text-decoration: none; }',
      '.qv-modal-success a:hover { text-decoration: underline; }',
      /* ── FLOATING CTA ────────────────────────────────────────── */
      '.qv-float-cta { position: fixed; bottom: 24px; right: 24px; z-index: 998; max-width: 320px; padding: 16px 20px; background: linear-gradient(180deg, #14142A 0%, #0E0E1C 100%); border: 1px solid rgba(123,47,255,0.4); border-radius: 16px; box-shadow: 0 18px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset; opacity: 0; visibility: hidden; transform: translateY(20px); transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.3s; }',
      '.qv-float-cta.is-visible { opacity: 1; visibility: visible; transform: translateY(0); }',
      '.qv-float-x { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border: none; background: rgba(255,255,255,0.04); border-radius: 50%; color: #6A6A88; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }',
      '.qv-float-x:hover { background: rgba(247,84,84,0.1); color: #F75454; }',
      '.qv-float-tag { font-family: "JetBrains Mono", "DM Mono", monospace; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #00F5FF; margin-bottom: 6px; }',
      '.qv-float-body { padding-right: 20px; }',
      '.qv-float-text { font-family: "Syne", sans-serif; font-weight: 700; font-size: 14px; line-height: 1.35; color: #F0F0F8; margin: 0 0 10px; letter-spacing: -0.01em; }',
      '.qv-float-link { display: inline-flex; align-items: center; gap: 6px; font-family: "Syne", sans-serif; font-weight: 600; font-size: 12.5px; color: #00F5FF; text-decoration: none; padding: 6px 0; transition: gap 0.18s ease; }',
      '.qv-float-link:hover { gap: 10px; }',
      /* ── REDUCED MOTION ──────────────────────────────────────── */
      '@media (prefers-reduced-motion: reduce) {',
      '  .qv-modal, .qv-modal-backdrop, .qv-modal-check, .qv-float-cta { animation: none; transition: opacity 0.15s linear; transform: none; }',
      '}',
      /* ── MOBILE ────────────────────────────────────────────── */
      '@media (max-width: 540px) {',
      '  .qv-modal { padding: 28px 24px 22px; border-radius: 18px; }',
      '  .qv-modal-title { font-size: 22px; }',
      '  .qv-float-cta { left: 16px; right: 16px; max-width: none; bottom: 16px; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Boot ──────────────────────────────────────────────────────────
  injectStyles();
  if (enableExit) initExitModal();
  if (enableFloat) initFloatingCta();
})();
