// Biến toàn cục để các nút chọn nhanh bên ngoài có thể gọi được
var globalGeoAlertMap = null;

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('geoalert-map');
  if (!el || typeof L === 'undefined') { return; }

  var tinhBounds = L.latLngBounds([11.15, 107.30], [12.30, 108.85]);
  var gioiHan    = L.latLngBounds([10.80, 106.90], [12.65, 109.25]);

  var map = L.map('geoalert-map', {
    attributionControl: false,
    minZoom: 8,
    maxZoom: 17,
    maxBounds: gioiHan,
    maxBoundsViscosity: 0.8
  });
  map.fitBounds(tinhBounds);
  window.globalGeoAlertMap = map;

  // Gán vào biến toàn cục để điều khiển từ bên ngoài
  globalGeoAlertMap = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  var MAX_RADIUS = 3000;
  var state = { lat: null, lon: null, label: '', radius: 1000 };
  var marker = null;
  var circle = null;

  var input = document.getElementById('ga-search-input');
  var btn = document.getElementById('ga-search-btn');
  var list = document.getElementById('ga-search-results');
  var resultBody = document.getElementById('ga-result-body');
  var radiusBtns = document.querySelectorAll('#ga-radius-btns button');

  var pinIcon = L.divIcon({
    className: 'ga-pin',
    html: '<svg viewBox="0 0 24 36" width="34" height="48" xmlns="http://www.w3.org/2000/svg">'
        + '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#EA4335" stroke="#B3261E" stroke-width="1"/>'
        + '<circle cx="12" cy="12" r="5" fill="#7A1F18"/></svg>',
    iconSize: [34, 48],
    iconAnchor: [17, 48],
    popupAnchor: [0, -44]
  });

  function emptyMessage(text) {
    resultBody.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'ga-empty';
    p.textContent = text;
    resultBody.appendChild(p);
  }

  function formatRadius(r) {
    return r >= 1000 ? (r / 1000) + ' km' : r + ' m';
  }

  function row(label, value) {
    var d = document.createElement('div');
    d.className = 'ga-sel-row';
    var a = document.createElement('span');
    a.className = 'ga-sel-label';
    a.textContent = label;
    var b = document.createElement('span');
    b.className = 'ga-sel-value';
    b.textContent = value;
    d.appendChild(a);
    d.appendChild(b);
    return d;
  }

  function renderSelection() {
    resultBody.innerHTML = '';
    var name = document.createElement('div');
    name.className = 'ga-sel-name';
    name.textContent = state.label || 'Vị trí trên bản đồ';
    resultBody.appendChild(name);
    resultBody.appendChild(row('Tọa độ', state.lat.toFixed(5) + ', ' + state.lon.toFixed(5)));
    resultBody.appendChild(row('Bán kính', formatRadius(state.radius)));
    var area = Math.PI * state.radius * state.radius / 1e6;
    resultBody.appendChild(row('Diện tích khảo sát', area.toFixed(1) + ' km²'));

    var pending = document.createElement('div');
    pending.className = 'ga-pending';
    pending.textContent = 'Mức nguy cơ: chưa có dữ liệu.';
    pending.id = 'ga-risk-slot';
    resultBody.appendChild(pending);

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ga-clear';
    clear.textContent = 'Xóa điểm đã chọn';
    clear.addEventListener('click', clearPoint);
    resultBody.appendChild(clear);
  }

  function drawCircle() {
    if (circle) { map.removeLayer(circle); }
    circle = L.circle([state.lat, state.lon], {
      radius: state.radius,
      color: '#1F4D2B',
      weight: 2,
      dashArray: '6 6',
      fillColor: '#4C8C4A',
      fillOpacity: 0.12
    }).addTo(map);
  }

  function fitCircle() {
    if (circle) {
      map.fitBounds(circle.getBounds(), { padding: [40, 40], maxZoom: 15 });
    }
  }

  var riskToken = 0;
  var LEVEL_NAME = { low: 'Thấp', mid: 'Trung bình', high: 'Cao' };

  function makeDiv(cls, text) {
    var d = document.createElement('div');
    if (cls) { d.className = cls; }
    if (text) { d.textContent = text; }
    return d;
  }

  function formatFactor(f) {
    var v = (typeof f.value === 'number' && !f.unit) ? f.value.toFixed(2) : f.value;
    return v + (f.unit ? ' ' + f.unit : '');
  }

  function appendFactors(slot, res) {
    if (!res.factors || !res.factors.length) { return; }
    var box = makeDiv('ga-why');
    box.appendChild(makeDiv('ga-why-title', 'Vì sao?'));
    var sorted = res.factors.slice().sort(function (a, b) {
      return b.contribution - a.contribution;
    });
    var max = sorted[0].contribution || 1;
    sorted.forEach(function (f) {
      var item = makeDiv('ga-why-item');
      var top = makeDiv('ga-why-top');
      top.appendChild(makeDiv('ga-why-name', f.label));
      top.appendChild(makeDiv('ga-why-val', formatFactor(f)));
      item.appendChild(top);
      var track = makeDiv('ga-why-track');
      var fill = makeDiv('ga-why-fill');
      fill.style.width = Math.max(4, Math.round(f.contribution / max * 100)) + '%';
      track.appendChild(fill);
      item.appendChild(track);
      item.appendChild(makeDiv('ga-why-pct', Math.round(f.contribution * 100) + '% mức đóng góp'));
      box.appendChild(item);
    });
    box.appendChild(makeDiv('ga-why-note', 'Thanh dài hơn nghĩa là yếu tố đó góp nhiều hơn vào kết quả.'));
    slot.appendChild(box);
  }

  function renderRisk(res) {
    var slot = document.getElementById('ga-risk-slot');
    if (!slot) { return; }
    slot.innerHTML = '';
    if (!res) {
      slot.className = 'ga-pending';
      slot.textContent = 'Mức nguy cơ: chưa có dữ liệu.';
      return;
    }
    slot.className = 'ga-risk';
    if (res.type === 'demo') {
      slot.appendChild(makeDiv('ga-demo-tag', 'DỮ LIỆU MINH HỌA'));
    }
    var head = makeDiv('ga-risk-head ga-risk-' + res.level);
    head.appendChild(makeDiv('ga-risk-label', 'Nguy cơ sạt lở'));
    head.appendChild(makeDiv('ga-risk-level', LEVEL_NAME[res.level] || ''));
    slot.appendChild(head);
    slot.appendChild(row('Xác suất cao nhất trong bán kính', Math.round(res.probabilityMax * 100) + '%'));
    slot.appendChild(row('Xác suất tại điểm chọn', Math.round(res.probability * 100) + '%'));
    appendFactors(slot, res);
    if (res.updatedAt) {
      slot.appendChild(row('Cập nhật', new Date(res.updatedAt).toLocaleString('vi-VN')));
    }
    if (res.source) { slot.appendChild(row('Nguồn', res.source)); }
    if (res.type === 'demo') {
      slot.appendChild(makeDiv('ga-demo-note', 'Số liệu này được tạo ngẫu nhiên để thử giao diện, không phản ánh nguy cơ thật.'));
    }
  }

  function announce() {
    document.dispatchEvent(new CustomEvent('geoalert:select', {
      detail: { lat: state.lat, lon: state.lon, radius: state.radius, label: state.label }
    }));
    var slot = document.getElementById('ga-risk-slot');
    if (slot) { slot.className = 'ga-pending'; slot.textContent = 'Đang tính...'; }
    if (!window.GEOALERT || typeof GEOALERT.getRisk !== 'function') { renderRisk(null); return; }
    var token = ++riskToken;
    GEOALERT.getRisk(state.lat, state.lon, state.radius)
      .then(function (res) { if (token === riskToken) { renderRisk(res); } })
      .catch(function () { if (token === riskToken) { renderRisk(null); } });
  }

  function setPoint(lat, lon, label, shouldFit) {
    if (!tinhBounds.contains([lat, lon])) {
      emptyMessage('Vị trí này nằm ngoài khu vực Lâm Đồng mà GEOALERT hỗ trợ.');
      return;
    }
    state.lat = lat;
    state.lon = lon;
    state.label = label || '';

    if (marker) { map.removeLayer(marker); }
    marker = L.marker([lat, lon], { icon: pinIcon }).addTo(map);
    var tip = document.createElement('div');
    tip.textContent = state.label || 'Điểm bạn chọn';
    marker.bindPopup(tip);

    drawCircle();
    renderSelection();
    if (shouldFit) { fitCircle(); }
    announce();
  }

  function clearPoint() {
    if (marker) { map.removeLayer(marker); marker = null; }
    if (circle) { map.removeLayer(circle); circle = null; }
    state.lat = null;
    state.lon = null;
    state.label = '';
    if (input) { input.value = ''; }
    emptyMessage('Bấm lên bản đồ hoặc tìm một địa điểm để xem mức nguy cơ quanh đó.');
  }

  var locateControl = L.control({ position: 'topleft' });
  locateControl.onAdd = function () {
    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    var link = L.DomUtil.create('a', '', container);
    link.href = '#';
    link.title = 'Định vị vị trí hiện tại của tôi';
    link.setAttribute('aria-label', 'Định vị vị trí hiện tại');
    link.style.width = '30px';
    link.style.height = '30px';
    link.style.display = 'flex';
    link.style.alignItems = 'center';
    link.style.justifyContent = 'center';
    link.style.backgroundColor = '#FFFFFF';
    link.style.color = '#1F4D2B';
    link.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="3"></circle>'
      + '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>'
      + '<circle cx="12" cy="12" r="8"></circle></svg>';

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(link, 'click', function (e) {
      L.DomEvent.preventDefault(e);
      if (!navigator.geolocation) {
        emptyMessage('Trình duyệt của bạn không hỗ trợ định vị GPS.');
        return;
      }
      emptyMessage('Đang xác định tọa độ GPS của bạn...');
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lon = pos.coords.longitude;
          if (!tinhBounds.contains([lat, lon])) {
            emptyMessage('Vị trí GPS hiện tại của bạn (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ') đang nằm ngoài phạm vi tỉnh Lâm Đồng.');
            return;
          }
          setPoint(lat, lon, 'Vị trí hiện tại của bạn', true);
        },
        function (err) {
          if (err.code === 1) {
            emptyMessage('Bạn đã từ chối quyền truy cập vị trí. Hãy cấp quyền định vị trên trình duyệt để sử dụng.');
          } else {
            emptyMessage('Không thể lấy tín hiệu GPS lúc này. Vui lòng thử lại.');
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
    return container;
  };
  locateControl.addTo(map);

  map.on('click', function (e) {
    setPoint(e.latlng.lat, e.latlng.lng, '', false);
  });

  radiusBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var r = parseInt(b.getAttribute('data-r'), 10);
      if (!r || r > MAX_RADIUS) { return; }
      radiusBtns.forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      state.radius = r;
      if (state.lat !== null && state.lon !== null) {
        drawCircle();
        renderSelection();
        fitCircle();
        announce();
      }
    });
  });

  function doSearch() {
    if (!input || !list) { return; }
    var q = input.value.trim();
    list.innerHTML = '';
    if (!q) { return; }
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q)
            + '&bbox=107.30,11.15,108.85,12.30&limit=5';
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        list.innerHTML = '';
        var feats = (data && data.features) || [];
        if (!feats.length) {
          var li = document.createElement('li');
          li.textContent = 'Không tìm thấy địa điểm phù hợp tại Lâm Đồng.';
          list.appendChild(li);
          return;
        }
        feats.forEach(function (f) {
          var p = f.properties || {};
          var coords = f.geometry && f.geometry.coordinates;
          if (!coords) { return; }
          var parts = [p.name, p.street, p.district, p.city, p.state].filter(Boolean);
          var label = parts.join(', ') || q;
          var li = document.createElement('li');
          li.textContent = label;
          li.addEventListener('click', function () {
            list.innerHTML = '';
            input.value = label;
            setPoint(coords[1], coords[0], label, true);
          });
          list.appendChild(li);
        });
      })
      .catch(function () {
        list.innerHTML = '';
      });
  }

  if (btn) { btn.addEventListener('click', doSearch); }
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    });
  }

  fetch('../data.geojson')
    .then(function (res) {
      if (!res.ok) { throw new Error('Không tải được data.geojson'); }
      return res.json();
    })
    .then(function (geojsonData) {
      L.geoJSON(geojsonData, {
        pointToLayer: function (feature, latlng) {
          var color = (feature.properties && feature.properties.risk_color) || '#1F4D2B';
          return L.circleMarker(latlng, {
            radius: 9,
            fillColor: color,
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.92
          });
        },
        onEachFeature: function (feature, layer) {
          var p = feature.properties || {};
          var popupHtml = '<div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:220px;">'
            + '<strong style="color:#1F4D2B;font-size:14px;">' + (p.name || 'Điểm quan trắc') + '</strong><br>'
            + '<span style="display:inline-block;margin:4px 0;padding:2px 8px;border-radius:4px;background:' + (p.risk_color || '#1F4D2B') + ';color:#fff;font-weight:600;font-size:12px;">'
            + (p.risk_level || '') + '</span><br>'
            + '• Độ dốc: <b>' + (p.slope || '-') + '</b> | Cao độ: <b>' + (p.elevation || '-') + '</b><br>'
            + '• Chỉ số thực vật (NDVI): <b>' + (p.ndvi || '-') + '</b><br>'
            + '• Xác suất mưa vừa (50mm): <b>' + (p.probability_dry || '-') + '</b><br>'
            + '• Xác suất mưa bão (150mm): <b style="color:#E0115F;">' + (p.probability_rain150 || '-') + '</b>'
            + '</div>';
          layer.bindPopup(popupHtml);
        }
      }).addTo(map);
    })
    .catch(function (err) {
      console.warn('GEOALERT GeoJSON:', err);
    });
});