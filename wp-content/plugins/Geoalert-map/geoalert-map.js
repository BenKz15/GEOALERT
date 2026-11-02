document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('geoalert-map');
  if (!el || typeof L === 'undefined') { return; }

  // Khung xem xấp xỉ tỉnh Lâm Đồng (cũ), chừa lề để kéo bản đồ thoải mái
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

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  // ===== Trạng thái điểm đã chọn =====
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

  // Hiển thị thông tin điểm đã chọn (bước sau sẽ thêm kết quả nguy cơ vào đây)
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

  // ===== Hiển thị kết quả nguy cơ =====
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

  // Phần "Vì sao?": thanh mức đóng góp của từng yếu tố
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

  // Ổ cắm: báo điểm hoặc bán kính đã đổi, rồi lấy dữ liệu nguy cơ
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
    input.value = '';
    emptyMessage('Bấm lên bản đồ hoặc tìm một địa điểm để xem mức nguy cơ quanh đó.');
  }

  // Chọn bán kính
  radiusBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var r = Math.min(parseInt(b.getAttribute('data-r'), 10), MAX_RADIUS);
      state.radius = r;
      radiusBtns.forEach(function (x) { x.classList.toggle('is-active', x === b); });
      if (state.lat !== null) {
        drawCircle();
        renderSelection();
        fitCircle();
        announce();
      }
    });
  });

  // Bấm lên bản đồ để chọn điểm
  map.on('click', function (e) {
    list.innerHTML = '';
    setPoint(e.latlng.lat, e.latlng.lng, '', map.getZoom() < 11);
  });

  // ===== Tìm địa điểm (Photon) =====
  function showMessage(text) {
    list.innerHTML = '';
    var li = document.createElement('li');
    li.className = 'ga-msg';
    li.textContent = text;
    list.appendChild(li);
  }

  function nhan(props) {
    var parts = [props.name, props.street, props.district, props.county, props.state];
    var out = [];
    parts.forEach(function (p) {
      if (p && out.indexOf(p) === -1) { out.push(p); }
    });
    return out.join(', ');
  }

  function chooseResult(feature) {
    var lon = feature.geometry.coordinates[0];
    var lat = feature.geometry.coordinates[1];
    var text = nhan(feature.properties);
    list.innerHTML = '';
    input.value = feature.properties.name || text;
    setPoint(lat, lon, text, true);
  }

  function search() {
    var q = input.value.trim();
    if (q.length < 2) { showMessage('Nhập ít nhất 2 ký tự.'); return; }
    showMessage('Đang tìm...');
    var url = 'https://photon.komoot.io/api/?limit=6'
      + '&bbox=107.30,11.15,108.85,12.30'
      + '&q=' + encodeURIComponent(q);
    fetch(url)
      .then(function (r) {
        if (!r.ok) { throw new Error('http ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        list.innerHTML = '';
        var items = (data.features || []).filter(function (f) {
          return f.properties && f.properties.countrycode === 'VN';
        });
        if (!items.length) { showMessage('Không tìm thấy địa điểm trong Lâm Đồng.'); return; }
        items.forEach(function (f) {
          var li = document.createElement('li');
          li.textContent = nhan(f.properties);
          li.addEventListener('click', function () { chooseResult(f); });
          list.appendChild(li);
        });
      })
      .catch(function () { showMessage('Không tìm được lúc này, thử lại sau.'); });
  }

  btn.addEventListener('click', search);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); search(); }
  });
}); 