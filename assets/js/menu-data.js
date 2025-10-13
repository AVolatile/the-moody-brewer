(function() {
  var API_ENDPOINT = '/api/menu';

  function money(value) {
    if (value === null || value === undefined || value === '') return '—';
    var num = Number(value);
    if (Number.isNaN(num)) return '—';
    return '$' + num.toFixed(2);
  }

  function clear(el) {
    if (!el) return;
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function renderCardCategory(cat) {
    var container = document.getElementById('menu-grid-' + cat.slug);
    if (!container) return;
    clear(container);
    if (!cat.items.length) {
      var empty = document.createElement('div');
      empty.className = 'col-12 text-muted';
      empty.textContent = 'More drinks coming soon.';
      container.appendChild(empty);
      return;
    }
    cat.items.forEach(function(item) {
      var outer = document.createElement('div');
      outer.className = 'col-12';

      var row = document.createElement('div');
      row.className = 'row align-items-center mb-5';

      var colMedia = document.createElement('div');
      colMedia.className = 'col-4 col-sm-3 d-flex flex-column align-items-center';
      if (item.imageData) {
        var img = document.createElement('img');
        img.className = 'w-100 rounded-circle mb-3 mb-sm-0';
        img.src = item.imageData;
        img.alt = item.name || '';
        colMedia.appendChild(img);
      } else {
        var ph = document.createElement('div');
        ph.className = 'rounded-circle bg-light d-flex align-items-center justify-content-center mb-3 mb-sm-0';
        ph.style.width = ph.style.height = '120px';
        var phText = document.createElement('small');
        phText.className = 'text-muted text-uppercase';
        phText.textContent = 'No Image';
        ph.appendChild(phText);
        colMedia.appendChild(ph);
      }
      var price = document.createElement('h5');
      price.className = 'menu-price mt-2';
      price.textContent = money(item.priceSingle);
      colMedia.appendChild(price);

      var colBody = document.createElement('div');
      colBody.className = 'col-8 col-sm-9';
      var title = document.createElement('h4');
      title.textContent = item.name || '';
      colBody.appendChild(title);
      if (item.description) {
        var desc = document.createElement('p');
        desc.className = 'm-0';
        desc.textContent = item.description;
        colBody.appendChild(desc);
      }

      row.appendChild(colMedia);
      row.appendChild(colBody);
      outer.appendChild(row);
      container.appendChild(outer);
    });
  }

  function renderTableCategory(cat) {
    var tbody = document.getElementById('table-body-' + cat.slug);
    if (!tbody) return;
    clear(tbody);
    var label0 = document.getElementById('label-' + cat.slug + '-0');
    var label1 = document.getElementById('label-' + cat.slug + '-1');
    if (label0) label0.textContent = (cat.priceLabels && cat.priceLabels[0]) ? cat.priceLabels[0] : 'M';
    if (label1) label1.textContent = (cat.priceLabels && cat.priceLabels[1]) ? cat.priceLabels[1] : 'L';

    if (!cat.items.length) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.colSpan = 3;
      tdEmpty.className = 'text-muted';
      tdEmpty.textContent = 'More drinks coming soon.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      return;
    }

    cat.items.forEach(function(item) {
      var tr = document.createElement('tr');
      var nameCell = document.createElement('td');
      var title = document.createElement('div');
      title.className = 'font-weight-bold';
      title.textContent = item.name || '';
      nameCell.appendChild(title);
      if (item.description) {
        var desc = document.createElement('small');
        desc.className = 'text-muted d-block';
        desc.textContent = item.description;
        nameCell.appendChild(desc);
      }
      tr.appendChild(nameCell);

      var mediumCell = document.createElement('td');
      mediumCell.className = 'text-right';
      mediumCell.textContent = item.priceMedium != null ? money(item.priceMedium) : '—';
      tr.appendChild(mediumCell);

      var largeCell = document.createElement('td');
      largeCell.className = 'text-right';
      largeCell.textContent = item.priceLarge != null ? money(item.priceLarge) : '—';
      tr.appendChild(largeCell);

      tbody.appendChild(tr);
    });
  }

  function renderListCategory(cat) {
    var container = document.getElementById('menu-list-' + cat.slug);
    if (!container) return;
    clear(container);
    if (!cat.items.length) {
      var empty = document.createElement('div');
      empty.className = 'col-12 text-muted';
      empty.textContent = 'More items coming soon.';
      container.appendChild(empty);
      return;
    }
    cat.items.forEach(function(item) {
      var outer = document.createElement('div');
      outer.className = 'col-lg-6';
      var row = document.createElement('div');
      row.className = 'row align-items-center mb-4';
      var colPrice = document.createElement('div');
      colPrice.className = 'col-4 col-sm-3 d-flex justify-content-center';
      var priceTag = document.createElement('h5');
      priceTag.className = 'menu-price';
      priceTag.textContent = money(item.priceSingle || item.priceMedium || item.priceLarge);
      colPrice.appendChild(priceTag);

      var colBody = document.createElement('div');
      colBody.className = 'col-8 col-sm-9';
      var title = document.createElement('h4');
      title.textContent = item.name || '';
      colBody.appendChild(title);
      if (item.description) {
        var desc = document.createElement('p');
        desc.className = 'm-0';
        desc.textContent = item.description;
        colBody.appendChild(desc);
      }

      row.appendChild(colPrice);
      row.appendChild(colBody);
      outer.appendChild(row);
      container.appendChild(outer);
    });
  }

  function renderMenu(data) {
    if (!data || !Array.isArray(data.categories)) return;
    data.categories.forEach(function(cat) {
      if (cat.layout === 'card') {
        renderCardCategory(cat);
      } else if (cat.layout === 'table') {
        renderTableCategory(cat);
      } else if (cat.layout === 'list') {
        renderListCategory(cat);
      }
    });
  }

  function fetchMenu() {
    return fetch(API_ENDPOINT, { cache: 'no-cache' })
      .then(function(res) {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      });
  }

  document.addEventListener('DOMContentLoaded', function() {
    fetchMenu()
      .then(renderMenu)
      .catch(function(err) {
        console.error('Menu fetch failed', err);
      });
  });
})();
