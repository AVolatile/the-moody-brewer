// Render managed menu items from assets/data/menu.json into #managed-menu
(function() {
  function money(n){
    var num = typeof n === 'number' ? n : parseFloat(n);
    if (isNaN(num)) return '';
    return '$' + num.toFixed(2);
  }

  function render(items){
    var host = document.getElementById('managed-menu');
    if (!host) return;
    if (!items || !items.length) { host.innerHTML = '<p class="muted">No managed items yet.</p>'; return; }
    // Group by category
    var byCat = {};
    items.forEach(function(it){ (byCat[it.category] = byCat[it.category] || []).push(it); });

    var html = '';
    Object.keys(byCat).sort().forEach(function(cat){
      html += '<div class="col-lg-6"><h1 class="mb-4">' + cat + '</h1>';
      byCat[cat].forEach(function(it){
        html += '\n  <div class="row align-items-center mb-5">\n'
              + '    <div class="col-4 col-sm-3 d-flex justify-content-center">\n'
              + '      <h5 class="menu-price">' + money(it.price) + '</h5>\n'
              + '    </div>\n'
              + '    <div class="col-8 col-sm-9">\n'
              + '      <h4>' + (it.name||'') + '</h4>\n'
              + '      <p class="m-0">' + (it.description||'') + '</p>\n'
              + '    </div>\n'
              + '  </div>';
      });
      html += '</div>';
    });
    host.innerHTML = '<div class="row">' + html + '</div>';
  }

  function fetchJSON(url){
    return fetch(url, { cache: 'no-cache' }).then(function(r){ if(!r.ok) throw new Error('net'); return r.json(); });
  }

  document.addEventListener('DOMContentLoaded', function(){
    // Prefer dynamic API (Netlify Function + Neon), fallback to static JSON
    fetchJSON('/api/menu')
      .then(function(data){ render(data.items || []); })
      .catch(function(){
        fetchJSON('assets/data/menu.json')
          .then(function(data){ render(data.items || []); })
          .catch(function(){ render([]); });
      });
  });
})();
