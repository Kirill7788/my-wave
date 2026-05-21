document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const lakeCards = document.querySelectorAll('.lake-card');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Убираем active со всех кнопок
      filterBtns.forEach(b => b.classList.remove('active'));
      // Добавляем active на нажатую
      btn.classList.add('active');
      
      const filter = btn.dataset.filter;
      
      lakeCards.forEach(card => {
        if (filter === 'all') {
          card.classList.remove('hidden');
          // Анимация появления
          card.style.animation = 'fadeInUp 0.5s ease forwards';
        } else {
          const categories = card.dataset.category || '';
          if (categories.includes(filter)) {
            card.classList.remove('hidden');
            card.style.animation = 'fadeInUp 0.5s ease forwards';
          } else {
            card.classList.add('hidden');
          }
        }
      });
    });
  });
  
  // Плавное появление карточек при загрузке
  lakeCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.6s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 100);
  });
});