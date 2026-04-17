(function() {
  var desktopBreakpoint = 992;

  function updateNavbar() {
    var nav = document.querySelector('[data-site-nav]');
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }

  function normalizePathname(pathname) {
    if (!pathname) return '/index.html';
    var clean = pathname.replace(/\/+$/, '');
    if (clean === '' || clean === '/') return '/index.html';
    return clean;
  }

  function toKey(pathname) {
    return pathname.replace(/\.html$/, '');
  }

  function applyActiveNavLink() {
    var links = document.querySelectorAll('.site-nav__link');
    if (!links.length) return;

    var currentPath = normalizePathname(window.location.pathname);
    var currentKey = toKey(currentPath);

    links.forEach(function(link) {
      link.classList.remove('active');
      var href = link.getAttribute('href');
      if (!href) return;
      var linkUrl = new URL(href, window.location.origin);
      if (linkUrl.origin !== window.location.origin) return;
      var linkPath = normalizePathname(linkUrl.pathname);
      var linkKey = toKey(linkPath);
      if (linkPath === currentPath || linkKey === currentKey) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateNavbar, { passive: true });
  document.addEventListener('DOMContentLoaded', updateNavbar);
  updateNavbar();

  document.addEventListener('DOMContentLoaded', function() {
    applyActiveNavLink();

    var nav = document.querySelector('[data-site-nav]');
    var toggle = document.getElementById('siteNavToggle');
    var menu = document.getElementById('siteNavMenu');
    var overlay = document.querySelector('[data-nav-overlay]');
    if (!nav || !toggle || !menu) return;

    function setMenuOpen(isOpen) {
      nav.classList.toggle('menu-open', isOpen);
      toggle.classList.toggle('is-active', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
      document.body.classList.toggle('nav-menu-open', isOpen);
    }

    toggle.addEventListener('click', function() {
      setMenuOpen(!nav.classList.contains('menu-open'));
    });

    if (overlay) {
      overlay.addEventListener('click', function() {
        setMenuOpen(false);
      });
    }

    menu.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        setMenuOpen(false);
      });
    });

    document.addEventListener('keyup', function(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    });

    window.addEventListener('resize', function() {
      if (window.innerWidth >= desktopBreakpoint) setMenuOpen(false);
    }, { passive: true });
  });
})();
