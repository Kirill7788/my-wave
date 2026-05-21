// js/components/CottageCard.js
// Canonical cottage card factory. Requires js/utils/dom.js loaded first.

window.CottageCard = function(cottage) {
  const card = document.createElement('article');
  card.className = 'cottage-card';
  card.dataset.type  = escapeHtml(cottage.type_slug || '');
  card.dataset.price = cottage.price_min;

  const slug     = escapeHtml(cottage.slug);
  const imgUrl   = escapeHtml(cottage.image_url || '');
  const badge    = escapeHtml(cottage.type_slug || 'economy');
  const typeName = escapeHtml(cottage.type_name || '');

  card.innerHTML = `
    <div class="cottage-card__image-wrap">
      <div class="card__image" style="background-image:url('${imgUrl}')"></div>
      <span class="cottage-card__badge ${badge}">${typeName}</span>
    </div>
    <div class="cottage-card__body">
      <h3 class="cottage-card__name"></h3>
      <p class="cottage-card__location"></p>
      <div class="cottage-card__features"></div>
      <div class="cottage-card__footer">
        <div>
          <span class="cottage-card__price"></span>
          <span class="cottage-card__price-unit">/ ночь</span>
        </div>
        <a href="cottage.html?slug=${slug}" class="cottage-card__link">Подробнее →</a>
      </div>
    </div>
  `;

  // XSS-safe text insertion
  card.querySelector('.cottage-card__name').textContent = cottage.name || '';
  card.querySelector('.cottage-card__location').textContent =
    (cottage.lake_name || '') + (cottage.region ? ', ' + cottage.region : '');
  card.querySelector('.cottage-card__price').textContent =
    formatPrice(cottage.price_min, cottage.price_max);

  const featEl  = card.querySelector('.cottage-card__features');
  const features = Array.isArray(cottage.features) ? cottage.features : [];
  features.slice(0, 3).forEach(function(feature) {
    const tag = document.createElement('span');
    tag.className = 'cottage-card__feat';
    tag.textContent = feature;
    featEl.appendChild(tag);
  });

  // Make whole card clickable
  card.style.cursor = 'pointer';
  card.addEventListener('click', function(e) {
    if (!e.target.closest('a')) {
      window.location.href = 'cottage.html?slug=' + slug;
    }
  });

  return card;
};
