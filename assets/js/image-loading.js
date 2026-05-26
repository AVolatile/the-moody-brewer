(function() {
  'use strict';

  function setLoaded(wrapper) {
    wrapper.classList.remove('is-loading', 'has-error');
    wrapper.classList.add('is-loaded');
  }

  function setError(wrapper) {
    wrapper.classList.remove('is-loading', 'is-loaded');
    wrapper.classList.add('has-error');
  }

  function bindImage(wrapper) {
    if (!wrapper || wrapper.dataset.imageSkeletonBound === 'true') return;

    var image = wrapper.querySelector('img');
    if (!image) return;

    wrapper.dataset.imageSkeletonBound = 'true';

    if (image.complete) {
      if (image.naturalWidth > 0) {
        setLoaded(wrapper);
      } else {
        setError(wrapper);
      }
      return;
    }

    image.addEventListener('load', function() {
      setLoaded(wrapper);
    }, { once: true });

    image.addEventListener('error', function() {
      setError(wrapper);
    }, { once: true });
  }

  function refresh(root) {
    Array.prototype.forEach.call(
      (root || document).querySelectorAll('[data-image-skeleton]'),
      bindImage
    );
  }

  function observeDynamicImages() {
    if (!('MutationObserver' in window)) return;

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        Array.prototype.forEach.call(mutation.addedNodes, function(node) {
          if (!node || node.nodeType !== 1) return;
          if (node.matches && node.matches('[data-image-skeleton]')) bindImage(node);
          refresh(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    refresh(document);
    observeDynamicImages();
  });

  window.MBImageSkeletons = {
    refresh: refresh
  };
})();
