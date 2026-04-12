// =============================================
// QUARVO — main.js
// =============================================

// NAV: add .scrolled class on scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });

// WAITLIST FORM — Netlify Forms submission
function handleSubmit(e) {
  e.preventDefault();

  const form = document.getElementById('waitlistForm');
  const email = document.getElementById('emailInput').value;
  const btn = document.querySelector('.btn-submit');
  const btnText = document.getElementById('btnText');
  const success = document.getElementById('formSuccess');

  // Loading state
  btnText.textContent = 'Joining...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  // Submit to Netlify
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'form-name': 'quarvo-waitlist',
      'email': email,
    }).toString(),
  })
  .then(() => {
    // Redirect to thank you page
    window.location.href = '/thank-you.html';
  })
  .catch(() => {
    // Fallback — still show success inline
    form.querySelector('.form-row').style.display = 'none';
    form.querySelector('.form-note').style.display = 'none';
    success.classList.add('visible');
  });
}

// SCROLL REVEAL — Intersection Observer
const revealElements = document.querySelectorAll(
  '.problem-card, .solution-feature, .step, .faq-item, .use-case, .stat-item, .vs-block, .manifesto-content'
);

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.animationDelay = `${(entry.target.dataset.index || 0) * 0.08}s`;
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealElements.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  el.dataset.index = i % 4;
  observer.observe(el);
});

// Add class for animation
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .revealed {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  </style>
`);

// SMOOTH ANCHOR SCROLLING with offset for fixed nav
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// CARD BAR ANIMATION on hero load
window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelectorAll('.card-bar-fill').forEach(bar => {
      const width = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => { bar.style.width = width; }, 100);
    });
  }, 800);
});
