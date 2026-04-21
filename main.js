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

  // Loading state
  btnText.textContent = 'Joining...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  fetch('/api/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok || data.message) {
      // Success — redirect to thank you page
      window.location.href = '/thank-you.html';
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(err => {
    console.error('Subscribe error:', err);
    // Fallback — show inline success so user isn't stuck
    if (btn) {
      btn.style.display = 'none';
    }
    if (document.querySelector('.form-row')) {
      document.querySelector('.form-row').style.opacity = '0.4';
    }
    if (success) {
      success.style.display = 'block';
    }
    // Still redirect after a moment
    setTimeout(() => {
      window.location.href = '/thank-you.html';
    }, 1500);
  });
}

// COPY MERCHANT LINK
function copyMerchantLink() {
  const url = 'https://quarvo.io/merchants';
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
