document.addEventListener('DOMContentLoaded', () => {

  // Мобильное меню
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');

  burger?.addEventListener('click', () => {
    burger.classList.toggle('active');
    nav.classList.toggle('active');
  });

  // Закрытие меню при клике на ссылку
  document.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('active');
      nav.classList.remove('active');
    });
  });

  // Плавный скролл для якорных ссылок
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Эффект шапки при скролле
  const header = document.getElementById('header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
      header.style.boxShadow = 'var(--shadow-md)';
      header.style.padding = '8px 0';
    } else {
      header.style.boxShadow = 'var(--shadow-sm)';
      header.style.padding = '12px 0';
    }

    lastScroll = currentScroll;
  });

  // Простая валидация для будущих форм
  window.validatePhone = (phone) => {
    const pattern = /^\+375\s?\(?\d{2}\)?\s?\d{3}-\d{2}-\d{2}$/;
    return pattern.test(phone.replace(/\s/g, ''));
  };

  console.log('🌊 "Моя волна" — сайт загружен. Готов к наполнению контентом!');
});