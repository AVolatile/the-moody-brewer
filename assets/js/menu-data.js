(function() {
  'use strict';

  var API_ENDPOINT = '/api/content';
  var LOCAL_FALLBACK_ENDPOINT = './assets/data/menu.json';
  var IMAGE_PLACEHOLDERS = {
    drink: {
      token: 'placeholder:drink',
      icon: 'fa-mug-hot'
    },
    food: {
      token: 'placeholder:food',
      icon: 'fa-bread-slice'
    }
  };

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

  function setVisibility(node, isVisible) {
    if (node) node.hidden = !isVisible;
  }

  function setMessage(node, message, className) {
    if (!node) return;
    setVisibility(node, true);
    node.innerHTML = '<div class="' + (className || 'empty-block') + '">' + escapeHtml(message) + '</div>';
  }

  function getImagePlaceholderConfig(value) {
    var normalized = String(value == null ? '' : value).trim().toLowerCase();

    if (normalized === IMAGE_PLACEHOLDERS.drink.token) return IMAGE_PLACEHOLDERS.drink;
    if (normalized === IMAGE_PLACEHOLDERS.food.token) return IMAGE_PLACEHOLDERS.food;
    return null;
  }

  function buildMenuImageMarkup(imageUrl, altText, fallbackClass, fallbackText) {
    var placeholder = getImagePlaceholderConfig(imageUrl);

    if (placeholder) {
      return [
        '<div class="', fallbackClass, ' menu-image-placeholder menu-image-placeholder--',
        escapeHtml(placeholder.token.split(':')[1]),
        '"><i class="fa ', escapeHtml(placeholder.icon), '" aria-hidden="true"></i></div>'
      ].join('');
    }

    if (imageUrl) {
      return '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(altText) + '" loading="lazy">';
    }

    return '<div class="' + fallbackClass + '"><span>' + escapeHtml(fallbackText) + '</span></div>';
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function canUseLocalFallback() {
    var host = window.location && window.location.hostname ? window.location.hostname : '';
    return window.location.protocol === 'file:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0';
  }

  function buildLocalFallbackContent(payload) {
    var rawItems = payload && Array.isArray(payload.items) ? payload.items : [];
    var categories = [];
    var categoryMap = {};
    var featuredItems = [];

    rawItems.forEach(function(rawItem, index) {
      var categoryName = rawItem && rawItem.category ? String(rawItem.category).trim() : 'Menu Favorites';
      var price = rawItem && rawItem.price != null ? Number(rawItem.price) : null;
      var item = {
        name: rawItem && rawItem.name ? String(rawItem.name).trim() : 'Featured Item',
        description: rawItem && rawItem.description ? String(rawItem.description).trim() : '',
        priceType: rawItem && rawItem.priceType ? String(rawItem.priceType).trim() : 'numeric',
        priceSingle: Number.isFinite(price) ? price : null,
        effectivePriceSingle: Number.isFinite(price) ? price : null,
        imageUrl: rawItem && rawItem.imageUrl ? String(rawItem.imageUrl).trim() : '',
        isAvailable: true,
        isFeatured: index < 3,
        promotion: null
      };

      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = {
          name: categoryName,
          description: '',
          layout: 'card',
          priceLabels: [],
          allowMultiPrice: false,
          items: []
        };
        categories.push(categoryMap[categoryName]);
      }

      categoryMap[categoryName].items.push(item);

      if (featuredItems.length < 3) {
        featuredItems.push({
          headline: item.name,
          subtext: item.description,
          imageUrl: item.imageUrl,
          promotion: null,
          linkedItem: {
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            isAvailable: true,
            priceSummary: item.priceSingle != null ? formatMoney(item.priceSingle) : ''
          }
        });
      }
    });

    return {
      promotions: [],
      featuredItems: featuredItems,
      categories: categories
    };
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
    var priceType = item.priceType || 'numeric';
    if (priceType === 'tbd') return '<span class="price-current">TBD</span>';
    if (priceType === 'in_store') return '<span class="price-current">See in store</span>';

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
    var priceType = item.priceType || 'numeric';
    if (priceType === 'tbd') return '<span class="price-current">TBD</span>';
    if (priceType === 'in_store') return '<span class="price-current">See in store</span>';

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
      setVisibility(container, false);
      return;
    }

    setVisibility(container, true);

    container.innerHTML = promotions.map(function(promotion) {
      return [
        '<article class="promo-card">',
          '<p class="promo-card__eyebrow">Special Offer</p>',
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
      setMessage(container, 'Seasonal favorites will be shared here soon.', 'empty-block empty-block--spotlight');
      return;
    }

    setVisibility(container, true);

    container.innerHTML = items.map(function(item) {
      var linked = item.linkedItem || null;
      var description = item.subtext || (linked && linked.description) || '';
      var image = item.imageUrl || (linked && linked.imageUrl) || '';
      var price = linked && linked.priceSummary ? linked.priceSummary : '';
      var label = item.promotion && item.promotion.label ? item.promotion.label : '';

      return [
        '<article class="featured-showcase-card">',
          '<div class="featured-showcase-card__media">',
            buildMenuImageMarkup(
              image,
              item.headline || (linked && linked.name) || 'Featured item',
              'featured-showcase-card__fallback',
              (item.headline || 'M').charAt(0)
            ),
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
            '<p class="menu-section-label">On the Menu</p>',
            '<h2>' + escapeHtml(category.name) + '</h2>',
          '</div>',
          (category.description ? '<p class="menu-catalog-section__description">' + escapeHtml(category.description) + '</p>' : ''),
        '</div>',
        '<div class="menu-card-grid">',
          (items.length ? items.map(function(item) {
            return [
              '<article class="menu-card">',
                '<div class="menu-card__media">',
                  buildMenuImageMarkup(item.imageUrl, item.name, 'menu-card__fallback', item.name.charAt(0)),
                '</div>',
                '<div class="menu-card__body">',
                  '<div class="menu-card__badges">' + getBadgeMarkup(item) + '</div>',
                  '<h3>' + escapeHtml(item.name) + '</h3>',
                  (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : ''),
                  buildSinglePriceMarkup(item),
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-block">More favorites coming soon.</div>'),
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
            '<p class="menu-section-label">On the Menu</p>',
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
              }).join('') : '<tr><td colspan="3"><div class="empty-block compact">More favorites coming soon.</div></td></tr>'),
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
            '<p class="menu-section-label">On the Menu</p>',
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
          }).join('') : '<div class="empty-block">More favorites coming soon.</div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderMenuPage(container, categories) {
    if (!container) return;
    clear(container);
    setVisibility(container, true);

    if (!categories || !categories.length) {
      setMessage(container, 'Our menu is being refreshed. Please check back soon.');
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
      clear(homePromotions);
      setVisibility(homePromotions, false);
    }
    if (homeFeatured) {
      setMessage(homeFeatured, 'Loading today\'s favorites...', 'empty-block empty-block--spotlight');
    }
    if (menuRoot) {
      setMessage(menuRoot, 'Loading the menu...');
    }
  }

  function showFetchError(error) {
    console.error('Website content request failed', error);

    var homeFeatured = document.getElementById('homepage-featured-root');
    var homePromotions = document.getElementById('home-promotions');
    var menuRoot = document.getElementById('menu-content-root');

    if (homePromotions) {
      clear(homePromotions);
      setVisibility(homePromotions, false);
    }
    if (homeFeatured) {
      setMessage(homeFeatured, 'Fresh favorites will be shared here soon.', 'empty-block empty-block--spotlight');
    }
    if (menuRoot) {
      setMessage(menuRoot, 'Our menu is taking a moment to load. Please check back shortly.');
    }
  }

  function bootstrap() {
    showLoadingStates();

    fetchJson(API_ENDPOINT)
      .then(function(data) {
        renderPromotions(document.getElementById('home-promotions'), data.promotions || []);
        renderFeatured(document.getElementById('homepage-featured-root'), data.featuredItems || []);
        renderMenuPage(document.getElementById('menu-content-root'), data.categories || []);
      })
      .catch(function(apiError) {
        if (!canUseLocalFallback()) {
          showFetchError(apiError);
          return;
        }

        return fetchJson(LOCAL_FALLBACK_ENDPOINT)
          .then(buildLocalFallbackContent)
          .then(function(data) {
            renderPromotions(document.getElementById('home-promotions'), data.promotions || []);
            renderFeatured(document.getElementById('homepage-featured-root'), data.featuredItems || []);
            renderMenuPage(document.getElementById('menu-content-root'), data.categories || []);
          })
          .catch(function(fallbackError) {
            showFetchError(fallbackError || apiError);
          });
      });
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
