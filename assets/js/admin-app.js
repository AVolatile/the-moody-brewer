(function() {
  'use strict';

  var state = {
    auth: {
      configured: true,
      authenticated: false,
      requiredUsername: 'admin',
      username: null
    },
    snapshot: {
      dashboard: {
        categoryCount: 0,
        itemCount: 0,
        availableItemCount: 0,
        featuredItemCount: 0,
        activePromotionCount: 0
      },
      categories: [],
      menuItems: [],
      featuredItems: [],
      promotions: []
    },
    view: 'overview',
    itemSearch: '',
    itemCategoryFilter: 'all',
    drawer: null,
    drawerUploadData: null,
    drawerPreviewUrl: null,
    pendingDelete: null,
    sidebarOpen: false
  };

  var refs = {
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginError: document.getElementById('loginError'),
    loginMessage: document.getElementById('loginMessage'),
    appShell: document.getElementById('appShell'),
    sidebar: document.getElementById('sidebar'),
    sidebarStatusText: document.getElementById('sidebarStatusText'),
    logoutBtn: document.getElementById('logoutBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    createBtn: document.getElementById('createBtn'),
    createBtnLabel: document.getElementById('createBtnLabel'),
    viewTitle: document.getElementById('viewTitle'),
    viewContainer: document.getElementById('viewContainer'),
    statsRow: document.getElementById('statsRow'),
    drawer: document.getElementById('drawer'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    drawerForm: document.getElementById('drawerForm'),
    drawerTitle: document.getElementById('drawerTitle'),
    drawerSubmitBtn: document.getElementById('drawerSubmitBtn'),
    drawerCancelBtn: document.getElementById('drawerCancelBtn'),
    drawerCloseBtn: document.getElementById('drawerCloseBtn'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn'),
    toastContainer: document.getElementById('toastContainer'),
    sessionStatus: document.getElementById('sessionStatus'),
    sessionStatusLabel: document.getElementById('sessionStatusLabel'),
    mobileNavToggle: document.getElementById('mobileNavToggle'),
    navCategoryCount: document.getElementById('navCategoryCount'),
    navItemCount: document.getElementById('navItemCount'),
    navFeaturedCount: document.getElementById('navFeaturedCount'),
    navPromotionCount: document.getElementById('navPromotionCount')
  };

  var viewMeta = {
    overview: { title: 'Overview', createLabel: 'New Menu Item', createEntity: 'item' },
    categories: { title: 'Menu Categories', createLabel: 'New Category', createEntity: 'category' },
    items: { title: 'Menu Items', createLabel: 'New Menu Item', createEntity: 'item' },
    featured: { title: 'Featured Items', createLabel: 'New Featured Item', createEntity: 'featured' },
    promotions: { title: 'Promotions', createLabel: 'New Promotion', createEntity: 'promotion' }
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
    if (value === null || value === undefined || value === '') return '—';
    var number = Number(value);
    if (Number.isNaN(number)) return '—';
    return '$' + number.toFixed(2);
  }

  function setLoading(button, isLoading) {
    if (!button) return;
    button.classList.toggle('loading', Boolean(isLoading));
    button.disabled = Boolean(isLoading);
  }

  function showToast(type, title, message) {
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = [
      '<div class="toast-icon"><i class="fa ',
      type === 'success' ? 'fa-check' : type === 'error' ? 'fa-exclamation' : 'fa-info',
      '"></i></div>',
      '<div class="toast-msg"><strong>', escapeHtml(title), '</strong>', escapeHtml(message), '</div>',
      '<button class="toast-close" type="button" aria-label="Close"><i class="fa fa-times"></i></button>'
    ].join('');

    refs.toastContainer.appendChild(toast);
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });

    function closeToast() {
      toast.classList.remove('show');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }

    toast.querySelector('.toast-close').addEventListener('click', closeToast);
    setTimeout(closeToast, 4200);
  }

  function getJson(response) {
    if (response.status === 204) return Promise.resolve({});
    return response.json().catch(function() {
      return {};
    });
  }

  function apiRequest(path, options) {
    var requestOptions = options || {};
    requestOptions.headers = requestOptions.headers || {};
    if (requestOptions.body && !requestOptions.headers['Content-Type']) {
      requestOptions.headers['Content-Type'] = 'application/json';
    }

    return fetch(path, requestOptions).then(function(response) {
      return getJson(response).then(function(body) {
        if (response.status === 401 && path !== '/api/admin/auth') {
          showLogin();
          throw new Error('Your session has expired. Sign in again.');
        }
        if (!response.ok) {
          throw new Error(body && body.error ? body.error : 'Request failed.');
        }
        return body;
      });
    });
  }

  function sortByDisplayOrder(items) {
    return items.slice().sort(function(a, b) {
      return (a.displayOrder || 0) - (b.displayOrder || 0) || (a.id || 0) - (b.id || 0);
    });
  }

  function getCategoryById(categoryId) {
    return state.snapshot.categories.find(function(category) {
      return Number(category.id) === Number(categoryId);
    }) || null;
  }

  function getPromotionById(promotionId) {
    return state.snapshot.promotions.find(function(promotion) {
      return Number(promotion.id) === Number(promotionId);
    }) || null;
  }

  function getMenuItemById(itemId) {
    return state.snapshot.menuItems.find(function(item) {
      return Number(item.id) === Number(itemId);
    }) || null;
  }

  function getFeaturedItemById(itemId) {
    return state.snapshot.featuredItems.find(function(item) {
      return Number(item.id) === Number(itemId);
    }) || null;
  }

  function priceSummary(item, category) {
    if (!item) return '—';
    if (category && category.allowMultiPrice) {
      var labels = category.priceLabels || [];
      var parts = [];
      if (item.priceMedium != null) parts.push((labels[0] || 'M') + ' ' + formatMoney(item.priceMedium));
      if (item.priceLarge != null) parts.push((labels[1] || 'L') + ' ' + formatMoney(item.priceLarge));
      return parts.length ? parts.join(' / ') : '—';
    }
    return item.priceSingle != null ? formatMoney(item.priceSingle) : '—';
  }

  function currentMeta() {
    return viewMeta[state.view] || viewMeta.overview;
  }

  function syncTopbar() {
    var meta = currentMeta();
    refs.viewTitle.innerHTML = meta.title;
    refs.createBtnLabel.textContent = meta.createLabel;
    refs.createBtn.dataset.entity = meta.createEntity;

    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function(link) {
      link.classList.toggle('active', link.getAttribute('data-view') === state.view);
    });
  }

  function showLogin() {
    state.auth.authenticated = false;
    refs.loginScreen.classList.remove('hidden');
    refs.appShell.hidden = true;
    refs.sessionStatus.className = 'status-pill locked';
    refs.sessionStatusLabel.textContent = 'Signed Out';
  }

  function showApp() {
    refs.loginScreen.classList.add('hidden');
    refs.appShell.hidden = false;
    refs.sessionStatus.className = 'status-pill unlocked';
    refs.sessionStatusLabel.textContent = 'Authenticated';
  }

  function renderStats() {
    var dashboard = state.snapshot.dashboard;
    refs.statsRow.innerHTML = [
      statCard('fa-layer-group', 'brown', 'Categories', dashboard.categoryCount),
      statCard('fa-coffee', 'blue', 'Menu Items', dashboard.itemCount),
      statCard('fa-check-circle', 'green', 'Available', dashboard.availableItemCount),
      statCard('fa-tags', 'purple', 'Live Promotions', dashboard.activePromotionCount)
    ].join('');
  }

  function statCard(icon, colorClass, label, value) {
    return [
      '<article class="stat-card">',
        '<div class="stat-icon ', colorClass, '"><i class="fa ', icon, '"></i></div>',
        '<div>',
          '<div class="stat-label">', escapeHtml(label), '</div>',
          '<div class="stat-value">', escapeHtml(String(value)), '</div>',
        '</div>',
      '</article>'
    ].join('');
  }

  function renderOverviewView() {
    var activePromotions = sortByDisplayOrder(state.snapshot.promotions).filter(function(promotion) {
      return promotion.isCurrent;
    });
    var featuredItems = sortByDisplayOrder(state.snapshot.featuredItems).slice(0, 4);
    var categories = sortByDisplayOrder(state.snapshot.categories);

    return [
      '<div class="overview-grid">',
        '<section class="section-card">',
          '<div class="section-card-header"><h3>Live Promotions</h3></div>',
          '<div class="content-pad">',
            (activePromotions.length ? activePromotions.map(function(promotion) {
              return [
                '<div class="overview-list-item">',
                  '<div>',
                    '<strong>', escapeHtml(promotion.title), '</strong>',
                    '<p>', escapeHtml(promotion.description || 'Promotion is live on the public site.'), '</p>',
                  '</div>',
                  '<span class="meta-pill warm">', escapeHtml(promotion.label || 'Active'), '</span>',
                '</div>'
              ].join('');
            }).join('') : '<div class="empty-state compact"><i class="fa fa-tags"></i><h4>No live promotions</h4><p>Create a promotion to surface offers on the homepage and menu.</p></div>'),
          '</div>',
        '</section>',
        '<section class="section-card">',
          '<div class="section-card-header"><h3>Featured Homepage Content</h3></div>',
          '<div class="content-pad">',
            (featuredItems.length ? featuredItems.map(function(item) {
              return [
                '<div class="overview-list-item">',
                  '<div>',
                    '<strong>', escapeHtml(item.headline), '</strong>',
                    '<p>', escapeHtml(item.linkedItem ? item.linkedItem.name : (item.subtext || 'Standalone featured item')), '</p>',
                  '</div>',
                  '<span class="meta-pill ', item.isActive ? 'success' : 'muted', '">', item.isActive ? 'Active' : 'Draft', '</span>',
                '</div>'
              ].join('');
            }).join('') : '<div class="empty-state compact"><i class="fa fa-star"></i><h4>No featured items yet</h4><p>Add homepage highlights that point visitors toward key menu items.</p></div>'),
          '</div>',
        '</section>',
      '</div>',
      '<section class="section-card mt-entity">',
        '<div class="section-card-header"><h3>Category Snapshot</h3></div>',
        '<div class="entity-grid compact-grid">',
          (categories.length ? categories.map(function(category) {
            var itemCount = state.snapshot.menuItems.filter(function(item) {
              return Number(item.categoryId) === Number(category.id);
            }).length;
            return [
              '<article class="entity-card">',
                '<div class="entity-card__head">',
                  '<div>',
                    '<div class="entity-eyebrow">', escapeHtml(category.layout), '</div>',
                    '<h4>', escapeHtml(category.name), '</h4>',
                  '</div>',
                  '<span class="meta-pill">', escapeHtml(String(itemCount)), ' items</span>',
                '</div>',
                '<p>', escapeHtml(category.description || 'No category description added.'), '</p>',
                '<div class="entity-card__meta">',
                  '<span class="meta-pill ', category.allowMultiPrice ? 'info' : 'muted', '">', category.allowMultiPrice ? 'Multi-price' : 'Single price', '</span>',
                  '<span class="meta-pill ', category.requireImage ? 'warm' : 'muted', '">', category.requireImage ? 'Image required' : 'Image optional', '</span>',
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-state compact"><i class="fa fa-layer-group"></i><h4>No categories yet</h4><p>Create categories before adding menu items.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderCategoriesView() {
    var categories = sortByDisplayOrder(state.snapshot.categories);

    return [
      '<section class="section-card">',
        '<div class="section-card-header">',
          '<h3>Category Manager</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="category"><i class="fa fa-plus"></i><span>Add Category</span></button>',
        '</div>',
        '<div class="entity-grid">',
          (categories.length ? categories.map(function(category, index) {
            var itemCount = state.snapshot.menuItems.filter(function(item) {
              return Number(item.categoryId) === Number(category.id);
            }).length;
            return [
              '<article class="entity-card">',
                '<div class="entity-card__head">',
                  '<div>',
                    '<div class="entity-eyebrow">', escapeHtml(category.slug), '</div>',
                    '<h4>', escapeHtml(category.name), '</h4>',
                  '</div>',
                  '<span class="meta-pill">', escapeHtml(String(itemCount)), ' items</span>',
                '</div>',
                '<p>', escapeHtml(category.description || 'No description yet.'), '</p>',
                '<div class="entity-card__meta">',
                  '<span class="meta-pill">', escapeHtml(category.layout), '</span>',
                  '<span class="meta-pill ', category.allowMultiPrice ? 'info' : 'muted', '">', category.allowMultiPrice ? 'Multi-price' : 'Single price', '</span>',
                  '<span class="meta-pill ', category.requireImage ? 'warm' : 'muted', '">', category.requireImage ? 'Image required' : 'Image optional', '</span>',
                '</div>',
                '<div class="entity-card__actions">',
                  '<button class="btn-tbl edit" type="button" data-action="edit" data-entity="category" data-id="', category.id, '"><i class="fa fa-edit"></i>Edit</button>',
                  '<button class="btn-tbl neutral" type="button" data-action="move-up" data-entity="category" data-id="', category.id, '" ', (index === 0 ? 'disabled' : ''), '><i class="fa fa-arrow-up"></i>Up</button>',
                  '<button class="btn-tbl neutral" type="button" data-action="move-down" data-entity="category" data-id="', category.id, '" ', (index === categories.length - 1 ? 'disabled' : ''), '><i class="fa fa-arrow-down"></i>Down</button>',
                  '<button class="btn-tbl del" type="button" data-action="delete" data-entity="category" data-id="', category.id, '" data-label="', escapeHtml(category.name), '"><i class="fa fa-trash"></i>Delete</button>',
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-state"><i class="fa fa-layer-group"></i><h4>No categories yet</h4><p>Create your first menu category to start structuring the live menu.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderItemTabs() {
    var categories = sortByDisplayOrder(state.snapshot.categories);
    return [
      '<div class="cat-tabs">',
        '<button class="cat-tab ', state.itemCategoryFilter === 'all' ? 'active' : '', '" type="button" data-category-filter="all">All <span class="tab-count">', state.snapshot.menuItems.length, '</span></button>',
        categories.map(function(category) {
          var count = state.snapshot.menuItems.filter(function(item) {
            return Number(item.categoryId) === Number(category.id);
          }).length;
          return '<button class="cat-tab ' + (String(state.itemCategoryFilter) === String(category.id) ? 'active' : '') + '" type="button" data-category-filter="' + category.id + '">' + escapeHtml(category.name) + ' <span class="tab-count">' + count + '</span></button>';
        }).join(''),
      '</div>'
    ].join('');
  }

  function filteredItems() {
    var query = state.itemSearch.trim().toLowerCase();
    return sortByDisplayOrder(state.snapshot.menuItems).filter(function(item) {
      var category = getCategoryById(item.categoryId);
      var matchesCategory = state.itemCategoryFilter === 'all' || String(item.categoryId) === String(state.itemCategoryFilter);
      var haystack = [
        item.name,
        item.description,
        category ? category.name : '',
        item.promotion ? item.promotion.title : ''
      ].join(' ').toLowerCase();
      return matchesCategory && (!query || haystack.indexOf(query) !== -1);
    });
  }

  function renderItemsView() {
    var items = filteredItems();

    return [
      '<section class="section-card">',
        '<div class="section-card-header">',
          '<h3>Menu Item Manager</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="item"><i class="fa fa-plus"></i><span>Add Item</span></button>',
        '</div>',
        '<div class="toolbar">',
          '<div class="search-wrap">',
            '<i class="fa fa-search"></i>',
            '<input id="itemSearchInput" type="search" placeholder="Search items, categories, or promotions" value="', escapeHtml(state.itemSearch), '">',
          '</div>',
        '</div>',
        renderItemTabs(),
        '<div class="menu-grid">',
          (items.length ? items.map(function(item, index) {
            var category = getCategoryById(item.categoryId);
            var orderedInCategory = sortByDisplayOrder(state.snapshot.menuItems).filter(function(candidate) {
              return Number(candidate.categoryId) === Number(item.categoryId);
            });
            var categoryIndex = orderedInCategory.findIndex(function(candidate) {
              return Number(candidate.id) === Number(item.id);
            });
            return [
              '<article class="item-card">',
                '<div class="item-card-img">',
                  item.imageUrl
                    ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.name) + '">'
                    : '<div class="item-img-placeholder"><i class="fa fa-mug-hot"></i></div>',
                  (item.isFeatured ? '<span class="featured-badge">Featured</span>' : ''),
                '</div>',
                '<div class="item-card-body">',
                  '<div class="item-card-cat">' + escapeHtml(category ? category.name : 'Unassigned') + '</div>',
                  '<div class="item-card-name">' + escapeHtml(item.name) + '</div>',
                  '<div class="item-card-desc">' + escapeHtml(item.description || 'No description yet.') + '</div>',
                  '<div class="item-status-row">',
                    '<span class="meta-pill ' + (item.isAvailable ? 'success' : 'muted') + '">' + (item.isAvailable ? 'Available' : 'Sold out') + '</span>',
                    (item.promotion ? '<span class="meta-pill warm">' + escapeHtml(item.promotion.label || item.promotion.title) + '</span>' : ''),
                  '</div>',
                  '<div class="item-card-price">' + escapeHtml(priceSummary(item, category)) + '</div>',
                  '<div class="item-card-actions">',
                    '<button class="btn-card edit" type="button" data-action="edit" data-entity="item" data-id="' + item.id + '"><i class="fa fa-edit"></i>Edit</button>',
                    '<button class="btn-card del" type="button" data-action="delete" data-entity="item" data-id="' + item.id + '" data-label="' + escapeHtml(item.name) + '"><i class="fa fa-trash"></i>Delete</button>',
                  '</div>',
                  '<div class="item-card-actions secondary-actions">',
                    '<button class="btn-card neutral" type="button" data-action="move-up" data-entity="item" data-id="' + item.id + '"' + (categoryIndex <= 0 ? ' disabled' : '') + '><i class="fa fa-arrow-up"></i>Up</button>',
                    '<button class="btn-card neutral" type="button" data-action="move-down" data-entity="item" data-id="' + item.id + '"' + (categoryIndex === orderedInCategory.length - 1 ? ' disabled' : '') + '><i class="fa fa-arrow-down"></i>Down</button>',
                  '</div>',
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-state"><i class="fa fa-coffee"></i><h4>No matching items</h4><p>Adjust the filters or add a new item to the live menu.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderFeaturedView() {
    var items = sortByDisplayOrder(state.snapshot.featuredItems);

    return [
      '<section class="section-card">',
        '<div class="section-card-header">',
          '<h3>Featured Homepage Items</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="featured"><i class="fa fa-plus"></i><span>Add Featured Item</span></button>',
        '</div>',
        '<div class="menu-grid">',
          (items.length ? items.map(function(item, index) {
            return [
              '<article class="item-card">',
                '<div class="item-card-img">',
                  item.imageUrl
                    ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.headline) + '">'
                    : '<div class="item-img-placeholder"><i class="fa fa-star"></i></div>',
                  (item.isActive ? '<span class="featured-badge">Live</span>' : ''),
                '</div>',
                '<div class="item-card-body">',
                  '<div class="item-card-cat">' + escapeHtml(item.linkedItem ? item.linkedItem.name : 'Standalone item') + '</div>',
                  '<div class="item-card-name">' + escapeHtml(item.headline) + '</div>',
                  '<div class="item-card-desc">' + escapeHtml(item.subtext || 'No supporting copy yet.') + '</div>',
                  '<div class="item-status-row">',
                    '<span class="meta-pill ' + (item.isActive ? 'success' : 'muted') + '">' + (item.isActive ? 'Active' : 'Hidden') + '</span>',
                    (item.promotion ? '<span class="meta-pill warm">' + escapeHtml(item.promotion.label || item.promotion.title) + '</span>' : ''),
                  '</div>',
                  '<div class="item-card-price">' + escapeHtml(item.linkedItem ? item.linkedItem.priceSummary : 'Homepage highlight') + '</div>',
                  '<div class="item-card-actions">',
                    '<button class="btn-card edit" type="button" data-action="edit" data-entity="featured" data-id="' + item.id + '"><i class="fa fa-edit"></i>Edit</button>',
                    '<button class="btn-card del" type="button" data-action="delete" data-entity="featured" data-id="' + item.id + '" data-label="' + escapeHtml(item.headline) + '"><i class="fa fa-trash"></i>Delete</button>',
                  '</div>',
                  '<div class="item-card-actions secondary-actions">',
                    '<button class="btn-card neutral" type="button" data-action="move-up" data-entity="featured" data-id="' + item.id + '"' + (index === 0 ? ' disabled' : '') + '><i class="fa fa-arrow-up"></i>Up</button>',
                    '<button class="btn-card neutral" type="button" data-action="move-down" data-entity="featured" data-id="' + item.id + '"' + (index === items.length - 1 ? ' disabled' : '') + '><i class="fa fa-arrow-down"></i>Down</button>',
                  '</div>',
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-state"><i class="fa fa-star"></i><h4>No featured items yet</h4><p>Add featured entries that surface on the homepage immediately.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderPromotionsView() {
    var promotions = sortByDisplayOrder(state.snapshot.promotions);

    return [
      '<section class="section-card">',
        '<div class="section-card-header">',
          '<h3>Promotions &amp; Discounts</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="promotion"><i class="fa fa-plus"></i><span>Add Promotion</span></button>',
        '</div>',
        '<div class="entity-grid">',
          (promotions.length ? promotions.map(function(promotion, index) {
            var statusText = promotion.isCurrent ? 'Live now' : promotion.isActive ? 'Scheduled' : 'Inactive';
            return [
              '<article class="entity-card">',
                '<div class="entity-card__head">',
                  '<div>',
                    '<div class="entity-eyebrow">', escapeHtml(promotion.discountType), '</div>',
                    '<h4>', escapeHtml(promotion.title), '</h4>',
                  '</div>',
                  '<span class="meta-pill ', promotion.isCurrent ? 'success' : promotion.isActive ? 'warm' : 'muted', '">', escapeHtml(statusText), '</span>',
                '</div>',
                '<p>', escapeHtml(promotion.description || 'No promotion description yet.'), '</p>',
                '<div class="entity-card__meta">',
                  '<span class="meta-pill">', escapeHtml(promotion.label || 'Promotion'), '</span>',
                  '<span class="meta-pill muted">', escapeHtml((promotion.startDate || 'Now') + ' → ' + (promotion.endDate || 'Ongoing')), '</span>',
                '</div>',
                '<div class="entity-card__actions">',
                  '<button class="btn-tbl edit" type="button" data-action="edit" data-entity="promotion" data-id="', promotion.id, '"><i class="fa fa-edit"></i>Edit</button>',
                  '<button class="btn-tbl neutral" type="button" data-action="move-up" data-entity="promotion" data-id="', promotion.id, '" ', (index === 0 ? 'disabled' : ''), '><i class="fa fa-arrow-up"></i>Up</button>',
                  '<button class="btn-tbl neutral" type="button" data-action="move-down" data-entity="promotion" data-id="', promotion.id, '" ', (index === promotions.length - 1 ? 'disabled' : ''), '><i class="fa fa-arrow-down"></i>Down</button>',
                  '<button class="btn-tbl del" type="button" data-action="delete" data-entity="promotion" data-id="', promotion.id, '" data-label="', escapeHtml(promotion.title), '"><i class="fa fa-trash"></i>Delete</button>',
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-state"><i class="fa fa-tags"></i><h4>No promotions yet</h4><p>Create limited-time offers and attach them to menu or featured items.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderCurrentView() {
    syncTopbar();

    var html = '';
    if (state.view === 'categories') html = renderCategoriesView();
    else if (state.view === 'items') html = renderItemsView();
    else if (state.view === 'featured') html = renderFeaturedView();
    else if (state.view === 'promotions') html = renderPromotionsView();
    else html = renderOverviewView();

    refs.viewContainer.innerHTML = html;
    attachViewHandlers();
  }

  function attachViewHandlers() {
    var itemSearchInput = document.getElementById('itemSearchInput');
    if (itemSearchInput) {
      itemSearchInput.addEventListener('input', function() {
        state.itemSearch = this.value;
        renderCurrentView();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-category-filter]'), function(button) {
      button.addEventListener('click', function() {
        state.itemCategoryFilter = this.getAttribute('data-category-filter');
        renderCurrentView();
      });
    });

    Array.prototype.forEach.call(refs.viewContainer.querySelectorAll('[data-action]'), function(button) {
      button.addEventListener('click', handleActionClick);
    });
  }

  function handleActionClick(event) {
    var button = event.currentTarget;
    var action = button.getAttribute('data-action');
    var entity = button.getAttribute('data-entity');
    var id = button.getAttribute('data-id');

    if (action === 'create') {
      openDrawer(entity, 'create');
      return;
    }
    if (action === 'edit') {
      openDrawer(entity, 'edit', Number(id));
      return;
    }
    if (action === 'delete') {
      openDeleteModal(entity, Number(id), button.getAttribute('data-label') || 'this record');
      return;
    }
    if (action === 'move-up' || action === 'move-down') {
      reorderEntity(entity, Number(id), action === 'move-up' ? -1 : 1);
    }
  }

  function renderNavigationCounts() {
    refs.navCategoryCount.textContent = state.snapshot.categories.length;
    refs.navItemCount.textContent = state.snapshot.menuItems.length;
    refs.navFeaturedCount.textContent = state.snapshot.featuredItems.length;
    refs.navPromotionCount.textContent = state.snapshot.promotions.length;
  }

  function setSidebarOpen(isOpen) {
    state.sidebarOpen = Boolean(isOpen);
    refs.sidebar.classList.toggle('open', state.sidebarOpen);
  }

  function resetDrawerImageState() {
    state.drawerUploadData = null;
    state.drawerPreviewUrl = null;
  }

  function imageFieldMarkup(recordImageUrl) {
    var hasImage = Boolean(recordImageUrl);
    return [
      '<div class="form-group">',
        '<label class="form-label" for="drawerImageMode">Image</label>',
        '<select class="form-control" id="drawerImageMode" name="imageMode">',
          hasImage ? '<option value="keep">Keep current image</option>' : '',
          '<option value="url"', hasImage ? '' : ' selected', '>Use image URL</option>',
          '<option value="upload">Upload image</option>',
          '<option value="remove">Remove image</option>',
        '</select>',
        '<p class="form-hint">Use a direct image URL or upload a new image up to 2MB.</p>',
      '</div>',
      '<div class="form-group" id="drawerImageUrlGroup">',
        '<label class="form-label" for="drawerImageUrl">Image URL</label>',
        '<input class="form-control" id="drawerImageUrl" name="imageUrl" type="text" value="' + escapeHtml(recordImageUrl || '') + '" placeholder="https://... or /assets/images/...">',
      '</div>',
      '<div class="form-group field-hidden" id="drawerImageUploadGroup">',
        '<label class="form-label">Image Upload</label>',
        '<label class="img-upload-zone">',
          '<input id="drawerImageUpload" type="file" accept="image/*">',
          '<div class="img-upload-icon"><i class="fa fa-cloud-upload-alt"></i></div>',
          '<p><strong>Choose a file</strong> or drag one here</p>',
        '</label>',
      '</div>',
      '<div class="form-group', hasImage ? '' : ' field-hidden', '" id="drawerImagePreviewGroup">',
        '<label class="form-label">Preview</label>',
        '<div class="img-preview-wrap">',
          '<img id="drawerImagePreview" src="' + escapeHtml(recordImageUrl || '') + '" alt="Preview">',
        '</div>',
      '</div>'
    ].join('');
  }

  function categoryFormMarkup(record) {
    record = record || {};
    var labels = record.priceLabels || [];
    return [
      '<div class="form-group">',
        '<label class="form-label" for="categoryName">Category Name <span>*</span></label>',
        '<input class="form-control" id="categoryName" name="name" type="text" value="' + escapeHtml(record.name || '') + '" required>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="categorySlug">Slug</label>',
        '<input class="form-control" id="categorySlug" name="slug" type="text" value="' + escapeHtml(record.slug || '') + '" placeholder="Optional. Generated automatically if blank.">',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="categoryDescription">Description</label>',
        '<textarea class="form-control" id="categoryDescription" name="description">' + escapeHtml(record.description || '') + '</textarea>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="categoryLayout">Layout</label>',
          '<select class="form-control" id="categoryLayout" name="layout">',
            option('card', 'Card grid', (record.layout || 'card') === 'card'),
            option('table', 'Table', record.layout === 'table'),
            option('list', 'List', record.layout === 'list'),
          '</select>',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="categoryDisplayOrder">Display Order</label>',
          '<input class="form-control" id="categoryDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '">',
        '</div>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="categoryPriceLabelOne">Primary Price Label</label>',
          '<input class="form-control" id="categoryPriceLabelOne" name="priceLabelOne" type="text" value="' + escapeHtml(labels[0] || '') + '" placeholder="M">',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="categoryPriceLabelTwo">Secondary Price Label</label>',
          '<input class="form-control" id="categoryPriceLabelTwo" name="priceLabelTwo" type="text" value="' + escapeHtml(labels[1] || '') + '" placeholder="L">',
        '</div>',
      '</div>',
      toggleMarkup('Allow multi-price items', 'Use multiple prices such as medium and large.', 'allowMultiPrice', record.allowMultiPrice),
      toggleMarkup('Require item images', 'Ideal for visual categories like featured drinks.', 'requireImage', record.requireImage)
    ].join('');
  }

  function itemFormMarkup(record) {
    record = record || {};
    var categoryId = record.categoryId || (state.snapshot.categories[0] ? state.snapshot.categories[0].id : '');
    return [
      '<div class="form-group">',
        '<label class="form-label" for="itemCategory">Category <span>*</span></label>',
        '<select class="form-control" id="itemCategory" name="categoryId">',
          state.snapshot.categories.map(function(category) {
            return option(category.id, category.name, Number(category.id) === Number(categoryId));
          }).join(''),
        '</select>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="itemName">Item Name <span>*</span></label>',
        '<input class="form-control" id="itemName" name="name" type="text" value="' + escapeHtml(record.name || '') + '" required>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="itemDescription">Description</label>',
        '<textarea class="form-control" id="itemDescription" name="description">' + escapeHtml(record.description || '') + '</textarea>',
      '</div>',
      '<div id="itemPriceFields">',
        itemPriceFieldsMarkup(record, categoryId),
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="itemPromotion">Promotion</label>',
        '<select class="form-control" id="itemPromotion" name="promotionId">',
          option('', 'No promotion', !record.promotionId),
          state.snapshot.promotions.map(function(promotion) {
            return option(promotion.id, promotion.title, Number(promotion.id) === Number(record.promotionId));
          }).join(''),
        '</select>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="itemDisplayOrder">Display Order</label>',
          '<input class="form-control" id="itemDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '">',
        '</div>',
      '</div>',
      imageFieldMarkup(record.imageUrl),
      toggleMarkup('Item is available', 'Unavailable items remain in the dashboard but appear sold out on the site.', 'isAvailable', record.isAvailable !== false),
      toggleMarkup('Show as featured menu item', 'Useful for highlighting this item inside the menu experience.', 'isFeatured', record.isFeatured)
    ].join('');
  }

  function featuredFormMarkup(record) {
    record = record || {};
    return [
      '<div class="form-group">',
        '<label class="form-label" for="featuredMenuItem">Linked Menu Item</label>',
        '<select class="form-control" id="featuredMenuItem" name="menuItemId">',
          option('', 'Standalone featured content', !record.menuItemId),
          sortByDisplayOrder(state.snapshot.menuItems).map(function(item) {
            return option(item.id, item.name, Number(item.id) === Number(record.menuItemId));
          }).join(''),
        '</select>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="featuredHeadline">Headline <span>*</span></label>',
        '<input class="form-control" id="featuredHeadline" name="headline" type="text" value="' + escapeHtml(record.headline || '') + '" required>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="featuredSubtext">Subtext</label>',
        '<textarea class="form-control" id="featuredSubtext" name="subtext">' + escapeHtml(record.subtext || '') + '</textarea>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="featuredPromotion">Promotion</label>',
          '<select class="form-control" id="featuredPromotion" name="promotionId">',
            option('', 'No promotion', !record.promotionId),
            state.snapshot.promotions.map(function(promotion) {
              return option(promotion.id, promotion.title, Number(promotion.id) === Number(record.promotionId));
            }).join(''),
          '</select>',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="featuredDisplayOrder">Display Order</label>',
          '<input class="form-control" id="featuredDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '">',
        '</div>',
      '</div>',
      imageFieldMarkup(record.imageUrl),
      toggleMarkup('Featured item is live', 'Inactive featured items stay saved but do not appear on the homepage.', 'isActive', record.isActive !== false)
    ].join('');
  }

  function promotionFormMarkup(record) {
    record = record || {};
    return [
      '<div class="form-group">',
        '<label class="form-label" for="promotionTitle">Promotion Title <span>*</span></label>',
        '<input class="form-control" id="promotionTitle" name="title" type="text" value="' + escapeHtml(record.title || '') + '" required>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="promotionBadgeText">Badge Text</label>',
        '<input class="form-control" id="promotionBadgeText" name="badgeText" type="text" value="' + escapeHtml(record.badgeText || '') + '" placeholder="Example: 10% Off">',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="promotionDescription">Description</label>',
        '<textarea class="form-control" id="promotionDescription" name="description">' + escapeHtml(record.description || '') + '</textarea>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="promotionDiscountType">Discount Type</label>',
          '<select class="form-control" id="promotionDiscountType" name="discountType">',
            option('text', 'Text only', (record.discountType || 'text') === 'text'),
            option('percentage', 'Percentage', record.discountType === 'percentage'),
            option('fixed', 'Fixed amount', record.discountType === 'fixed'),
          '</select>',
        '</div>',
        '<div class="form-group" id="discountValueGroup">',
          '<label class="form-label" for="promotionDiscountValue">Discount Value</label>',
          '<input class="form-control" id="promotionDiscountValue" name="discountValue" type="number" min="0" step="0.01" value="' + escapeHtml(record.discountValue || '') + '">',
        '</div>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="promotionStartDate">Start Date</label>',
          '<input class="form-control" id="promotionStartDate" name="startDate" type="date" value="' + escapeHtml(record.startDate || '') + '">',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="promotionEndDate">End Date</label>',
          '<input class="form-control" id="promotionEndDate" name="endDate" type="date" value="' + escapeHtml(record.endDate || '') + '">',
        '</div>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="promotionDisplayOrder">Display Order</label>',
          '<input class="form-control" id="promotionDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '">',
        '</div>',
      '</div>',
      toggleMarkup('Promotion is active', 'Active promotions can go live immediately or follow the date range.', 'isActive', record.isActive !== false)
    ].join('');
  }

  function toggleMarkup(title, description, name, checked) {
    return [
      '<label class="toggle-wrap">',
        '<span class="toggle-label">',
          '<strong>', escapeHtml(title), '</strong>',
          '<small>', escapeHtml(description), '</small>',
        '</span>',
        '<span class="toggle', checked ? ' on' : '', '" data-toggle-indicator></span>',
        '<input class="sr-only" type="checkbox" name="', escapeHtml(name), '"', checked ? ' checked' : '', '>',
      '</label>'
    ].join('');
  }

  function option(value, label, selected) {
    return '<option value="' + escapeHtml(value) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  }

  function itemPriceFieldsMarkup(record, categoryId) {
    var category = getCategoryById(categoryId);
    var labels = category ? category.priceLabels || [] : [];
    return [
      '<div class="price-row', category && category.allowMultiPrice ? ' field-hidden' : '', '" id="singlePriceRow">',
        '<div class="form-group">',
          '<label class="form-label" for="itemPriceSingle">', escapeHtml(labels[0] || 'Price'), '</label>',
          '<input class="form-control" id="itemPriceSingle" name="priceSingle" type="number" min="0" step="0.01" value="', escapeHtml(record.priceSingle || ''), '">',
        '</div>',
      '</div>',
      '<div class="price-row', category && category.allowMultiPrice ? '' : ' field-hidden', '" id="multiPriceRow">',
        '<div class="form-group">',
          '<label class="form-label" for="itemPriceMedium">', escapeHtml(labels[0] || 'M'), '</label>',
          '<input class="form-control" id="itemPriceMedium" name="priceMedium" type="number" min="0" step="0.01" value="', escapeHtml(record.priceMedium || ''), '">',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="itemPriceLarge">', escapeHtml(labels[1] || 'L'), '</label>',
          '<input class="form-control" id="itemPriceLarge" name="priceLarge" type="number" min="0" step="0.01" value="', escapeHtml(record.priceLarge || ''), '">',
        '</div>',
      '</div>'
    ].join('');
  }

  function getRecord(entity, id) {
    if (entity === 'category') return getCategoryById(id);
    if (entity === 'item') return getMenuItemById(id);
    if (entity === 'featured') return getFeaturedItemById(id);
    if (entity === 'promotion') return getPromotionById(id);
    return null;
  }

  function openDrawer(entity, mode, id) {
    resetDrawerImageState();
    state.drawer = {
      entity: entity,
      mode: mode,
      id: id || null
    };

    var record = id ? getRecord(entity, id) : null;
    refs.drawerTitle.textContent = (mode === 'edit' ? 'Edit ' : 'Add ') + {
      category: 'Category',
      item: 'Menu Item',
      featured: 'Featured Item',
      promotion: 'Promotion'
    }[entity];

    if (entity === 'category') refs.drawerForm.innerHTML = categoryFormMarkup(record);
    if (entity === 'item') refs.drawerForm.innerHTML = itemFormMarkup(record);
    if (entity === 'featured') refs.drawerForm.innerHTML = featuredFormMarkup(record);
    if (entity === 'promotion') refs.drawerForm.innerHTML = promotionFormMarkup(record);

    refs.drawer.classList.add('open');
    refs.drawerOverlay.classList.add('open');
    setupDrawerInteractions(entity, record);
  }

  function closeDrawer() {
    state.drawer = null;
    resetDrawerImageState();
    refs.drawer.classList.remove('open');
    refs.drawerOverlay.classList.remove('open');
    refs.drawerForm.innerHTML = '';
  }

  function setupDrawerInteractions(entity, record) {
    Array.prototype.forEach.call(refs.drawerForm.querySelectorAll('.toggle-wrap'), function(toggleWrap) {
      var checkbox = toggleWrap.querySelector('input[type="checkbox"]');
      var indicator = toggleWrap.querySelector('[data-toggle-indicator]');
      checkbox.addEventListener('change', function() {
        indicator.classList.toggle('on', checkbox.checked);
      });
    });

    var imageMode = document.getElementById('drawerImageMode');
    if (imageMode) {
      imageMode.addEventListener('change', syncImageModeUI);
      var fileInput = document.getElementById('drawerImageUpload');
      if (fileInput) {
        fileInput.addEventListener('change', handleDrawerFileUpload);
      }
      syncImageModeUI();
    }

    if (entity === 'item') {
      var itemCategory = document.getElementById('itemCategory');
      if (itemCategory) {
        itemCategory.addEventListener('change', function() {
          refreshItemPriceFields();
        });
        refreshItemPriceFields();
      }
    }

    if (entity === 'promotion') {
      var discountType = document.getElementById('promotionDiscountType');
      if (discountType) {
        discountType.addEventListener('change', syncDiscountValueVisibility);
        syncDiscountValueVisibility();
      }
    }

    if (record && record.imageUrl) {
      state.drawerPreviewUrl = record.imageUrl;
    }
  }

  function refreshItemPriceFields() {
    var categoryId = document.getElementById('itemCategory').value;
    var category = getCategoryById(categoryId);
    var singleRow = document.getElementById('singlePriceRow');
    var multiRow = document.getElementById('multiPriceRow');
    if (!category || !singleRow || !multiRow) return;

    var singleLabel = singleRow.querySelector('label');
    var mediumLabel = multiRow.querySelectorAll('label')[0];
    var largeLabel = multiRow.querySelectorAll('label')[1];

    singleLabel.textContent = (category.priceLabels && category.priceLabels[0]) || 'Price';
    mediumLabel.textContent = (category.priceLabels && category.priceLabels[0]) || 'M';
    largeLabel.textContent = (category.priceLabels && category.priceLabels[1]) || 'L';

    singleRow.classList.toggle('field-hidden', category.allowMultiPrice);
    multiRow.classList.toggle('field-hidden', !category.allowMultiPrice);
  }

  function syncDiscountValueVisibility() {
    var discountType = document.getElementById('promotionDiscountType');
    var group = document.getElementById('discountValueGroup');
    if (!discountType || !group) return;
    group.classList.toggle('field-hidden', discountType.value === 'text');
  }

  function syncImageModeUI() {
    var mode = document.getElementById('drawerImageMode');
    var urlGroup = document.getElementById('drawerImageUrlGroup');
    var uploadGroup = document.getElementById('drawerImageUploadGroup');
    var previewGroup = document.getElementById('drawerImagePreviewGroup');
    var preview = document.getElementById('drawerImagePreview');
    var currentMode = mode ? mode.value : 'keep';

    if (urlGroup) urlGroup.classList.toggle('field-hidden', currentMode !== 'url');
    if (uploadGroup) uploadGroup.classList.toggle('field-hidden', currentMode !== 'upload');

    if (previewGroup) {
      var hasPreview = Boolean(state.drawerPreviewUrl);
      previewGroup.classList.toggle('field-hidden', !(hasPreview && currentMode !== 'remove'));
      if (preview && hasPreview) preview.src = state.drawerPreviewUrl;
    }
  }

  function handleDrawerFileUpload(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function() {
      state.drawerUploadData = reader.result;
      state.drawerPreviewUrl = reader.result;
      syncImageModeUI();
    };
    reader.readAsDataURL(file);
  }

  function collectFormData(form) {
    var values = {};
    Array.prototype.forEach.call(form.elements, function(field) {
      if (!field.name) return;
      if (field.type === 'checkbox') {
        values[field.name] = field.checked;
      } else {
        values[field.name] = field.value;
      }
    });
    return values;
  }

  function buildPayload(entity, mode) {
    var values = collectFormData(refs.drawerForm);
    var payload = {};

    if (mode === 'edit' && state.drawer.id) {
      payload.id = state.drawer.id;
    }

    if (entity === 'category') {
      payload.name = values.name;
      payload.slug = values.slug;
      payload.description = values.description;
      payload.layout = values.layout;
      payload.displayOrder = values.displayOrder;
      payload.priceLabels = [values.priceLabelOne, values.priceLabelTwo].filter(Boolean);
      payload.allowMultiPrice = values.allowMultiPrice;
      payload.requireImage = values.requireImage;
      return payload;
    }

    if (entity === 'item') {
      payload.categoryId = values.categoryId;
      payload.name = values.name;
      payload.description = values.description;
      payload.priceSingle = values.priceSingle;
      payload.priceMedium = values.priceMedium;
      payload.priceLarge = values.priceLarge;
      payload.promotionId = values.promotionId;
      payload.displayOrder = values.displayOrder;
      payload.isAvailable = values.isAvailable;
      payload.isFeatured = values.isFeatured;
      payload.imageMode = values.imageMode;
      if (values.imageMode === 'url') payload.imageUrl = values.imageUrl;
      if (values.imageMode === 'upload') payload.imageUpload = state.drawerUploadData;
      return payload;
    }

    if (entity === 'featured') {
      payload.menuItemId = values.menuItemId;
      payload.headline = values.headline;
      payload.subtext = values.subtext;
      payload.promotionId = values.promotionId;
      payload.displayOrder = values.displayOrder;
      payload.isActive = values.isActive;
      payload.imageMode = values.imageMode;
      if (values.imageMode === 'url') payload.imageUrl = values.imageUrl;
      if (values.imageMode === 'upload') payload.imageUpload = state.drawerUploadData;
      return payload;
    }

    if (entity === 'promotion') {
      payload.title = values.title;
      payload.badgeText = values.badgeText;
      payload.description = values.description;
      payload.discountType = values.discountType;
      payload.discountValue = values.discountValue;
      payload.startDate = values.startDate;
      payload.endDate = values.endDate;
      payload.displayOrder = values.displayOrder;
      payload.isActive = values.isActive;
      return payload;
    }

    return payload;
  }

  function endpointForEntity(entity) {
    return {
      category: '/api/admin/categories',
      item: '/api/admin/menu-items',
      featured: '/api/admin/featured-items',
      promotion: '/api/admin/promotions'
    }[entity];
  }

  function openDeleteModal(entity, id, label) {
    state.pendingDelete = { entity: entity, id: id, label: label };
    refs.modalTitle.textContent = 'Delete ' + label + '?';
    refs.modalBody.textContent = 'This change is permanent and will update the live website.';
    refs.modalOverlay.classList.add('open');
  }

  function closeDeleteModal() {
    state.pendingDelete = null;
    refs.modalOverlay.classList.remove('open');
  }

  function reorderEntity(entity, id, delta) {
    var endpoint = endpointForEntity(entity);
    var ordered;

    if (entity === 'category') {
      ordered = sortByDisplayOrder(state.snapshot.categories);
    } else if (entity === 'item') {
      var item = getMenuItemById(id);
      ordered = sortByDisplayOrder(state.snapshot.menuItems).filter(function(candidate) {
        return item && Number(candidate.categoryId) === Number(item.categoryId);
      });
    } else if (entity === 'featured') {
      ordered = sortByDisplayOrder(state.snapshot.featuredItems);
    } else {
      ordered = sortByDisplayOrder(state.snapshot.promotions);
    }

    var index = ordered.findIndex(function(record) {
      return Number(record.id) === Number(id);
    });
    var targetIndex = index + delta;
    if (index === -1 || targetIndex < 0 || targetIndex >= ordered.length) return;

    var swapped = ordered.slice();
    var temp = swapped[index];
    swapped[index] = swapped[targetIndex];
    swapped[targetIndex] = temp;

    apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify({
        orderedIds: swapped.map(function(record) {
          return record.id;
        })
      })
    }).then(function() {
      showToast('success', 'Order updated', 'The live display order has been updated.');
      return loadSnapshot();
    }).catch(function(error) {
      showToast('error', 'Update failed', error.message);
    });
  }

  function loadSnapshot() {
    return apiRequest('/api/admin/content', { cache: 'no-cache' }).then(function(snapshot) {
      state.snapshot = snapshot;
      if (state.itemCategoryFilter !== 'all' && !getCategoryById(state.itemCategoryFilter)) {
        state.itemCategoryFilter = 'all';
      }
      refs.sidebarStatusText.textContent = 'Signed in as ' + (state.auth.username || state.auth.requiredUsername) + '. Changes save directly to the live site.';
      renderNavigationCounts();
      renderStats();
      renderCurrentView();
    });
  }

  function fetchSession() {
    return apiRequest('/api/admin/auth', { cache: 'no-cache' }).then(function(auth) {
      state.auth = auth;
      refs.loginUsername.value = auth.requiredUsername || 'admin';
      if (!auth.configured) {
        refs.loginMessage.textContent = 'Configure ADMIN_USERNAME and ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in Netlify before client login is available.';
        refs.loginForm.querySelector('button').disabled = true;
      } else {
        refs.loginMessage.textContent = 'Sign in to manage the live menu, featured items, and promotions.';
        refs.loginForm.querySelector('button').disabled = false;
      }

      if (auth.authenticated) {
        state.auth.authenticated = true;
        state.auth.username = auth.username || auth.requiredUsername;
        showApp();
        return loadSnapshot();
      }

      showLogin();
      return null;
    });
  }

  refs.loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    refs.loginError.classList.remove('show');
    refs.loginError.textContent = '';
    setLoading(refs.loginForm.querySelector('button'), true);

    apiRequest('/api/admin/auth', {
      method: 'POST',
      body: JSON.stringify({
        username: refs.loginUsername.value,
        password: refs.loginPassword.value
      })
    }).then(function(result) {
      state.auth.authenticated = true;
      state.auth.username = result.username;
      refs.loginPassword.value = '';
      showApp();
      showToast('success', 'Signed in', 'You can now manage live website content.');
      return loadSnapshot();
    }).catch(function(error) {
      refs.loginError.textContent = error.message;
      refs.loginError.classList.add('show');
    }).finally(function() {
      setLoading(refs.loginForm.querySelector('button'), false);
    });
  });

  refs.logoutBtn.addEventListener('click', function() {
    apiRequest('/api/admin/auth', { method: 'DELETE' })
      .then(function() {
        showToast('info', 'Signed out', 'The admin session has been cleared.');
        showLogin();
      })
      .catch(function(error) {
        showToast('error', 'Sign out failed', error.message);
      });
  });

  refs.refreshBtn.addEventListener('click', function() {
    setLoading(refs.refreshBtn, true);
    loadSnapshot()
      .then(function() {
        showToast('success', 'Refreshed', 'Dashboard data is up to date.');
      })
      .catch(function(error) {
        showToast('error', 'Refresh failed', error.message);
      })
      .finally(function() {
        setLoading(refs.refreshBtn, false);
      });
  });

  refs.createBtn.addEventListener('click', function() {
    openDrawer(this.dataset.entity || currentMeta().createEntity, 'create');
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function(link) {
    link.addEventListener('click', function(event) {
      event.preventDefault();
      state.view = this.getAttribute('data-view');
      setSidebarOpen(false);
      renderCurrentView();
    });
  });

  refs.drawerCancelBtn.addEventListener('click', closeDrawer);
  refs.drawerCloseBtn.addEventListener('click', closeDrawer);
  refs.drawerOverlay.addEventListener('click', closeDrawer);

  refs.drawerForm.addEventListener('submit', function(event) {
    event.preventDefault();
    if (!state.drawer) return;

    var entity = state.drawer.entity;
    var mode = state.drawer.mode;
    var endpoint = endpointForEntity(entity);
    var method = mode === 'edit' ? 'PUT' : 'POST';

    if ((entity === 'item' || entity === 'featured') && document.getElementById('drawerImageMode') && document.getElementById('drawerImageMode').value === 'upload' && !state.drawerUploadData) {
      showToast('error', 'Image required', 'Choose an image file before saving.');
      return;
    }

    setLoading(refs.drawerSubmitBtn, true);

    apiRequest(endpoint, {
      method: method,
      body: JSON.stringify(buildPayload(entity, mode))
    }).then(function() {
      closeDrawer();
      showToast('success', 'Saved', 'The live content has been updated.');
      return loadSnapshot();
    }).catch(function(error) {
      showToast('error', 'Save failed', error.message);
    }).finally(function() {
      setLoading(refs.drawerSubmitBtn, false);
    });
  });

  refs.modalCancelBtn.addEventListener('click', closeDeleteModal);
  refs.modalOverlay.addEventListener('click', function(event) {
    if (event.target === refs.modalOverlay) closeDeleteModal();
  });
  refs.modalConfirmBtn.addEventListener('click', function() {
    if (!state.pendingDelete) return;
    setLoading(refs.modalConfirmBtn, true);

    apiRequest(endpointForEntity(state.pendingDelete.entity), {
      method: 'DELETE',
      body: JSON.stringify({ id: state.pendingDelete.id })
    }).then(function() {
      closeDeleteModal();
      showToast('success', 'Deleted', 'The live content has been updated.');
      return loadSnapshot();
    }).catch(function(error) {
      showToast('error', 'Delete failed', error.message);
    }).finally(function() {
      setLoading(refs.modalConfirmBtn, false);
    });
  });

  refs.mobileNavToggle.addEventListener('click', function() {
    setSidebarOpen(!state.sidebarOpen);
  });

  fetchSession().catch(function(error) {
    console.error(error);
    refs.loginError.textContent = error.message || 'Unable to load admin session.';
    refs.loginError.classList.add('show');
  });
})();
