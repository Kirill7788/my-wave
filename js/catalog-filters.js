// js/catalog-filters.js
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('cottagesGrid');
  const loading = document.getElementById('loading');
  const noResults = document.getElementById('noResults');
  const countEl = document.getElementById('resultsCount');
  const sortEl = document.getElementById('sortBy');

  if (!grid || !loading) return;

  const params = new URLSearchParams(window.location.search);
  const activeFilters = {
    type: params.get('type') || undefined,
    lake: params.get('lake') || undefined,
    min_price: params.get('min_price') || undefined,
    max_price: params.get('max_price') || undefined
  };

  // Синхронизация UI
  document.querySelectorAll('input[name="type"]').forEach(cb => cb.checked = cb.value === activeFilters.type);
  const lakeSelect = document.getElementById('lakeFilter');
  if (lakeSelect) lakeSelect.value = activeFilters.lake || '';
  document.querySelector('input[name="min_price"]').value = activeFilters.min_price || '';
  document.querySelector('input[name="max_price"]').value = activeFilters.max_price || '';

  async function renderCottages(filters) {
    loading.classList.remove('hidden');
    grid.innerHTML = '';

    try {
      const query = new URLSearchParams(filters);
      const res = await fetch(`api/cottages.php?${query}`);
      const data = await res.json();
      loading.classList.add('hidden');

      if (!data.cottages || data.cottages.length === 0) {
        noResults.classList.remove('hidden');
        countEl.textContent = 'Найдено: 0';
        return;
      }
      noResults.classList.add('hidden');
      countEl.textContent = `Найдено: ${data.cottages.length}`;

      grid.innerHTML = data.cottages.map(c => `
        <article class="cottage-card" data-type="${c.type_slug}">
          <a href="cottage-${c.slug}.html" style="display:contents">
            <div class="cottage-card__image" style="background-image:url('${c.image_url}')">
              <span class="cottage-card__badge ${c.type_slug}">${c.type_name}</span>
            </div>
            <div class="cottage-card__content">
              <h3 class="cottage-card__title">${c.name}</h3>
              <div class="cottage-card__lake">📍 ${c.lake_name}, ${c.region}</div>
              <div class="cottage-card__features">${c.features.slice(0, 3).map(f => `<span>${f}</span>`).join('')}</div>
              <div class="cottage-card__price">${c.price_min}–${c.price_max} BYN <span>/ ночь</span></div>
            </div>
          </a>
        </article>
      `).join('');
    } catch (e) {
      loading.textContent = '⚠️ Ошибка загрузки. Проверьте PHP-сервер.';
      console.error(e);
    }
  }

  document.getElementById('applyFilters')?.addEventListener('click', () => {
    const f = {
      type: document.querySelector('input[name="type"]:checked')?.value,
      lake: document.getElementById('lakeFilter')?.value || undefined,
      min_price: document.querySelector('input[name="min_price"]')?.value || undefined,
      max_price: document.querySelector('input[name="max_price"]')?.value || undefined
    };
    const url = new URL(window.location);
    Object.entries(f).forEach(([k, v]) => v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    window.history.pushState({}, '', url);
    renderCottages(f);
  });

  document.getElementById('resetFilters')?.addEventListener('click', () => window.location.href = 'catalog.html');

  sortEl?.addEventListener('change', () => {
    const cards = Array.from(grid.children);
    if (sortEl.value === 'price_asc') cards.sort((a, b) => parseInt(a.querySelector('.cottage-card__price').textContent) - parseInt(b.querySelector('.cottage-card__price').textContent));
    else if (sortEl.value === 'price_desc') cards.sort((a, b) => parseInt(b.querySelector('.cottage-card__price').textContent) - parseInt(a.querySelector('.cottage-card__price').textContent));
    cards.forEach(c => grid.appendChild(c));
  });

  renderCottages(activeFilters);
});