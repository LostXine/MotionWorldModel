/* ============================================================
   Research Project Page — script.js
   ============================================================ */

// ---------- Copy BibTeX ----------
function copyBibtex() {
  const text = document.getElementById('bibtex-text').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-check';
    btn.style.background = '#4ade80';
    btn.style.color = '#0d0f14';
    setTimeout(() => {
      icon.className = 'fas fa-copy';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
}

// ---------- Intersection Observer: fade-in sections ----------
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);

document.querySelectorAll('.section, .method-card, figure, .video-item').forEach((el) => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// ---------- Lazy-load videos ----------
// Pause autoplay videos when they leave the viewport to save resources
const videoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll('video[autoplay]').forEach((v) => videoObserver.observe(v));

// ---------- Smooth active nav highlighting ----------
// If you add a <nav> bar later, this snippet tracks which section is in view
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav a[href^="#"]');

if (navLinks.length > 0) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => link.classList.remove('active'));
          const active = document.querySelector(`nav a[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  sections.forEach((s) => sectionObserver.observe(s));
}
