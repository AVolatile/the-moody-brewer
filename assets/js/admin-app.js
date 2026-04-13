(function() {
  'use strict';

  var APP_BOOT_MIN_DURATION = 1500;
  var APP_BOOT_REFRESH_DELAY = 420;
  var LOADING_SCREEN_HIDE_DELAY = 320;
  var AdminValidation = window.AdminValidation || null;

  var state = {
    auth: {
      configured: true,
      authenticated: false,
      diagnostics: null
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
    drawerUploadFile: null,
    drawerUploadPending: false,
    drawerPreviewUrl: null,
    drawerValidationActive: false,
    pendingDelete: null,
    sidebarOpen: false,
    loadingHideTimer: null
  };

  var refs = {
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginUsernameError: document.getElementById('loginUsernameError'),
    loginPasswordError: document.getElementById('loginPasswordError'),
    loginDiagnostics: document.getElementById('loginDiagnostics'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    loginError: document.getElementById('loginError'),
    loginMessage: document.getElementById('loginMessage'),
    loadingScreen: document.getElementById('loadingScreen'),
    loadingTitle: document.getElementById('loadingTitle'),
    loadingDetail: document.getElementById('loadingDetail'),
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

  refs.loadingSteps = document.querySelectorAll('[data-loading-step]');

  var viewMeta = {
    overview: { title: 'Overview', createLabel: 'Add Menu Item', createEntity: 'item' },
    categories: { title: 'Menu Sections', createLabel: 'Add Section', createEntity: 'category' },
    items: { title: 'Menu Items', createLabel: 'Add Menu Item', createEntity: 'item' },
    featured: { title: 'Homepage Highlights', createLabel: 'Add Highlight', createEntity: 'featured' },
    promotions: { title: 'Special Offers', createLabel: 'Add Offer', createEntity: 'promotion' }
  };

  var IMAGE_PLACEHOLDERS = {
    drink: {
      key: 'drink',
      token: 'placeholder:drink',
      icon: 'fa-mug-hot',
      label: 'Coffee cup',
      hint: 'Use the drink placeholder.'
    },
    food: {
      key: 'food',
      token: 'placeholder:food',
      icon: 'fa-bread-slice',
      label: 'Food item',
      hint: 'Use the food placeholder.'
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
    if (value === null || value === undefined || value === '') return '—';
    var number = Number(value);
    if (Number.isNaN(number)) return '—';
    return '$' + number.toFixed(2);
  }

  function getImagePlaceholderConfig(value) {
    var normalized = String(value == null ? '' : value).trim().toLowerCase();

    if (normalized === IMAGE_PLACEHOLDERS.drink.token || normalized === IMAGE_PLACEHOLDERS.drink.key) {
      return IMAGE_PLACEHOLDERS.drink;
    }
    if (normalized === IMAGE_PLACEHOLDERS.food.token || normalized === IMAGE_PLACEHOLDERS.food.key) {
      return IMAGE_PLACEHOLDERS.food;
    }

    return null;
  }

  function buildImagePlaceholderToken(value) {
    var placeholder = getImagePlaceholderConfig(value);
    return placeholder ? placeholder.token : '';
  }

  function suggestImagePlaceholderKey(category) {
    var categoryText = [
      category && category.name ? category.name : '',
      category && category.description ? category.description : ''
    ].join(' ').toLowerCase();

    if (/(sandwich|panini|toast|bread|bite|pastr|croissant|bagel|dessert|snack|food|wrap|salad|cookie|muffin)/.test(categoryText)) {
      return IMAGE_PLACEHOLDERS.food.key;
    }

    return IMAGE_PLACEHOLDERS.drink.key;
  }

  function buildPlaceholderChoiceMarkup(selectedKey) {
    return Object.keys(IMAGE_PLACEHOLDERS).map(function(key) {
      var placeholder = IMAGE_PLACEHOLDERS[key];
      return [
        '<label class="placeholder-choice">',
          '<input type="radio" name="imagePlaceholder" value="', escapeHtml(placeholder.key), '"',
            placeholder.key === selectedKey ? ' checked' : '',
          '>',
          '<span class="placeholder-choice__card">',
            '<span class="placeholder-choice__icon item-img-placeholder item-img-placeholder--', escapeHtml(placeholder.key), '"><i class="fa ', escapeHtml(placeholder.icon), '"></i></span>',
            '<span class="placeholder-choice__copy">',
              '<strong>', escapeHtml(placeholder.label), '</strong>',
              '<small>', escapeHtml(placeholder.hint), '</small>',
            '</span>',
          '</span>',
        '</label>'
      ].join('');
    }).join('');
  }

  function buildAdminImageMarkup(imageUrl, altText, fallbackIcon) {
    var placeholder = getImagePlaceholderConfig(imageUrl);

    if (placeholder) {
      return '<div class="item-img-placeholder item-img-placeholder--' + escapeHtml(placeholder.key) + '"><i class="fa ' + escapeHtml(placeholder.icon) + '"></i></div>';
    }
    if (imageUrl) {
      return '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(altText) + '">';
    }
    return '<div class="item-img-placeholder"><i class="fa ' + escapeHtml(fallbackIcon || 'fa-image') + '"></i></div>';
  }

  function delay(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function setLoading(button, isLoading) {
    if (!button) return;
    button.classList.toggle('loading', Boolean(isLoading));
    button.disabled = Boolean(isLoading);
  }

  function clearLoadingScreenTimer() {
    if (state.loadingHideTimer) {
      clearTimeout(state.loadingHideTimer);
      state.loadingHideTimer = null;
    }
  }

  function setLoadingStep(step) {
    Array.prototype.forEach.call(refs.loadingSteps, function(node) {
      var index = Number(node.getAttribute('data-loading-step') || 0);
      node.classList.toggle('active', index === step);
      node.classList.toggle('complete', index < step);
    });
  }

  function updateLoadingScreen(title, detail, step) {
    refs.loadingTitle.textContent = title;
    refs.loadingDetail.textContent = detail;
    setLoadingStep(step);
  }

  function showLoadingScreen(title, detail, step) {
    clearLoadingScreenTimer();
    updateLoadingScreen(title, detail, step);
    refs.loadingScreen.hidden = false;
    document.body.classList.add('loading-screen-open');
    requestAnimationFrame(function() {
      refs.loadingScreen.classList.add('open');
    });
  }

  function hideLoadingScreen(immediate) {
    clearLoadingScreenTimer();
    document.body.classList.remove('loading-screen-open');
    refs.loadingScreen.classList.remove('open');

    if (immediate) {
      refs.loadingScreen.hidden = true;
      return;
    }

    state.loadingHideTimer = setTimeout(function() {
      refs.loadingScreen.hidden = true;
      state.loadingHideTimer = null;
    }, LOADING_SCREEN_HIDE_DELAY);
  }

  function bootstrapWorkspace(options) {
    var settings = options || {};
    var startedAt = Date.now();

    showLoadingScreen(
      settings.restoringSession ? 'Restoring your workspace' : 'Opening your workspace',
      settings.restoringSession
        ? 'Loading the latest website content for this session.'
        : 'Signing you in and syncing the latest website content.',
      1
    );

    return delay(180)
      .then(function() {
        updateLoadingScreen(
          'Loading website content',
          'Pulling in the latest menu sections, items, homepage highlights, and special offers.',
          2
        );
        return loadSnapshot();
      })
      .then(function() {
        updateLoadingScreen(
          'Finalizing your workspace',
          'Giving everything a final sync before the page opens.',
          3
        );
        return delay(APP_BOOT_REFRESH_DELAY).then(function() {
          return loadSnapshot();
        });
      })
      .then(function() {
        var remaining = APP_BOOT_MIN_DURATION - (Date.now() - startedAt);
        return remaining > 0 ? delay(remaining) : null;
      });
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

  function buildRequestError(message, status, body) {
    var error = new Error(message);
    error.status = status;
    error.details = body && body.details ? body.details : null;
    error.body = body || null;
    return error;
  }

  function setLoginFieldState(input, errorNode, message) {
    var hasMessage = Boolean(message);
    input.classList.toggle('is-invalid', hasMessage);
    input.setAttribute('aria-invalid', hasMessage ? 'true' : 'false');
    errorNode.textContent = hasMessage ? message : '';
    errorNode.classList.toggle('show', hasMessage);
  }

  function clearLoginFieldErrors() {
    setLoginFieldState(refs.loginUsername, refs.loginUsernameError, '');
    setLoginFieldState(refs.loginPassword, refs.loginPasswordError, '');
  }

  function applyLoginFieldErrors(fields) {
    fields = fields || {};
    setLoginFieldState(refs.loginUsername, refs.loginUsernameError, fields.username || '');
    setLoginFieldState(refs.loginPassword, refs.loginPasswordError, fields.password || '');
    return Boolean(fields.username || fields.password);
  }

  function clearLoginError() {
    refs.loginError.textContent = '';
    refs.loginError.classList.remove('show');
  }

  function showLoginError(message) {
    refs.loginError.textContent = message || '';
    refs.loginError.classList.toggle('show', Boolean(message));
  }

  function loginDiagnosticMarkup(tone, title, items) {
    if (!items || !items.length) return '';

    return [
      '<section class="login-diagnostic ', escapeHtml(tone), '">',
        '<strong>', escapeHtml(title), '</strong>',
        '<ul>',
          items.map(function(item) {
            return '<li>' + escapeHtml(item) + '</li>';
          }).join(''),
        '</ul>',
      '</section>'
    ].join('');
  }

  function renderLoginDiagnostics(diagnostics) {
    var sections = [];

    if (diagnostics && diagnostics.auth) {
      if (diagnostics.auth.missing && diagnostics.auth.missing.length) {
        sections.push(loginDiagnosticMarkup('error', 'Sign-In Setup Needed', [
          'A sign-in setting still needs to be completed before this page can be used.'
        ]));
      }
      if (diagnostics.auth.warnings && diagnostics.auth.warnings.length) {
        sections.push(loginDiagnosticMarkup('warn', 'Additional Setup Needed', [
          'One of the site settings still needs attention.'
        ]));
      }
    }

    if (diagnostics && diagnostics.database && !diagnostics.database.configured) {
      sections.push(loginDiagnosticMarkup('error', 'Website Connection Needed', [
        'The website connection still needs to be completed before this page can open.'
      ]));
    }

    refs.loginDiagnostics.innerHTML = sections.join('');
    refs.loginDiagnostics.hidden = !sections.length;
  }

  function syncLoginSetupState() {
    var diagnostics = state.auth && state.auth.diagnostics ? state.auth.diagnostics : null;

    renderLoginDiagnostics(diagnostics);

    if (!state.auth.configured) {
      refs.loginMessage.textContent = 'This page is almost ready. A sign-in setting still needs to be completed.';
      refs.loginSubmitBtn.disabled = true;
      return;
    }

    refs.loginSubmitBtn.disabled = false;

    if (diagnostics && diagnostics.database && !diagnostics.database.configured) {
      refs.loginMessage.textContent = 'Sign-in is ready, but the website connection still needs to be completed.';
      return;
    }

    refs.loginMessage.textContent = 'Sign in to update the menu, homepage highlights, and special offers.';
  }

  function setLoginSubmitting(isLoading) {
    setLoading(refs.loginSubmitBtn, isLoading);
    if (!isLoading && !state.auth.configured) {
      refs.loginSubmitBtn.disabled = true;
    }
  }

  function validateLoginFields() {
    var fieldErrors = {};

    if (!refs.loginUsername.value.trim()) {
      fieldErrors.username = 'Enter the admin username.';
    }
    if (!refs.loginPassword.value.trim()) {
      fieldErrors.password = 'Enter the admin password.';
    }

    return fieldErrors;
  }

  function focusFirstLoginError(fields) {
    if (fields && fields.username) {
      refs.loginUsername.focus();
      return;
    }
    if (fields && fields.password) {
      refs.loginPassword.focus();
    }
  }

  function handleLoginFailure(error, options) {
    var settings = options || {};
    var details = error && error.details ? error.details : null;
    var fieldErrors = details && details.fields ? details.fields : null;
    var message = error && error.message ? error.message : 'Unable to sign in.';

    if (fieldErrors) {
      applyLoginFieldErrors(fieldErrors);
      focusFirstLoginError(fieldErrors);
    }

    if (settings.snapshotFailure) {
      message = (settings.snapshotPrefix || 'We could not finish opening this page. ') + message;
    }

    if (details && details.diagnostics) {
      renderLoginDiagnostics(details.diagnostics);
    } else {
      renderLoginDiagnostics(state.auth && state.auth.diagnostics ? state.auth.diagnostics : null);
    }

    showLoginError(message);
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
          throw buildRequestError('Your session has expired. Sign in again.', response.status, body);
        }
        if (!response.ok) {
          throw buildRequestError(body && body.error ? body.error : 'Request failed.', response.status, body);
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
    hideLoadingScreen(true);
    refs.loginScreen.classList.remove('hidden');
    refs.appShell.hidden = true;
    refs.sessionStatus.className = 'status-pill locked';
    refs.sessionStatusLabel.textContent = 'Signed Out';
  }

  function showApp() {
    clearLoginFieldErrors();
    clearLoginError();
    refs.loginScreen.classList.add('hidden');
    refs.appShell.hidden = false;
    refs.sessionStatus.className = 'status-pill unlocked';
    refs.sessionStatusLabel.textContent = 'Signed In';
    hideLoadingScreen();
  }

  function renderStats() {
    var dashboard = state.snapshot.dashboard;
    refs.statsRow.innerHTML = [
      statCard('fa-layer-group', 'brown', 'Menu Sections', dashboard.categoryCount),
      statCard('fa-coffee', 'blue', 'Menu Items', dashboard.itemCount),
      statCard('fa-check-circle', 'green', 'Available Today', dashboard.availableItemCount),
      statCard('fa-tags', 'purple', 'Current Offers', dashboard.activePromotionCount)
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
          '<div class="section-card-header"><h3>Current Offers</h3></div>',
          '<div class="content-pad">',
            (activePromotions.length ? activePromotions.map(function(promotion) {
              return [
                '<div class="overview-list-item">',
                  '<div>',
                    '<strong>', escapeHtml(promotion.title), '</strong>',
                    '<p>', escapeHtml(promotion.description || 'Showing on the website now.'), '</p>',
                  '</div>',
                  '<span class="meta-pill warm">', escapeHtml(promotion.label || 'Now Showing'), '</span>',
                '</div>'
              ].join('');
            }).join('') : '<div class="empty-state compact"><i class="fa fa-tags"></i><h4>No offers right now</h4><p>Add a special offer whenever you want to highlight something new.</p></div>'),
          '</div>',
        '</section>',
        '<section class="section-card">',
          '<div class="section-card-header"><h3>Homepage Highlights</h3></div>',
          '<div class="content-pad">',
            (featuredItems.length ? featuredItems.map(function(item) {
              return [
                '<div class="overview-list-item">',
                  '<div>',
                    '<strong>', escapeHtml(item.headline), '</strong>',
                    '<p>', escapeHtml(item.linkedItem ? item.linkedItem.name : (item.subtext || 'Homepage highlight')), '</p>',
                  '</div>',
                  '<span class="meta-pill ', item.isActive ? 'success' : 'muted', '">', item.isActive ? 'Visible' : 'Hidden', '</span>',
                '</div>'
              ].join('');
            }).join('') : '<div class="empty-state compact"><i class="fa fa-star"></i><h4>No highlights yet</h4><p>Add a homepage feature whenever you want to spotlight a favorite.</p></div>'),
          '</div>',
        '</section>',
      '</div>',
      '<section class="section-card mt-entity">',
        '<div class="section-card-header"><h3>Menu Sections</h3></div>',
        '<div class="entity-grid compact-grid">',
          (categories.length ? categories.map(function(category) {
            var itemCount = state.snapshot.menuItems.filter(function(item) {
              return Number(item.categoryId) === Number(category.id);
            }).length;
            return [
              '<article class="entity-card">',
                '<div class="entity-card__head">',
                  '<div>',
                    '<div class="entity-eyebrow">Menu section</div>',
                    '<h4>', escapeHtml(category.name), '</h4>',
                  '</div>',
                  '<span class="meta-pill">', escapeHtml(String(itemCount)), ' items</span>',
                '</div>',
                '<p>', escapeHtml(category.description || 'A clean section ready for your menu items.'), '</p>',
                '<div class="entity-card__meta">',
                  '<span class="meta-pill ', category.allowMultiPrice ? 'info' : 'muted', '">', category.allowMultiPrice ? 'Multiple sizes' : 'Single price', '</span>',
                  '<span class="meta-pill ', category.requireImage ? 'warm' : 'muted', '">', category.requireImage ? 'Photo needed' : 'Photo optional', '</span>',
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-state compact"><i class="fa fa-layer-group"></i><h4>No menu sections yet</h4><p>Add a section to begin organizing the menu.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderCategoriesView() {
    var categories = sortByDisplayOrder(state.snapshot.categories);

    return [
      '<section class="section-card">',
        '<div class="section-card-header">',
          '<h3>Menu Sections</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="category"><i class="fa fa-plus"></i><span>Add Section</span></button>',
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
                    '<div class="entity-eyebrow">Menu section</div>',
                    '<h4>', escapeHtml(category.name), '</h4>',
                  '</div>',
                  '<span class="meta-pill">', escapeHtml(String(itemCount)), ' items</span>',
                '</div>',
                '<p>', escapeHtml(category.description || 'Add a short description if you would like one shown here.'), '</p>',
                '<div class="entity-card__meta">',
                  '<span class="meta-pill">', escapeHtml(category.layout === 'card' ? 'Feature cards' : category.layout === 'table' ? 'Compact list' : 'Simple list'), '</span>',
                  '<span class="meta-pill ', category.allowMultiPrice ? 'info' : 'muted', '">', category.allowMultiPrice ? 'Multiple sizes' : 'Single price', '</span>',
                  '<span class="meta-pill ', category.requireImage ? 'warm' : 'muted', '">', category.requireImage ? 'Photo needed' : 'Photo optional', '</span>',
                '</div>',
                '<div class="entity-card__actions">',
                  '<button class="btn-tbl edit" type="button" data-action="edit" data-entity="category" data-id="', category.id, '"><i class="fa fa-edit"></i>Edit</button>',
                  '<button class="btn-tbl neutral" type="button" data-action="move-up" data-entity="category" data-id="', category.id, '" ', (index === 0 ? 'disabled' : ''), '><i class="fa fa-arrow-up"></i>Up</button>',
                  '<button class="btn-tbl neutral" type="button" data-action="move-down" data-entity="category" data-id="', category.id, '" ', (index === categories.length - 1 ? 'disabled' : ''), '><i class="fa fa-arrow-down"></i>Down</button>',
                  '<button class="btn-tbl del" type="button" data-action="delete" data-entity="category" data-id="', category.id, '" data-label="', escapeHtml(category.name), '"><i class="fa fa-trash"></i>Delete</button>',
                '</div>',
              '</article>'
            ].join('');
          }).join('') : '<div class="empty-state"><i class="fa fa-layer-group"></i><h4>No menu sections yet</h4><p>Add your first section to start shaping the menu.</p></div>'),
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
          '<h3>Menu Items</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="item"><i class="fa fa-plus"></i><span>Add Menu Item</span></button>',
        '</div>',
        '<div class="toolbar">',
          '<div class="search-wrap">',
            '<i class="fa fa-search"></i>',
            '<input id="itemSearchInput" type="search" placeholder="Search by item, section, or offer" value="', escapeHtml(state.itemSearch), '">',
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
                  buildAdminImageMarkup(item.imageUrl, item.name, 'fa-mug-hot'),
                  (item.isFeatured ? '<span class="featured-badge">Featured</span>' : ''),
                '</div>',
                '<div class="item-card-body">',
                  '<div class="item-card-cat">' + escapeHtml(category ? category.name : 'No section') + '</div>',
                  '<div class="item-card-name">' + escapeHtml(item.name) + '</div>',
                  '<div class="item-card-desc">' + escapeHtml(item.description || 'A description can be added here anytime.') + '</div>',
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
          }).join('') : '<div class="empty-state"><i class="fa fa-coffee"></i><h4>No items match this view</h4><p>Try a different search or add a menu item when you are ready.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderFeaturedView() {
    var items = sortByDisplayOrder(state.snapshot.featuredItems);

    return [
      '<section class="section-card">',
        '<div class="section-card-header">',
          '<h3>Homepage Highlights</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="featured"><i class="fa fa-plus"></i><span>Add Highlight</span></button>',
        '</div>',
        '<div class="menu-grid">',
          (items.length ? items.map(function(item, index) {
            return [
              '<article class="item-card">',
                '<div class="item-card-img">',
                  buildAdminImageMarkup(item.imageUrl, item.headline, 'fa-star'),
                  (item.isActive ? '<span class="featured-badge">Live</span>' : ''),
                '</div>',
                '<div class="item-card-body">',
                  '<div class="item-card-cat">' + escapeHtml(item.linkedItem ? item.linkedItem.name : 'Homepage feature') + '</div>',
                  '<div class="item-card-name">' + escapeHtml(item.headline) + '</div>',
                  '<div class="item-card-desc">' + escapeHtml(item.subtext || 'Add a short supporting line whenever you would like one.') + '</div>',
                  '<div class="item-status-row">',
                    '<span class="meta-pill ' + (item.isActive ? 'success' : 'muted') + '">' + (item.isActive ? 'Visible' : 'Hidden') + '</span>',
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
          }).join('') : '<div class="empty-state"><i class="fa fa-star"></i><h4>No homepage highlights yet</h4><p>Add a highlight whenever you want to spotlight something special.</p></div>'),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderPromotionsView() {
    var promotions = sortByDisplayOrder(state.snapshot.promotions);

    return [
      '<section class="section-card">',
        '<div class="section-card-header">',
          '<h3>Special Offers</h3>',
          '<button class="btn-topbar primary small-btn" type="button" data-action="create" data-entity="promotion"><i class="fa fa-plus"></i><span>Add Offer</span></button>',
        '</div>',
        '<div class="entity-grid">',
          (promotions.length ? promotions.map(function(promotion, index) {
            var statusText = promotion.isCurrent ? 'Showing now' : promotion.isActive ? 'Scheduled' : 'Hidden';
            return [
              '<article class="entity-card">',
                '<div class="entity-card__head">',
                  '<div>',
                    '<div class="entity-eyebrow">', escapeHtml(promotion.discountType), '</div>',
                    '<h4>', escapeHtml(promotion.title), '</h4>',
                  '</div>',
                  '<span class="meta-pill ', promotion.isCurrent ? 'success' : promotion.isActive ? 'warm' : 'muted', '">', escapeHtml(statusText), '</span>',
                '</div>',
                '<p>', escapeHtml(promotion.description || 'Add a short note here whenever you would like one shown.'), '</p>',
                '<div class="entity-card__meta">',
                  '<span class="meta-pill">', escapeHtml(promotion.label || 'Offer'), '</span>',
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
          }).join('') : '<div class="empty-state"><i class="fa fa-tags"></i><h4>No offers yet</h4><p>Add a special offer for seasonal favorites, bundles, or limited-time features.</p></div>'),
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
      openDeleteModal(entity, Number(id), button.getAttribute('data-label') || 'this item');
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
    state.drawerUploadFile = null;
    state.drawerUploadPending = false;
    state.drawerPreviewUrl = null;
  }

  function buildItemCategoryHint(category) {
    if (!category) {
      return 'Choose a menu section to set the price and photo rules for this item.';
    }

    return [
      category.allowMultiPrice ? 'This section uses more than one price.' : 'This section uses one price.',
      category.requireImage ? 'A photo is required.' : 'A photo is optional.'
    ].join(' ');
  }

  function buildItemImageModeOptions(category, currentImageUrl, selectedMode) {
    var currentPlaceholder = getImagePlaceholderConfig(currentImageUrl);
    var hasImage = Boolean(currentImageUrl);
    var hasCurrentPhoto = hasImage && !currentPlaceholder;
    var mode = selectedMode || (currentPlaceholder ? 'placeholder' : hasCurrentPhoto ? 'keep' : (category && category.requireImage ? 'upload' : 'remove'));
    var options = [];

    if (hasCurrentPhoto) {
      options.push(option('keep', 'Keep current photo', mode === 'keep'));
    }

    options.push(option('upload', hasImage ? 'Replace with upload' : 'Upload photo', mode === 'upload'));
    options.push(option('url', hasImage ? 'Replace with image link' : 'Use image link', mode === 'url'));
    options.push(option('placeholder', hasImage ? 'Use placeholder image' : 'Add placeholder image', mode === 'placeholder'));

    if (hasImage || !(category && category.requireImage)) {
      options.push(option('remove', hasImage ? 'Remove current photo' : 'No photo for now', mode === 'remove'));
    }

    return options.join('');
  }

  function stepHeaderMarkup(options) {
    var settings = options || {};
    var stepLabel = settings.step ? 'Step ' + settings.step : (settings.label || 'Section');

    return [
      '<div class="item-step__header">',
        '<div class="item-step__icon"><i class="fa ', escapeHtml(settings.icon || 'fa-circle'), '"></i></div>',
        '<div class="item-step__copy">',
          '<div class="item-step__label">', escapeHtml(stepLabel), '</div>',
          '<h4 class="item-step__title">', escapeHtml(settings.title || ''), '</h4>',
          (settings.intro ? '<p class="item-step__intro">' + escapeHtml(settings.intro) + '</p>' : ''),
        '</div>',
      '</div>'
    ].join('');
  }

  function itemStepMarkup(options, content) {
    return [
      '<section class="item-step">',
        stepHeaderMarkup(options),
        '<div class="item-step__body">', content || '', '</div>',
      '</section>'
    ].join('');
  }

  function imageFieldMarkup(recordImageUrl, options) {
    var settings = options || {};
    var category = settings.category || null;
    var currentPlaceholder = getImagePlaceholderConfig(recordImageUrl);
    var hasImage = Boolean(recordImageUrl);
    var placeholderKey = settings.placeholderKey || (currentPlaceholder ? currentPlaceholder.key : suggestImagePlaceholderKey(category));
    var previewPlaceholder = getImagePlaceholderConfig(placeholderKey) || IMAGE_PLACEHOLDERS.drink;
    var selectedMode = settings.mode || (currentPlaceholder ? 'placeholder' : (hasImage ? 'keep' : (category && category.requireImage ? 'upload' : 'remove')));
    var hasPreviewImage = hasImage && !currentPlaceholder;
    var showPlaceholderPreview = Boolean(currentPlaceholder) || selectedMode === 'placeholder';
    var imageUrlValue = currentPlaceholder ? '' : (recordImageUrl || '');
    return [
      '<section class="item-step item-step--media">',
        stepHeaderMarkup({
          step: settings.step,
          label: settings.label || 'Image',
          icon: settings.icon || 'fa-image',
          title: settings.title || 'Add a photo',
          intro: settings.intro || 'Choose a photo source, then check the preview.'
        }),
        '<div class="item-step__body">',
          '<div class="item-media">',
            '<div class="item-media__controls">',
              '<div class="form-group">',
                '<label class="form-label" for="drawerImageMode">Photo source</label>',
                '<select class="form-control" id="drawerImageMode" name="imageMode">',
                  buildItemImageModeOptions(category, recordImageUrl, selectedMode),
                '</select>',
                '<p class="form-hint">Upload a file, paste a link, or use a built-in placeholder.</p>',
              '</div>',
              '<div class="form-group', selectedMode === 'url' ? '' : ' field-hidden', '" id="drawerImageUrlGroup">',
                '<label class="form-label" for="drawerImageUrl">Image link <span>*</span></label>',
                '<input class="form-control" id="drawerImageUrl" name="imageUrl" type="text" value="' + escapeHtml(imageUrlValue) + '" placeholder="https://... or /assets/images/...">',
                '<p class="form-hint">Use a direct image URL or a site asset path.</p>',
              '</div>',
              '<div class="form-group', selectedMode === 'upload' ? '' : ' field-hidden', '" id="drawerImageUploadGroup">',
                '<label class="form-label" for="drawerImageUpload">Upload photo <span>*</span></label>',
                '<label class="img-upload-zone">',
                  '<input id="drawerImageUpload" data-validation-field="imageUpload" type="file" accept="image/*">',
                  '<div class="img-upload-icon"><i class="fa fa-cloud-upload-alt"></i></div>',
                  '<p><strong>Choose a file</strong><span> or drag one here</span></p>',
                  '<small>PNG, JPG, or WebP up to 2MB.</small>',
                '</label>',
                '<div class="image-upload-meta" id="drawerImageUploadMeta">No file selected yet.</div>',
              '</div>',
              '<div class="form-group', selectedMode === 'placeholder' ? '' : ' field-hidden', '" id="drawerImagePlaceholderGroup">',
                '<label class="form-label">Placeholder image <span>*</span></label>',
                '<div class="placeholder-choice-list" id="drawerImagePlaceholderList">',
                  buildPlaceholderChoiceMarkup(placeholderKey),
                '</div>',
                '<p class="form-hint">Use a simple icon when you do not have a photo yet.</p>',
              '</div>',
            '</div>',
            '<div class="item-media__preview" id="drawerImagePreviewGroup">',
              '<div class="item-media__preview-label">Preview</div>',
              '<div class="image-preview-frame">',
                '<div class="img-preview-wrap', hasPreviewImage ? '' : ' field-hidden', '" id="drawerImageAssetWrap">',
                  '<img id="drawerImagePreview" src="' + escapeHtml(hasPreviewImage ? recordImageUrl : '') + '" alt="Preview">',
                '</div>',
                '<div class="img-preview-placeholder', showPlaceholderPreview ? '' : ' field-hidden', '" id="drawerImagePlaceholderWrap">',
                  '<div class="item-img-placeholder item-img-placeholder--preview item-img-placeholder--', escapeHtml(previewPlaceholder.key), '" id="drawerImagePlaceholderIconWrap"><i class="fa ', escapeHtml(previewPlaceholder.icon), '" id="drawerImagePlaceholderIcon"></i></div>',
                  '<strong id="drawerImagePlaceholderLabel">', escapeHtml(previewPlaceholder.label), ' placeholder</strong>',
                '</div>',
                '<div class="img-preview-empty', hasPreviewImage || showPlaceholderPreview ? ' field-hidden' : '', '" id="drawerImageEmptyState">',
                  '<i class="fa fa-image"></i>',
                  '<strong>No image selected</strong>',
                  '<p>Add a photo or choose a placeholder to preview it here.</p>',
                '</div>',
              '</div>',
              '<p class="image-preview-caption">The preview updates automatically.</p>',
            '</div>',
          '</div>',
        '</div>',
      '</section>'
    ].join('');
  }

  function categoryFormMarkup(record) {
    record = record || {};
    var labels = record.priceLabels || [];
    return [
      '<div class="form-group">',
        '<label class="form-label" for="categoryName">Section Name <span>*</span></label>',
        '<input class="form-control" id="categoryName" name="name" type="text" value="' + escapeHtml(record.name || '') + '" required>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="categoryDescription">Description</label>',
        '<textarea class="form-control" id="categoryDescription" name="description">' + escapeHtml(record.description || '') + '</textarea>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="categoryLayout">Section Style</label>',
          '<select class="form-control" id="categoryLayout" name="layout">',
            option('card', 'Feature cards', (record.layout || 'card') === 'card'),
            option('table', 'Compact list', record.layout === 'table'),
            option('list', 'Simple list', record.layout === 'list'),
          '</select>',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="categoryDisplayOrder">Order on Page</label>',
          '<input class="form-control" id="categoryDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '">',
        '</div>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="categoryPriceLabelOne">First Price Label</label>',
          '<input class="form-control" id="categoryPriceLabelOne" name="priceLabelOne" type="text" value="' + escapeHtml(labels[0] || '') + '" placeholder="M">',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="categoryPriceLabelTwo">Second Price Label</label>',
          '<input class="form-control" id="categoryPriceLabelTwo" name="priceLabelTwo" type="text" value="' + escapeHtml(labels[1] || '') + '" placeholder="L">',
        '</div>',
      '</div>',
      toggleMarkup('Show multiple sizes', 'Use separate prices such as medium and large.', 'allowMultiPrice', record.allowMultiPrice),
      toggleMarkup('Use photos in this section', 'Helpful for sections where visuals matter most.', 'requireImage', record.requireImage)
    ].join('');
  }

  function itemFormMarkup(record) {
    record = record || {};
    var categoryId = record.categoryId || (state.snapshot.categories[0] ? state.snapshot.categories[0].id : '');
    var category = getCategoryById(categoryId);
    return [
      '<div class="item-flow">',
        itemStepMarkup({
          step: 1,
          icon: 'fa-layer-group',
          title: 'Choose a menu section',
          intro: 'Start by choosing where this item belongs.'
        }, [
          '<div class="form-group">',
            '<label class="form-label" for="itemCategory">Menu section <span>*</span></label>',
            '<select class="form-control" id="itemCategory" name="categoryId">',
              state.snapshot.categories.map(function(menuCategory) {
                return option(menuCategory.id, menuCategory.name, Number(menuCategory.id) === Number(categoryId));
              }).join(''),
            '</select>',
            '<p class="form-hint">This controls the price fields and whether a photo is needed.</p>',
          '</div>',
          '<div class="item-step__hint" id="itemCategoryContext">',
            escapeHtml(buildItemCategoryHint(category)),
          '</div>',
        ].join('')),
        itemStepMarkup({
          step: 2,
          icon: 'fa-pencil-alt',
          title: 'Add the basics',
          intro: 'Use the name and description guests will read on the menu.'
        }, [
          '<div class="form-group">',
            '<label class="form-label" for="itemName">Item Name <span>*</span></label>',
            '<input class="form-control" id="itemName" name="name" type="text" value="' + escapeHtml(record.name || '') + '" placeholder="Example: Cinnamon Honey Latte" required>',
          '</div>',
          '<div class="form-group">',
            '<label class="form-label" for="itemDescription">Description <span>*</span></label>',
            '<textarea class="form-control" id="itemDescription" name="description" placeholder="Write a short guest-facing description.">' + escapeHtml(record.description || '') + '</textarea>',
          '</div>',
        ].join('')),
        itemStepMarkup({
          step: 3,
          icon: 'fa-dollar-sign',
          title: 'Set the price',
          intro: 'Add the selling price. Offer and sort order are optional.'
        }, [
          '<div id="itemPriceFields">',
            itemPriceFieldsMarkup(record, categoryId),
          '</div>',
          '<div class="form-grid form-grid--split item-step__group">',
            '<div class="form-group">',
              '<label class="form-label" for="itemPromotion">Offer</label>',
              '<select class="form-control" id="itemPromotion" name="promotionId">',
                option('', 'No offer', !record.promotionId),
                state.snapshot.promotions.map(function(promotion) {
                  return option(promotion.id, promotion.title, Number(promotion.id) === Number(record.promotionId));
                }).join(''),
              '</select>',
            '</div>',
            '<div class="form-group">',
              '<label class="form-label" for="itemDisplayOrder">Sort order</label>',
              '<input class="form-control" id="itemDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '" placeholder="Auto">',
              '<p class="form-hint">Leave blank to place it automatically.</p>',
            '</div>',
          '</div>',
        ].join('')),
        imageFieldMarkup(record.imageUrl, {
          step: 4,
          icon: 'fa-image',
          title: 'Add a photo',
          intro: 'Use a clear photo that helps guests recognize the item.',
          category: category
        }),
        itemStepMarkup({
          step: 5,
          icon: 'fa-eye',
          title: 'Choose visibility',
          intro: 'Decide whether the item is live now and whether it should stand out.'
        }, [
          '<div class="toggle-list toggle-list--minimal">',
            toggleMarkup('Available today', 'Turn this off when an item is temporarily unavailable.', 'isAvailable', record.isAvailable !== false),
            toggleMarkup('Highlight in the menu', 'Use this to give the item a little extra attention.', 'isFeatured', record.isFeatured),
          '</div>',
        ].join('')),
      '</div>'
    ].join('');
  }

  function featuredFormMarkup(record) {
    record = record || {};
    return [
      '<div class="form-group">',
        '<label class="form-label" for="featuredMenuItem">Linked Menu Item</label>',
        '<select class="form-control" id="featuredMenuItem" name="menuItemId">',
          option('', 'Custom homepage feature', !record.menuItemId),
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
          '<label class="form-label" for="featuredPromotion">Offer</label>',
          '<select class="form-control" id="featuredPromotion" name="promotionId">',
            option('', 'No offer', !record.promotionId),
            state.snapshot.promotions.map(function(promotion) {
              return option(promotion.id, promotion.title, Number(promotion.id) === Number(record.promotionId));
            }).join(''),
          '</select>',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="featuredDisplayOrder">Order on Page</label>',
          '<input class="form-control" id="featuredDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '">',
        '</div>',
      '</div>',
      imageFieldMarkup(record.imageUrl),
      toggleMarkup('Show this on the homepage', 'Turn this off to keep it saved without displaying it.', 'isActive', record.isActive !== false)
    ].join('');
  }

  function promotionFormMarkup(record) {
    record = record || {};
    return [
      '<div class="form-group">',
        '<label class="form-label" for="promotionTitle">Offer Title <span>*</span></label>',
        '<input class="form-control" id="promotionTitle" name="title" type="text" value="' + escapeHtml(record.title || '') + '" required>',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="promotionBadgeText">Offer Label</label>',
        '<input class="form-control" id="promotionBadgeText" name="badgeText" type="text" value="' + escapeHtml(record.badgeText || '') + '" placeholder="Example: 10% Off">',
      '</div>',
      '<div class="form-group">',
        '<label class="form-label" for="promotionDescription">Details</label>',
        '<textarea class="form-control" id="promotionDescription" name="description">' + escapeHtml(record.description || '') + '</textarea>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="promotionDiscountType">Offer Type</label>',
          '<select class="form-control" id="promotionDiscountType" name="discountType">',
            option('text', 'Label only', (record.discountType || 'text') === 'text'),
            option('percentage', 'Percentage', record.discountType === 'percentage'),
            option('fixed', 'Dollar amount', record.discountType === 'fixed'),
          '</select>',
        '</div>',
        '<div class="form-group" id="discountValueGroup">',
          '<label class="form-label" for="promotionDiscountValue">Amount Off</label>',
          '<input class="form-control" id="promotionDiscountValue" name="discountValue" type="number" min="0" step="0.01" value="' + escapeHtml(record.discountValue || '') + '">',
        '</div>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="promotionStartDate">Starts</label>',
          '<input class="form-control" id="promotionStartDate" name="startDate" type="date" value="' + escapeHtml(record.startDate || '') + '">',
        '</div>',
        '<div class="form-group">',
          '<label class="form-label" for="promotionEndDate">Ends</label>',
          '<input class="form-control" id="promotionEndDate" name="endDate" type="date" value="' + escapeHtml(record.endDate || '') + '">',
        '</div>',
      '</div>',
      '<div class="price-row">',
        '<div class="form-group">',
          '<label class="form-label" for="promotionDisplayOrder">Order on Page</label>',
          '<input class="form-control" id="promotionDisplayOrder" name="displayOrder" type="number" min="1" value="' + escapeHtml(record.displayOrder || '') + '">',
        '</div>',
      '</div>',
      toggleMarkup('Show this offer', 'Use the dates above if you want it to appear for a limited time.', 'isActive', record.isActive !== false)
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
    var record = id ? getRecord(entity, id) : null;

    resetDrawerImageState();
    state.drawer = {
      entity: entity,
      mode: mode,
      id: id || null,
      record: record || null
    };
    state.drawerValidationActive = false;

    refs.drawerTitle.textContent = (mode === 'edit' ? 'Edit ' : 'Add ') + {
      category: 'Section',
      item: 'Menu Item',
      featured: 'Homepage Highlight',
      promotion: 'Offer'
    }[entity];

    if (entity === 'category') refs.drawerForm.innerHTML = categoryFormMarkup(record);
    if (entity === 'item') refs.drawerForm.innerHTML = itemFormMarkup(record);
    if (entity === 'featured') refs.drawerForm.innerHTML = featuredFormMarkup(record);
    if (entity === 'promotion') refs.drawerForm.innerHTML = promotionFormMarkup(record);

    refs.drawer.classList.toggle('drawer-wide', entity === 'item');
    refs.drawer.classList.add('open');
    refs.drawerOverlay.classList.add('open');
    setupDrawerInteractions(entity, record);
  }

  function closeDrawer() {
    clearDrawerValidationUI();
    state.drawerValidationActive = false;
    state.drawer = null;
    resetDrawerImageState();
    refs.drawer.classList.remove('open');
    refs.drawerOverlay.classList.remove('open');
    refs.drawer.classList.remove('drawer-wide');
    refs.drawerForm.innerHTML = '';
  }

  function setupDrawerInteractions(entity, record) {
    if (record && record.imageUrl) {
      state.drawerPreviewUrl = record.imageUrl;
    }

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
      var preview = document.getElementById('drawerImagePreview');
      if (fileInput) {
        fileInput.addEventListener('change', handleDrawerFileUpload);
      }
      if (preview) {
        preview.addEventListener('error', function() {
          setDrawerImagePreviewVisibility('empty');
        });
        preview.addEventListener('load', function() {
          setDrawerImagePreviewVisibility('image');
        });
      }
      syncImageModeUI();
    }

    if (entity === 'item') {
      syncItemComposerUI();
    }

    if (entity === 'promotion') {
      var discountType = document.getElementById('promotionDiscountType');
      if (discountType) {
        discountType.addEventListener('change', syncDiscountValueVisibility);
        syncDiscountValueVisibility();
      }
    }
  }

  function refreshItemPriceFields() {
    var categoryField = document.getElementById('itemCategory');
    if (!categoryField) return;

    var categoryId = categoryField.value;
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

  function syncItemImageModeOptions() {
    var modeField = document.getElementById('drawerImageMode');
    var categoryField = document.getElementById('itemCategory');
    var imageUrlField = document.getElementById('drawerImageUrl');
    var category = categoryField ? getCategoryById(categoryField.value) : null;
    var record = getDrawerRecord();
    var currentImageUrl = record && record.imageUrl ? record.imageUrl : '';
    var hasCurrentImage = Boolean(currentImageUrl);
    var optionKey;
    var selectedMode;
    var hasDraftImage;

    if (!modeField) return;

    optionKey = [hasCurrentImage ? '1' : '0', category && category.requireImage ? '1' : '0'].join(':');
    selectedMode = modeField.value || (getImagePlaceholderConfig(currentImageUrl) ? 'placeholder' : (hasCurrentImage ? 'keep' : (category && category.requireImage ? 'upload' : 'remove')));
    hasDraftImage = Boolean(
      state.drawerUploadData ||
      state.drawerUploadFile ||
      (imageUrlField && imageUrlField.value.trim()) ||
      (selectedMode === 'placeholder' && getSelectedImagePlaceholderKey())
    );

    if (!hasCurrentImage && category && category.requireImage && selectedMode === 'remove' && !hasDraftImage) {
      selectedMode = 'upload';
    }

    if (modeField.dataset.optionKey !== optionKey) {
      modeField.innerHTML = buildItemImageModeOptions(category, currentImageUrl, selectedMode);
      modeField.dataset.optionKey = optionKey;
    }

    if (modeField.querySelector('option[value="' + selectedMode + '"]')) {
      modeField.value = selectedMode;
    }
  }

  function syncItemCategoryContext() {
    var categoryField = document.getElementById('itemCategory');
    var context = document.getElementById('itemCategoryContext');
    var category = categoryField ? getCategoryById(categoryField.value) : null;

    if (!context) return;
    context.textContent = buildItemCategoryHint(category);
  }

  function syncItemComposerUI() {
    if (!state.drawer || state.drawer.entity !== 'item') return;

    refreshItemPriceFields();
    syncItemCategoryContext();
    syncItemImageModeOptions();
  }

  function syncDiscountValueVisibility() {
    var discountType = document.getElementById('promotionDiscountType');
    var group = document.getElementById('discountValueGroup');
    if (!discountType || !group) return;
    group.classList.toggle('field-hidden', discountType.value === 'text');
  }

  function getSelectedImagePlaceholderKey() {
    var selected = refs.drawerForm
      ? refs.drawerForm.querySelector('[name="imagePlaceholder"]:checked')
      : null;
    return selected ? selected.value : '';
  }

  function setDrawerPlaceholderPreview(placeholder) {
    var placeholderWrap = document.getElementById('drawerImagePlaceholderWrap');
    var placeholderIconWrap = document.getElementById('drawerImagePlaceholderIconWrap');
    var placeholderIcon = document.getElementById('drawerImagePlaceholderIcon');
    var placeholderLabel = document.getElementById('drawerImagePlaceholderLabel');

    if (!placeholderWrap || !placeholderIconWrap || !placeholderIcon || !placeholderLabel) return;

    placeholderIconWrap.className = 'item-img-placeholder item-img-placeholder--preview item-img-placeholder--' + placeholder.key;
    placeholderIcon.className = 'fa ' + placeholder.icon;
    placeholderLabel.textContent = placeholder.label + ' placeholder';
  }

  function setDrawerImagePreviewVisibility(stateName, placeholder) {
    var assetWrap = document.getElementById('drawerImageAssetWrap');
    var placeholderWrap = document.getElementById('drawerImagePlaceholderWrap');
    var emptyState = document.getElementById('drawerImageEmptyState');

    if (placeholder) {
      setDrawerPlaceholderPreview(placeholder);
    }

    if (assetWrap) assetWrap.classList.toggle('field-hidden', stateName !== 'image');
    if (placeholderWrap) placeholderWrap.classList.toggle('field-hidden', stateName !== 'placeholder');
    if (emptyState) emptyState.classList.toggle('field-hidden', stateName !== 'empty');
  }

  function syncImageUploadMeta() {
    var meta = document.getElementById('drawerImageUploadMeta');

    if (!meta) return;

    if (state.drawerUploadFile) {
      meta.textContent = state.drawerUploadFile.name;
      meta.classList.add('has-file');
      return;
    }

    meta.textContent = 'No file selected yet.';
    meta.classList.remove('has-file');
  }

  function syncImageModeUI() {
    var mode = document.getElementById('drawerImageMode');
    var urlGroup = document.getElementById('drawerImageUrlGroup');
    var uploadGroup = document.getElementById('drawerImageUploadGroup');
    var placeholderGroup = document.getElementById('drawerImagePlaceholderGroup');
    var preview = document.getElementById('drawerImagePreview');
    var imageUrlInput = document.getElementById('drawerImageUrl');
    var placeholderKey = getSelectedImagePlaceholderKey();
    var currentMode = mode ? mode.value : 'keep';
    var placeholder = currentMode === 'placeholder' ? getImagePlaceholderConfig(placeholderKey) : null;
    var previewUrl = '';

    if (urlGroup) urlGroup.classList.toggle('field-hidden', currentMode !== 'url');
    if (uploadGroup) uploadGroup.classList.toggle('field-hidden', currentMode !== 'upload');
    if (placeholderGroup) placeholderGroup.classList.toggle('field-hidden', currentMode !== 'placeholder');

    if (currentMode === 'url') {
      previewUrl = imageUrlInput ? imageUrlInput.value.trim() : '';
    } else if (currentMode === 'placeholder') {
      previewUrl = buildImagePlaceholderToken(placeholderKey);
    } else if (currentMode !== 'remove') {
      previewUrl = state.drawerPreviewUrl || '';
    }

    if (!preview) {
      syncImageUploadMeta();
      return;
    }

    if (placeholder) {
      preview.removeAttribute('src');
      setDrawerImagePreviewVisibility('placeholder', placeholder);
      syncImageUploadMeta();
      return;
    }

    if (!previewUrl) {
      preview.removeAttribute('src');
      setDrawerImagePreviewVisibility('empty');
      syncImageUploadMeta();
      return;
    }

    preview.src = previewUrl;
    setDrawerImagePreviewVisibility('image');
    syncImageUploadMeta();
  }

  function handleDrawerFileUpload(event) {
    var file = event.target.files && event.target.files[0];
    var reader;

    state.drawerUploadFile = file || null;
    state.drawerUploadData = null;

    if (!file) {
      state.drawerUploadPending = false;
      if (state.drawerValidationActive) syncDrawerValidationFeedback();
      return;
    }

    state.drawerUploadPending = true;
    reader = new FileReader();
    reader.onload = function() {
      state.drawerUploadData = reader.result;
      state.drawerUploadPending = false;
      state.drawerPreviewUrl = reader.result;
      syncImageModeUI();
      if (state.drawerValidationActive) syncDrawerValidationFeedback();
    };
    reader.onerror = function() {
      state.drawerUploadPending = false;
      state.drawerUploadData = null;
      if (state.drawerValidationActive) syncDrawerValidationFeedback();
    };
    reader.readAsDataURL(file);
  }

  function collectFormData(form) {
    var values = {};
    Array.prototype.forEach.call(form.elements, function(field) {
      if (!field.name) return;
      if (field.type === 'checkbox') {
        values[field.name] = field.checked;
      } else if (field.type === 'radio') {
        if (field.checked) {
          values[field.name] = field.value;
        } else if (!(field.name in values)) {
          values[field.name] = '';
        }
      } else {
        values[field.name] = field.value;
      }
    });
    return values;
  }

  function addFieldError(errors, fieldName, message) {
    if (!fieldName || !message) return;
    var normalizedMessage = String(message).trim();

    if (state.drawer && state.drawer.entity === 'item' && fieldName === 'displayOrder') {
      normalizedMessage = normalizedMessage.replace(/^Display order/i, 'Sort order');
    }

    if (!normalizedMessage) return;
    if (!errors[fieldName]) {
      errors[fieldName] = [];
    }
    if (errors[fieldName].indexOf(normalizedMessage) === -1) {
      errors[fieldName].push(normalizedMessage);
    }
  }

  function hasValue(value) {
    return !(value == null || (typeof value === 'string' && value.trim() === ''));
  }

  function normalizeOptionalValue(value) {
    return hasValue(value) ? value : undefined;
  }

  function getDrawerRecord() {
    return state.drawer && state.drawer.record ? state.drawer.record : null;
  }

  function getDrawerValidationContext(values) {
    var record = getDrawerRecord();
    var category = null;

    if (state.drawer && state.drawer.entity === 'item') {
      category = getCategoryById(values.categoryId || (record ? record.categoryId : ''));
    }

    return {
      category: category,
      currentImageUrl: record && record.imageUrl ? record.imageUrl : null,
      uploadData: state.drawerUploadData,
      uploadFile: state.drawerUploadFile,
      uploadPending: state.drawerUploadPending
    };
  }

  function validateDrawerForm() {
    var values;
    var context;
    var validation;

    if (!state.drawer || !AdminValidation) {
      return { isValid: true, errors: {}, values: {} };
    }

    values = collectFormData(refs.drawerForm);
    context = getDrawerValidationContext(values);
    validation = AdminValidation.validateForm(state.drawer.entity, values, context);
    validation.context = context;
    return validation;
  }

  function getDrawerFieldControl(fieldName) {
    if (!refs.drawerForm) return null;
    if (fieldName === 'imageUpload') {
      return document.getElementById('drawerImageUpload');
    }
    if (fieldName === 'imagePlaceholder') {
      return refs.drawerForm.querySelector('[name="imagePlaceholder"]:checked') || refs.drawerForm.querySelector('[name="imagePlaceholder"]');
    }
    return refs.drawerForm.querySelector('[name="' + fieldName + '"]');
  }

  function getDrawerFieldGroup(fieldName) {
    if (fieldName === 'imageUpload') {
      return document.getElementById('drawerImageUploadGroup');
    }

    var control = getDrawerFieldControl(fieldName);
    if (!control) return null;
    return control.closest('.form-group') || control.closest('.toggle-wrap') || control.parentNode;
  }

  function getDrawerInvalidTargets(fieldName) {
    if (fieldName === 'imageUpload') {
      var targets = [];
      var uploadGroup = document.getElementById('drawerImageUploadGroup');
      var uploadInput = document.getElementById('drawerImageUpload');
      if (uploadGroup) {
        var uploadZone = uploadGroup.querySelector('.img-upload-zone');
        if (uploadZone) targets.push(uploadZone);
      }
      if (uploadInput) targets.push(uploadInput);
      return targets;
    }
    if (fieldName === 'imagePlaceholder') {
      var placeholderList = document.getElementById('drawerImagePlaceholderList');
      return placeholderList ? [placeholderList] : [];
    }

    var control = getDrawerFieldControl(fieldName);
    return control ? [control] : [];
  }

  function ensureDrawerErrorNode(fieldName) {
    var group = getDrawerFieldGroup(fieldName);
    var control;
    var node;

    if (!group) return null;

    node = group.querySelector('[data-field-error-for="' + fieldName + '"]');
    if (!node) {
      node = document.createElement('div');
      node.className = 'form-field-error';
      node.setAttribute('data-field-error-for', fieldName);
      node.id = 'drawerFieldError-' + fieldName;
      node.setAttribute('aria-live', 'polite');
      group.appendChild(node);
    }

    control = getDrawerFieldControl(fieldName);
    if (fieldName === 'imagePlaceholder' && refs.drawerForm) {
      Array.prototype.forEach.call(refs.drawerForm.querySelectorAll('[name="imagePlaceholder"]'), function(input) {
        input.setAttribute('aria-describedby', node.id);
      });
    } else if (control) {
      control.setAttribute('aria-describedby', node.id);
    }

    return node;
  }

  function clearDrawerValidationUI() {
    Array.prototype.forEach.call(
      refs.drawerForm.querySelectorAll('.form-control.is-invalid, .img-upload-zone.is-invalid, .placeholder-choice-list.is-invalid'),
      function(node) {
        node.classList.remove('is-invalid');
      }
    );

    Array.prototype.forEach.call(refs.drawerForm.querySelectorAll('[aria-invalid="true"]'), function(node) {
      node.setAttribute('aria-invalid', 'false');
    });

    Array.prototype.forEach.call(refs.drawerForm.querySelectorAll('[data-field-error-for]'), function(node) {
      node.innerHTML = '';
      node.classList.remove('show');
    });
  }

  function setDrawerFieldState(fieldName, messages) {
    var errorMessages = Array.isArray(messages) ? messages.filter(Boolean) : (messages ? [messages] : []);
    var hasErrors = errorMessages.length > 0;
    var node = ensureDrawerErrorNode(fieldName);

    if (node) {
      node.innerHTML = hasErrors
        ? errorMessages.map(function(message) {
            return '<div class="form-field-error__item">' + escapeHtml(message) + '</div>';
          }).join('')
        : '';
      node.classList.toggle('show', hasErrors);
    }

    Array.prototype.forEach.call(getDrawerInvalidTargets(fieldName), function(target) {
      if (!target || !target.classList) return;
      target.classList.toggle('is-invalid', hasErrors);
      if (typeof target.setAttribute === 'function') {
        target.setAttribute('aria-invalid', hasErrors ? 'true' : 'false');
      }
    });
  }

  function renderDrawerValidationErrors(errors) {
    clearDrawerValidationUI();

    Object.keys(errors || {}).forEach(function(fieldName) {
      setDrawerFieldState(fieldName, errors[fieldName]);
    });
  }

  function focusDrawerField(fieldName) {
    var control = getDrawerFieldControl(fieldName);
    if (!control || typeof control.focus !== 'function') return;

    if (typeof control.scrollIntoView === 'function') {
      control.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    control.focus();
  }

  function focusFirstDrawerError(errors) {
    var fields = Object.keys(errors || {});
    if (!fields.length) return;
    focusDrawerField(fields[0]);
  }

  function syncDrawerValidationFeedback(focusFirstError) {
    var validation = validateDrawerForm();
    renderDrawerValidationErrors(validation.errors);

    if (focusFirstError && !validation.isValid) {
      focusFirstDrawerError(validation.errors);
    }

    return validation;
  }

  function normalizeRequestFieldErrors(fields) {
    var normalized = {};

    Object.keys(fields || {}).forEach(function(fieldName) {
      var value = fields[fieldName];

      if (Array.isArray(value)) {
        value.forEach(function(message) {
          addFieldError(normalized, fieldName, String(message));
        });
        return;
      }

      if (value) {
        addFieldError(normalized, fieldName, String(value));
      }
    });

    return normalized;
  }

  function listFieldErrorMessages(errors) {
    var seen = {};
    var messages = [];

    Object.keys(errors || {}).forEach(function(fieldName) {
      var fieldMessages = errors[fieldName];

      (Array.isArray(fieldMessages) ? fieldMessages : [fieldMessages]).forEach(function(message) {
        var normalizedMessage = String(message || '').trim();
        if (!normalizedMessage || seen[normalizedMessage]) return;
        seen[normalizedMessage] = true;
        messages.push(normalizedMessage);
      });
    });

    return messages;
  }

  function escapeRegExp(value) {
    return String(value == null ? '' : value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function lowerCaseFirstCharacter(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function getDrawerFieldLabel(fieldName) {
    var control = getDrawerFieldControl(fieldName);
    var labelNode;
    var labelText;
    var fallbackLabels = {
      badgeText: 'Offer label',
      categoryId: state.drawer && state.drawer.entity === 'item' ? 'Menu section' : 'Category',
      description: state.drawer && state.drawer.entity === 'promotion' ? 'Details' : 'Description',
      discountValue: 'Amount off',
      displayOrder: state.drawer && state.drawer.entity === 'item' ? 'Sort order' : 'Display order',
      endDate: 'End date',
      headline: 'Headline',
      imageMode: 'Photo source',
      imagePlaceholder: 'Placeholder image',
      imageUpload: 'Upload photo',
      imageUrl: 'Image link',
      menuItemId: 'Linked menu item',
      name: state.drawer && state.drawer.entity === 'category' ? 'Section name' : state.drawer && state.drawer.entity === 'item' ? 'Item name' : 'Name',
      priceLarge: 'Large price',
      priceMedium: 'Medium price',
      priceSingle: 'Price',
      promotionId: 'Offer',
      startDate: 'Start date',
      subtext: 'Subtext',
      title: state.drawer && state.drawer.entity === 'promotion' ? 'Offer title' : 'Title'
    };

    if (control && control.id && refs.drawerForm) {
      labelNode = refs.drawerForm.querySelector('label[for="' + control.id + '"]');
      if (labelNode) {
        labelText = labelNode.textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
        if (labelText) return labelText;
      }
    }

    return fallbackLabels[fieldName] || fieldName;
  }

  function formatFieldErrorToastMessage(fieldName, message) {
    var label = getDrawerFieldLabel(fieldName);
    var normalizedMessage = String(message == null ? '' : message).trim();
    var labelPrefixPattern;

    if (!normalizedMessage) return '';

    labelPrefixPattern = new RegExp('^' + escapeRegExp(label) + '(?:\\b|\\s*:?)', 'i');
    if (labelPrefixPattern.test(normalizedMessage)) {
      normalizedMessage = normalizedMessage.replace(labelPrefixPattern, '').trim();
    }

    normalizedMessage = normalizedMessage.replace(/^[:\-]\s*/, '');

    if (/^is required\.$/i.test(normalizedMessage)) {
      normalizedMessage = 'required.';
    } else if (/^is too long\.$/i.test(normalizedMessage)) {
      normalizedMessage = 'too long.';
    } else {
      normalizedMessage = lowerCaseFirstCharacter(normalizedMessage);
    }

    return label + ': ' + normalizedMessage;
  }

  function listFieldErrorToastMessages(errors) {
    var seen = {};
    var messages = [];

    Object.keys(errors || {}).forEach(function(fieldName) {
      var fieldMessages = errors[fieldName];

      (Array.isArray(fieldMessages) ? fieldMessages : [fieldMessages]).forEach(function(message) {
        var toastMessage = formatFieldErrorToastMessage(fieldName, message);
        if (!toastMessage || seen[toastMessage]) return;
        seen[toastMessage] = true;
        messages.push(toastMessage);
      });
    });

    return messages;
  }

  function buildDrawerErrorToastMessage(error, fieldErrors) {
    var messages = listFieldErrorToastMessages(fieldErrors);

    if (messages.length === 1) {
      return messages[0];
    }
    if (messages.length > 1) {
      return messages.slice(0, 2).join(' ') + (messages.length > 2 ? ' Check the highlighted fields for the rest.' : '');
    }
    if (error && error.message && error.message !== 'Server error') {
      return error.message;
    }
    if (state.drawer && state.drawer.entity === 'item') {
      return 'The item could not be saved. Check the highlighted fields and try again.';
    }
    return 'The form could not be saved. Check the highlighted fields and try again.';
  }

  function mapRequestErrorToDrawerErrors(error) {
    var details = error && error.details ? error.details : null;
    var message = error && error.message ? error.message : '';
    var mapped = {};

    if (details && details.fields) {
      return normalizeRequestFieldErrors(details.fields);
    }

    if (!message) return mapped;

    if (message === 'Category not found.') {
      addFieldError(mapped, 'categoryId', 'Choose a valid category.');
    } else if (message === 'Promotion not found.') {
      addFieldError(mapped, 'promotionId', 'Choose a valid offer.');
    } else if (message === 'Menu item not found.') {
      addFieldError(mapped, 'menuItemId', 'Choose a valid menu item.');
    } else if (message === 'Item name is required.') {
      addFieldError(mapped, 'name', 'Item name is required.');
    } else if (message === 'Description is required.') {
      addFieldError(mapped, 'description', 'Description is required.');
    } else if (message === 'Description is too long.') {
      addFieldError(mapped, 'description', 'Description must be 600 characters or fewer.');
    } else if (message === 'Price is required.') {
      addFieldError(mapped, 'priceSingle', 'Price is required.');
    } else if (message === 'At least one category price is required.') {
      addFieldError(mapped, 'priceMedium', 'Add at least one size price.');
      addFieldError(mapped, 'priceLarge', 'Add at least one size price.');
    } else if (message === 'This category requires an image.') {
      addFieldError(mapped, 'imageMode', 'Image is required.');
    } else if (message === 'Image URL is invalid.') {
      addFieldError(mapped, 'imageUrl', 'Please provide a valid image.');
    } else if (message === 'Uploaded image data is invalid.') {
      addFieldError(mapped, 'imageUpload', 'Please provide a valid image.');
    } else if (message === 'Uploaded image exceeds the 2MB limit.') {
      addFieldError(mapped, 'imageUpload', 'Image must be 2MB or smaller.');
    } else if (message === 'Placeholder image is invalid.') {
      addFieldError(mapped, 'imagePlaceholder', 'Choose a valid placeholder image.');
    } else if (message === 'Image mode is invalid.') {
      addFieldError(mapped, 'imageMode', 'Please provide a valid image.');
    } else if (message === 'Display order must be a whole number.' || message === 'Display order is out of range.') {
      addFieldError(mapped, 'displayOrder', message === 'Display order is out of range.' ? 'Display order must be at least 1.' : message);
    } else if (message === 'Featured headline is required.' || message === 'Featured headline is too long.') {
      addFieldError(mapped, 'headline', message === 'Featured headline is too long.' ? 'Headline must be 160 characters or fewer.' : 'Headline is required.');
    } else if (message === 'Featured subtext is too long.') {
      addFieldError(mapped, 'subtext', 'Subtext must be 600 characters or fewer.');
    } else if (message === 'Promotion title is required.' || message === 'Promotion title is too long.') {
      addFieldError(mapped, 'title', message === 'Promotion title is too long.' ? 'Offer title must be 160 characters or fewer.' : 'Offer title is required.');
    } else if (message === 'Promotion description is too long.') {
      addFieldError(mapped, 'description', 'Details must be 600 characters or fewer.');
    } else if (message === 'Promotion badge text is too long.') {
      addFieldError(mapped, 'badgeText', 'Offer label must be 80 characters or fewer.');
    } else if (message === 'Discount value is required.' || message === 'Discount value must be a valid positive amount.') {
      addFieldError(mapped, 'discountValue', message === 'Discount value is required.' ? 'Amount off is required.' : 'Amount off must be a valid number.');
    } else if (message === 'Percentage discounts cannot exceed 100.') {
      addFieldError(mapped, 'discountValue', 'Percentage discounts cannot exceed 100.');
    } else if (message === 'Start date must use YYYY-MM-DD format.') {
      addFieldError(mapped, 'startDate', 'Start date must use YYYY-MM-DD format.');
    } else if (message === 'End date must use YYYY-MM-DD format.') {
      addFieldError(mapped, 'endDate', 'End date must use YYYY-MM-DD format.');
    } else if (message === 'Promotion start date must be before the end date.') {
      addFieldError(mapped, 'startDate', 'Start date must be on or before the end date.');
      addFieldError(mapped, 'endDate', 'End date must be on or after the start date.');
    } else if (message === 'Category name is required.' || message === 'Category name is too long.') {
      addFieldError(mapped, 'name', message === 'Category name is too long.' ? 'Section name must be 120 characters or fewer.' : 'Section name is required.');
    } else if (message === 'Category description is too long.') {
      addFieldError(mapped, 'description', 'Description must be 400 characters or fewer.');
    } else if (message === 'Medium price must be a valid positive amount.') {
      addFieldError(mapped, 'priceMedium', 'Medium price must be a valid number.');
    } else if (message === 'Large price must be a valid positive amount.') {
      addFieldError(mapped, 'priceLarge', 'Large price must be a valid number.');
    } else if (message === 'Price must be a valid positive amount.') {
      addFieldError(mapped, 'priceSingle', 'Price must be a valid number.');
    }

    return mapped;
  }

  function buildPayload(entity, mode, values) {
    values = values || collectFormData(refs.drawerForm);
    var payload = {};

    if (mode === 'edit' && state.drawer.id) {
      payload.id = state.drawer.id;
    }

    if (entity === 'category') {
      payload.name = values.name;
      payload.slug = values.slug;
      payload.description = values.description;
      payload.layout = values.layout;
      payload.displayOrder = normalizeOptionalValue(values.displayOrder);
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
      payload.displayOrder = normalizeOptionalValue(values.displayOrder);
      payload.isAvailable = values.isAvailable;
      payload.isFeatured = values.isFeatured;
      payload.imageMode = values.imageMode;
      if (values.imageMode === 'url') payload.imageUrl = values.imageUrl;
      if (values.imageMode === 'upload') payload.imageUpload = state.drawerUploadData;
      if (values.imageMode === 'placeholder') payload.imagePlaceholder = values.imagePlaceholder;
      return payload;
    }

    if (entity === 'featured') {
      payload.menuItemId = values.menuItemId;
      payload.headline = values.headline;
      payload.subtext = values.subtext;
      payload.promotionId = values.promotionId;
      payload.displayOrder = normalizeOptionalValue(values.displayOrder);
      payload.isActive = values.isActive;
      payload.imageMode = values.imageMode;
      if (values.imageMode === 'url') payload.imageUrl = values.imageUrl;
      if (values.imageMode === 'upload') payload.imageUpload = state.drawerUploadData;
      if (values.imageMode === 'placeholder') payload.imagePlaceholder = values.imagePlaceholder;
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
      payload.displayOrder = normalizeOptionalValue(values.displayOrder);
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
    refs.modalTitle.textContent = 'Remove ' + label + '?';
    refs.modalBody.textContent = 'This will remove it from the website until it is added again.';
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
      showToast('success', 'Order updated', 'The website order has been updated.');
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
      refs.sidebarStatusText.textContent = 'You are signed in and ready to update the website.';
      renderNavigationCounts();
      renderStats();
      renderCurrentView();
    });
  }

  function fetchSession() {
    return apiRequest('/api/admin/auth', { cache: 'no-cache' }).then(function(auth) {
      state.auth = auth;
      syncLoginSetupState();

      if (auth.authenticated) {
        state.auth.authenticated = true;
        return bootstrapWorkspace({ restoringSession: true }).then(function() {
          showApp();
          return null;
        });
      }

      showLogin();
      return null;
    });
  }

  refs.loginForm.addEventListener('submit', function(event) {
    var credentialsAccepted = false;

    event.preventDefault();
    clearLoginFieldErrors();
    clearLoginError();
    renderLoginDiagnostics(state.auth && state.auth.diagnostics ? state.auth.diagnostics : null);

    if (!state.auth.configured) {
      syncLoginSetupState();
      showLoginError('This page is still waiting on one sign-in setting.');
      return;
    }

    var clientFieldErrors = validateLoginFields();
    if (applyLoginFieldErrors(clientFieldErrors)) {
      focusFirstLoginError(clientFieldErrors);
      showLoginError('Enter the required login fields.');
      return;
    }

    setLoginSubmitting(true);

    apiRequest('/api/admin/auth', {
      method: 'POST',
      body: JSON.stringify({
        username: refs.loginUsername.value,
        password: refs.loginPassword.value
      })
    }).then(function(result) {
      credentialsAccepted = true;
      state.auth.authenticated = true;
      refs.loginPassword.value = '';
      return bootstrapWorkspace().then(function() {
        showApp();
        showToast('success', 'Signed in', 'You can now update the website.');
      });
    }).catch(function(error) {
      showLogin();
      handleLoginFailure(error, {
        snapshotFailure: credentialsAccepted,
        snapshotPrefix: 'Sign-in worked, but this page could not finish loading. '
      });
    }).finally(function() {
      setLoginSubmitting(false);
    });
  });

  refs.loginUsername.addEventListener('input', function() {
    setLoginFieldState(refs.loginUsername, refs.loginUsernameError, '');
    if (refs.loginError.classList.contains('show')) clearLoginError();
  });

  refs.loginPassword.addEventListener('input', function() {
    setLoginFieldState(refs.loginPassword, refs.loginPasswordError, '');
    if (refs.loginError.classList.contains('show')) clearLoginError();
  });

  refs.logoutBtn.addEventListener('click', function() {
    apiRequest('/api/admin/auth', { method: 'DELETE' })
      .then(function() {
        showToast('info', 'Signed out', 'You have safely signed out.');
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
        showToast('success', 'Refreshed', 'Everything is up to date.');
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

  refs.drawerForm.addEventListener('input', function() {
    if (state.drawer && state.drawer.entity === 'item') {
      syncItemComposerUI();
    }
    if (state.drawer && (state.drawer.entity === 'item' || state.drawer.entity === 'featured')) {
      syncImageModeUI();
    }
    if (!state.drawerValidationActive) return;
    syncDrawerValidationFeedback();
  });

  refs.drawerForm.addEventListener('change', function() {
    if (state.drawer && state.drawer.entity === 'item') {
      syncItemComposerUI();
    }
    if (state.drawer && (state.drawer.entity === 'item' || state.drawer.entity === 'featured')) {
      syncImageModeUI();
    }
    if (!state.drawerValidationActive) return;
    syncDrawerValidationFeedback();
  });

  refs.drawerForm.addEventListener('submit', function(event) {
    var validation;
    event.preventDefault();
    if (!state.drawer) return;

    var entity = state.drawer.entity;
    var mode = state.drawer.mode;
    var endpoint = endpointForEntity(entity);
    var method = mode === 'edit' ? 'PUT' : 'POST';
    var payload;

    state.drawerValidationActive = true;
    validation = syncDrawerValidationFeedback(true);
    if (!validation.isValid) return;

    payload = buildPayload(entity, mode, validation.values);

    setLoading(refs.drawerSubmitBtn, true);

    apiRequest(endpoint, {
      method: method,
      body: JSON.stringify(payload)
    }).then(function() {
      closeDrawer();
      showToast('success', 'Saved', 'Your changes are now reflected on the website.');
      return loadSnapshot();
    }).catch(function(error) {
      var fieldErrors = mapRequestErrorToDrawerErrors(error);

      if (Object.keys(fieldErrors).length) {
        renderDrawerValidationErrors(fieldErrors);
        focusFirstDrawerError(fieldErrors);
        showToast('error', 'Save failed', buildDrawerErrorToastMessage(error, fieldErrors));
        return;
      }

      showToast('error', 'Save failed', buildDrawerErrorToastMessage(error, fieldErrors));
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
      showToast('success', 'Removed', 'The website has been updated.');
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
    var hadSession = Boolean(state.auth && state.auth.authenticated);

    console.error(error);
    showLogin();
    handleLoginFailure(error, {
      snapshotFailure: hadSession,
      snapshotPrefix: 'Your sign-in is still active, but this page could not finish loading. '
    });
  });
})();
