document.addEventListener('DOMContentLoaded', () => {

  // ── Mobile menu ──
  const burger = document.getElementById('burger');
  const nav    = document.getElementById('nav');
  const header = document.getElementById('header');

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('active');
      nav.classList.toggle('active');
      burger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    document.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('active');
        nav.classList.remove('active');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('active')) {
        burger.classList.remove('active');
        nav.classList.remove('active');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Header: transparent → solid on scroll ──
  if (header) {
    const isTransparent = header.classList.contains('header--transparent');
    const isOnHero = header.classList.contains('header--on-hero');

    const updateHeader = () => {
      const scrolled = window.scrollY > 60;
      header.classList.toggle('header--scrolled', scrolled);

      if (isOnHero) {
        if (scrolled) {
          header.classList.remove('header--on-hero');
        } else {
          header.classList.add('header--on-hero');
        }
      }
    };

    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }

  // ── Scroll reveal via IntersectionObserver ──
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-stagger');

  if (revealEls.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -48px 0px',
    });

    revealEls.forEach(el => observer.observe(el));
  } else {
    // Fallback: make all visible
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // ── Phone validation (shared utility) ──
  window.validatePhone = (phone) => {
    const pattern = /^\+375\s?\(?\d{2}\)?\s?\d{3}-\d{2}-\d{2}$/;
    return pattern.test(phone.replace(/\s/g, ''));
  };

});
