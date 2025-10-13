(function() {
  function updateNavbar() {
    var nb = document.querySelector('.nav-bar .navbar');
    if (!nb) return;
    if (window.scrollY > 10) nb.classList.add('blurred');
    else nb.classList.remove('blurred');
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
    var links = document.querySelectorAll('.navbar-nav .nav-link');
    if (!links.length) return;

    var currentPath = normalizePathname(window.location.pathname);
    var currentKey = toKey(currentPath);

    links.forEach(function(link) {
      link.classList.remove('active');
      var href = link.getAttribute('href');
      if (!href) return;
      var linkUrl = new URL(href, window.location.origin);
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

  // Improve mobile nav UX: dim background, prevent scroll, smoother closing
  document.addEventListener('DOMContentLoaded', function() {
    applyActiveNavLink();

    var $collapse = window.jQuery ? window.jQuery('#navbarCollapse') : null;
    if ($collapse && $collapse.length) {
      // Allow Esc to close the menu
      document.addEventListener('keyup', function(e) {
        if (e.key === 'Escape') {
          $collapse.collapse('hide');
        }
      });
    }
  });
})();
