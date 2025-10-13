(function(){
  async function initLiveReviews(){
    try {
      const container = document.querySelector('.testimonial-carousel');
      if (!container) return;
      const res = await fetch('/api/google-reviews');
      if (!res.ok) return; // keep static content
      const data = await res.json();
      if (!data || !Array.isArray(data.reviews)) return;

      // Build review cards (limit to 6)
      const items = (data.reviews || []).slice(0, 6).map(r => {
        const stars = Array.from({length: Math.round(r.rating || 0)}).map(() => '<i class="fa fa-star"></i>').join('');
        return `
          <div class="testimonial-item">
            <div class="review-card">
              <div>
                <div class="review-header"><i class="fab fa-google"></i><span>Google</span></div>
                <div class="stars">${stars}</div>
                <p class="review-text">${(r.text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
              </div>
              <div class="reviewer">— ${r.author_name || 'Google User'}</div>
            </div>
          </div>`;
      }).join('');

      if (items) {
        container.innerHTML = items;
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.owlCarousel) {
          // re-init carousel
          const $ = window.jQuery;
          try { $(container).trigger('destroy.owl.carousel'); } catch(e) {}
          $(container).owlCarousel({
            autoplay: true,
            smartSpeed: 1000,
            margin: 25,
            dots: true,
            loop: true,
            responsive: { 0:{items:1}, 576:{items:1}, 768:{items:2}, 992:{items:3} }
          });
        }
      }
    } catch (e) {
      // fail silently, keep static fallback
      console.warn('Live reviews unavailable', e);
    }
  }
  document.addEventListener('DOMContentLoaded', initLiveReviews);
})();

