// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const authBtn = document.getElementById('authBtn');
  if (!authBtn) return;

  // Быстрая проверка из кэша
  const cached = sessionStorage.getItem('currentUser');
  if (cached) {
    const user = JSON.parse(cached);
    authBtn.textContent = `👤 ${user.name || user.first_name}`;
    authBtn.href = 'dashboard.html';
    authBtn.classList.remove('btn--outline');
    authBtn.classList.add('btn--primary');
    return;
  }

  // Если нет в кэше — проверяем сессию сервера (без редиректов)
  fetch('api/auth.php?action=me', { credentials: 'same-origin' })
    .then(res => res.json())
    .then(data => {
      if (data.user) {
        sessionStorage.setItem('currentUser', JSON.stringify(data.user));
        authBtn.textContent = `👤 ${data.user.name || data.user.first_name}`;
        authBtn.href = 'dashboard.html';
        authBtn.classList.remove('btn--outline');
        authBtn.classList.add('btn--primary');
      }
    })
    .catch(() => { }); // Не авторизован — оставляем кнопку "Войти"
});

// Выход
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' });
  sessionStorage.removeItem('currentUser');
  window.location.href = 'index.html';
});