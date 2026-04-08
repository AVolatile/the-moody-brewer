(function() {
  'use strict';

  var API_ENDPOINT = '/api/content';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === '') return '';
    var number = Number(value);
    if (Number.isNaN(number)) return '';
    return '$' + number.toFixed(2);
  }

  function clear(node) {
    if (node) node.innerHTML = '';
  }

  function getBadgeMarkup(item) {
    var parts = [];
    if (!item.isAvailable) {
      parts.push('<span class="site-badge soldout">Sold Out</span>');
    }
    if (item.promotion && item.promotion.label) {
      parts.push('<span class="site-badge promo">' + escapeHtml(item.promotion.label) + '</span>');
    }
    if (item.isFeatured) {
      parts.push('<span class="site-badge feature">Featured</span>');
    }
    return parts.join('');
  }

  function buildSinglePriceMarkup(item) {
    var current = item.effectivePriceSingle != null ? item.effectivePriceSingle : item.priceSingle;
    var original = item.priceSingle;
    if (current == null && item.priceMedium != null) current = item.effectivePriceMedium != null ? item.effectivePriceMedium : item.priceMedium;
    if (original == null && item.priceMedium != null) original = item.priceMedium;

    if (current == null) {
      return '<span class="price-current">Market</span>';
    }

    return [
      '<div class="price-stack">',
        '<span class="price-current">' + escapeHtml(formatMoney(current)) + '</span>',
        (original != null && current !== original ? '<span class="price-original">' + escapeHtml(formatMoney(original)) + '</span>' : ''),
      '</div>'
    ].join('');
  }

  function buildMultiPriceMarkup(item, category) {
    var labels = category.priceLabels || [];
    var firstLabel = labels[0] || 'M';
    var secondLabel = labels[1] || 'L';

    function line(label, value, original) {
      if (value == null) return '';
      return [
        '<div class="menu-price-line">',
          '<span class="menu-price-label">' + escapeHtml(label) + '</span>',
          '<span class="menu-price-value">' + escapeHtml(formatMoney(value)) + '</span>',
          (original != null && value !== original ? '<span class="menu-price-original">' + escapeHtml(formatMoney(original)) + '</span>' : ''),
        '</div>'
      ].join('');
    }

    return [
      line(firstLabel, item.effectivePriceMedium != null ? item.effectivePriceMedium : item.priceMedium, item.priceMedium),
      line(secondLabel, item.effectivePriceLarge != null ? item.effectivePriceLarge : item.priceLarge, item.priceLarge)
    ].join('');
  }

  function renderPromotions(container, promotions) {
    if (!container) return;
    clear(container);

    if (!promotions || !promotions.length) {
      container.innerHTML = '<div class="empty-block compact">Daily specials can be added from the admin panel at any time.</div>';
      return;
    }

    container.innerHTML = promotions.map(function(promotion) {
      return [
        '<article class="promo-card">',
          '<p class="promo-card__eyebrow">Live Promotion</p>',
          '<h3>' + escapeHtml(promotion.title) + '</h3>',
          (promotion.description ? '<p>' + escapeHtml(promotion.description) + '</p>' : ''),
          '<div class="promo-card__meta">',
            (promotion.label ? '<span class="site-badge promo">' + escapeHtml(promotion.label) + '</span>' : ''),
            (promotion.startDate || promotion.endDate
              ? '<span class="promo-window">' + escapeHtml((promotion.startDate || 'Now') + ' - ' + (promotion.endDate || 'Ongoing')) + '</span>'
              : ''),
          '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderFeatured(container, items) {
    if (!container) return;
    clear(container);

    if (!items || !items.length) {
      container.innerHTML = '<div class="empty-block">Featured items will appear here as soon as they are added in the admin panel.</div>';
      return;
    }

    container.innerHTML = items.map(function(item) {
      var linked = item.linkedItem || null;
      var description = item.subtext || (linked && linked.description) || '';
      var image = item.imageUrl || (linked && linked.imageUrl) || '';
      var price = linked && linked.priceSummary ? linked.priceSummary : '';
      var label = item.promotion && item.promotion.label ? item.promotion.label : '';

      return [
        '<article class="featured-showcase-card">',
          '<div class="featured-showcase-card__media">',
            image
              ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.headline || (linked && linked.name) || 'Featured item') + '" loading="lazy">'
              : '<div class="featured-showcase-card__fallback"><span>' + escapeHtml((item.headline || 'M').charAt(0)) + '</span></div>',
          '</div>',
          '<div class="featured-showcase-card__body">',
            '<div class="featured-showcase-card__badges">',
              (label ? '<span class="site-badge promo">' + escapeHtml(label) + '</span>' : ''),
              (linked && !linked.isAvailable ? '<span class="site-badge soldout">Sold Out</span>' : ''),
            '</div>',
            '<h3>' + escapeHtml(item.headline || (linked && linked.name) || 'Featured Item') + '</h3>',
            '<p>' + escapeHtml(description) + '</p>',
            '<div class="featured-showcase-card__footer">',
              (linked && linked.name ? '<span class="featured-item-link">' + escapeHtml(linked.name) + '</span>' : '<span class="featured-item-link">House highlight</span>'),
              (price ? '<span class="featured-item-price">' + escapeHtml(price) + '</span>' : ''),
            '</div>',
          '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderCardCategory(category) {
    var items = category.items || [];
    return [
      '<section class="menu-catalog-section">',
        '<div class="menu-catalog-section__header">',
          '<div>',
            '<p class="menu-section-label">Menu Category</p>',
            '<h2>' + escapeHtml(category.name) + '</h2>',
          '</div>',
          (category.description ? '<p class="menu-catalog-section__description">' + escapeHtml(category.description) + '</p>' : ''),
        '</div>',
        '<div class="menu-card-grid">',
          (items.length ? items.map(function(item) {
            return [
              '<article class="menu-card">',
                '<div class="menu-card__media">',
                  item.imageUrl
                    ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.name) + '" loading="lazy">'
                    : '<div class="menu-card__fallback"><span>' + escapeHtml(item.name.charAt(0)) + '</span></div>',
                '</div>',
                '<div class="menu-card__body">',
                  '<div class="menu-card__badges">' + getBadgeMarkup(item) + '</div>',
                  '<h3>' + escapeHtml(item.name) + '</h3>',
                  (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : ''),
                  buildSinglePriceMarkup(item),
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-block">This category is ready for the next item.</div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderTableCategory(category) {
    var items = category.items || [];
    var labels = category.priceLabels || [];
    var firstLabel = labels[0] || 'M';
    var secondLabel = labels[1] || 'L';

    return [
      '<section class="menu-catalog-section">',
        '<div class="menu-catalog-section__header">',
          '<div>',
            '<p class="menu-section-label">Menu Category</p>',
            '<h2>' + escapeHtml(category.name) + '</h2>',
          '</div>',
          (category.description ? '<p class="menu-catalog-section__description">' + escapeHtml(category.description) + '</p>' : ''),
        '</div>',
        '<div class="menu-table-shell">',
          '<table class="menu-catalog-table">',
            '<thead>',
              '<tr>',
                '<th>Item</th>',
                '<th>' + escapeHtml(firstLabel) + '</th>',
                '<th>' + escapeHtml(secondLabel) + '</th>',
              '</tr>',
            '</thead>',
            '<tbody>',
              (items.length ? items.map(function(item) {
                return [
                  '<tr>',
                    '<td>',
                      '<div class="menu-table-title">' + escapeHtml(item.name) + '</div>',
                      (item.description ? '<div class="menu-table-desc">' + escapeHtml(item.description) + '</div>' : ''),
                      (getBadgeMarkup(item) ? '<div class="menu-table-badges">' + getBadgeMarkup(item) + '</div>' : ''),
                    '</td>',
                    '<td>' + buildMultiPriceMarkup({
                      priceMedium: item.priceMedium,
                      effectivePriceMedium: item.effectivePriceMedium
                    }, { priceLabels: [firstLabel] }) + '</td>',
                    '<td>' + buildMultiPriceMarkup({
                      priceLarge: item.priceLarge,
                      effectivePriceLarge: item.effectivePriceLarge
                    }, { priceLabels: ['', secondLabel] }) + '</td>',
                  '</tr>'
                ].join('');
              }).join('') : '<tr><td colspan="3"><div class="empty-block compact">This category is ready for the next item.</div></td></tr>'),
            '</tbody>',
          '</table>',
        '</div>',
      '</section>'
    ].join('');
  }

  function renderListCategory(category) {
    var items = category.items || [];
    return [
      '<section class="menu-catalog-section">',
        '<div class="menu-catalog-section__header">',
          '<div>',
            '<p class="menu-section-label">Menu Category</p>',
            '<h2>' + escapeHtml(category.name) + '</h2>',
          '</div>',
          (category.description ? '<p class="menu-catalog-section__description">' + escapeHtml(category.description) + '</p>' : ''),
        '</div>',
        '<div class="menu-list-grid">',
          (items.length ? items.map(function(item) {
            return [
              '<article class="menu-list-card">',
                '<div class="menu-list-card__content">',
                  '<div class="menu-card__badges">' + getBadgeMarkup(item) + '</div>',
                  '<h3>' + escapeHtml(item.name) + '</h3>',
                  (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : ''),
                '</div>',
                '<div class="menu-list-card__price">',
                  buildSinglePriceMarkup(item),
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-block">This category is ready for the next item.</div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderMenuPage(container, categories) {
    if (!container) return;
    clear(container);

    if (!categories || !categories.length) {
      container.innerHTML = '<div class="empty-block">The live menu is empty right now. Add categories and items from the admin panel.</div>';
      return;
    }

    container.innerHTML = categories.map(function(category) {
      if (category.layout === 'table') return renderTableCategory(category);
      if (category.layout === 'list') return renderListCategory(category);
      return renderCardCategory(category);
    }).join('');
  }

  function showLoadingStates() {
    var homeFeatured = document.getElementById('homepage-featured-root');
    var homePromotions = document.getElementById('home-promotions');
    var menuRoot = document.getElementById('menu-content-root');

    if (homePromotions) {
      homePromotions.innerHTML = '<div class="empty-block compact">Loading live promotions...</div>';
    }
    if (homeFeatured) {
      homeFeatured.innerHTML = '<div class="empty-block">Loading featured items...</div>';
    }
    if (menuRoot) {
      menuRoot.innerHTML = '<div class="empty-block">Loading live menu...</div>';
    }
  }

  function showFetchError(error) {
    console.error('Live content request failed', error);

    var homeFeatured = document.getElementById('homepage-featured-root');
    var homePromotions = document.getElementById('home-promotions');
    var menuRoot = document.getElementById('menu-content-root');

    if (homePromotions) {
      homePromotions.innerHTML = '<div class="empty-block compact">Promotions are temporarily unavailable.</div>';
    }
    if (homeFeatured) {
      homeFeatured.innerHTML = '<div class="empty-block">Featured items are temporarily unavailable.</div>';
    }
    if (menuRoot) {
      menuRoot.innerHTML = '<div class="empty-block">The live menu is temporarily unavailable.</div>';
    }
  }

  function bootstrap() {
    showLoadingStates();

    fetch(API_ENDPOINT, { cache: 'no-cache' })
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        renderPromotions(document.getElementById('home-promotions'), data.promotions || []);
        renderFeatured(document.getElementById('homepage-featured-root'), data.featuredItems || []);
        renderMenuPage(document.getElementById('menu-content-root'), data.categories || []);
      })
      .catch(showFetchError);
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
