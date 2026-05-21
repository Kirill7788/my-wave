// js/catalog-filters.js — используется на catalog.html
// Зависимости: js/utils/dom.js, js/components/CottageCard.js

document.addEventListener('DOMContentLoaded', function() {
  const grid      = document.getElementById('cottagesGrid');
  const loading   = document.getElementById('loading');
  const noResults = document.getElementById('noResults');
  const countEl   = document.getElementById('resultsCount');
  const sortEl    = document.getElementById('sortBy');

  if (!grid || !loading) return;

  let currentData = [];

  // Читаем начальные фильтры из URL
  const urlParams   = new URLSearchParams(window.location.search);
  const activeFilters = {
    type:      urlParams.get('type')      || undefined,
    lake:      urlParams.get('lake')      || undefined,
    min_price: urlParams.get('min_price') || undefined,
    max_price: urlParams.get('max_price') || undefined,
    has_bath:  urlParams.get('has_bath')  || undefined,
  };

  // Синхронизируем UI с URL-параметрами
  if (activeFilters.type) {
    const radio = document.querySelector(`input[name="type"][value="${escapeHtml(activeFilters.type)}"]`);
    if (radio) radio.checked = true;
  }
  const lakeSelect = document.getElementById('lakeFilter');
  if (lakeSelect && activeFilters.lake) lakeSelect.value = activeFilters.lake;

  const minEl = document.getElementById('minPrice');
  const maxEl = document.getElementById('maxPrice');
  if (minEl && activeFilters.min_price) minEl.value = activeFilters.min_price;
  if (maxEl && activeFilters.max_price) maxEl.value = activeFilters.max_price;

  async function renderCottages(filters) {
    loading.classList.remove('hidden');
    loading.style.display = 'block';
    grid.innerHTML = '';
    if (noResults) noResults.classList.add('hidden');

    try {
      // Убираем undefined-значения из объекта фильтров
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
      );

      const data = await API.getCottages(cleanFilters);
      loading.style.display = 'none';

      if (!data.cottages || data.cottages.length === 0) {
        if (noResults) noResults.classList.remove('hidden');
        if (countEl) countEl.textContent = 'Найдено: 0';
        currentData = [];
        return;
      }

      currentData = data.cottages;
      if (countEl) countEl.textContent = `Найдено: ${data.cottages.length}`;
      renderSorted();

    } catch (e) {
      loading.textContent = '⚠️ Ошибка загрузки. Проверьте сервер.';
      console.error(e);
    }
  }

  function renderSorted() {
    const sortValue = sortEl ? sortEl.value : 'default';
    const sorted    = [...currentData];

    if (sortValue === 'price_asc') {
      sorted.sort((a, b) => parseFloat(a.price_min) - parseFloat(b.price_min));
    } else if (sortValue === 'price_desc') {
      sorted.sort((a, b) => parseFloat(b.price_min) - parseFloat(a.price_min));
    }

    grid.innerHTML = '';
    sorted.forEach(function(cottage) {
      grid.appendChild(CottageCard(cottage));
    });
  }

  // Применение фильтров
  document.getElementById('applyFilters')?.addEventListener('click', function() {
    const filters = {
      type:      document.querySelector('input[name="type"]:checked')?.value || undefined,
      lake:      document.getElementById('lakeFilter')?.value || undefined,
      min_price: document.getElementById('minPrice')?.value || undefined,
      max_price: document.getElementById('maxPrice')?.value || undefined,
      has_bath:  document.getElementById('hasBath')?.checked ? '1' : undefined,
    };

    const url = new URL(window.location);
    Object.entries(filters).forEach(([k, v]) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
    );
    window.history.pushState({}, '', url);

    renderCottages(filters);
  });

  // Сброс фильтров
  document.getElementById('resetFilters')?.addEventListener('click', function() {
    window.location.href = 'catalog.html';
  });

  // Сортировка (работает на уже загруженных данных, без нового запроса)
  sortEl?.addEventListener('change', function() {
    if (currentData.length > 0) renderSorted();
  });

  // Первая загрузка
  renderCottages(activeFilters);
});
