// js/components/CottageCard.js
// Единственный канонический шаблон карточки коттеджа.
// Зависимость: js/utils/dom.js (должен быть загружен раньше).

window.CottageCard = function(cottage) {
  const card = document.createElement('article');
  card.className = 'cottage-card';
  card.dataset.type  = escapeHtml(cottage.type_slug || '');
  card.dataset.price = cottage.price_min;

  const slug    = escapeHtml(cottage.slug);
  const imgUrl  = escapeHtml(cottage.image_url || '');
  const badge   = escapeHtml(cottage.type_slug || 'economy');
  const typeName = escapeHtml(cottage.type_name || '');

  card.innerHTML = `
    <a href="cottage.html?slug=${slug}" class="cottage-card__link" style="display:contents">
      <div class="cottage-card__image" style="background-image:url('${imgUrl}')">
        <span class="cottage-card__badge ${badge}">${typeName}</span>
      </div>
      <div class="cottage-card__content">
        <h3 class="cottage-card__title"></h3>
        <div class="cottage-card__lake"></div>
        <div class="cottage-card__features"></div>
        <div class="cottage-card__price">
          <span class="price-value"></span>
          <span class="price-unit"> / ночь</span>
        </div>
        <a href="cottage.html?slug=${slug}" class="btn btn--primary btn--full">Подробнее</a>
      </div>
    </a>
  `;

  // Вставляем текстовые данные через textContent — защита от XSS
  card.querySelector('.cottage-card__title').textContent = cottage.name || '';
  card.querySelector('.cottage-card__lake').textContent  =
    '📍 ' + (cottage.lake_name || '') + (cottage.region ? ', ' + cottage.region : '');
  card.querySelector('.price-value').textContent =
    formatPrice(cottage.price_min, cottage.price_max);

  const featuresEl = card.querySelector('.cottage-card__features');
  const features   = Array.isArray(cottage.features) ? cottage.features : [];
  features.slice(0, 3).forEach(function(feature) {
    const span = document.createElement('span');
    span.textContent = feature;
    featuresEl.appendChild(span);
  });

  return card;
};
