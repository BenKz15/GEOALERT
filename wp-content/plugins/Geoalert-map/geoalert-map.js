// Biến toàn cục để các nút chọn nhanh bên ngoài có thể gọi được
var globalGeoAlertMap = null;

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('geoalert-map');
  if (!el || typeof L === 'undefined') { return; }

  var API_BASE = 'https://geoalert-api.onrender.com';
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
  globalGeoAlertMap = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  var MAX_RADIUS = 3000;
  var state = { lat: null, lon: null, label: '', radius: 1000, date: '' };
  var marker = null;
  var circle = null;
  var hotspotsLayer = L.layerGroup().addTo(map);
  var isPredicting = false;
  var predictToken = 0;

  var input = document.getElementById('ga-search-input');
  var btn = document.getElementById('ga-search-btn');
  var list = document.getElementById('ga-search-results');
  var resultBody = document.getElementById('ga-result-body');
  var radiusBtns = document.querySelectorAll('#ga-radius-btns button');

  // Chèn bộ chọn ngày (quá khứ & hiện tại) ngay trên thanh tìm kiếm nếu chưa có
  var dateInput = document.getElementById('ga-date-input');
  if (!dateInput && input && input.parentNode) {
    var dateWrap = document.createElement('div');
    dateWrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;font-size:13px;';

    var dateLabel = document.createElement('label');
    dateLabel.setAttribute('for', 'ga-date-input');
    dateLabel.textContent = 'Ngày dự báo (để trống = hiện tại):';
    dateLabel.style.fontWeight = '600';

    dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.id = 'ga-date-input';
    dateInput.style.cssText = 'padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#fff;';

    var clearDateBtn = document.createElement('button');
    clearDateBtn.type = 'button';
    clearDateBtn.textContent = 'Dùng hiện tại';
    clearDateBtn.style.cssText = 'padding:5px 10px;border:1px solid #1F4D2B;border-radius:6px;background:#f0f7f2;color:#1F4D2B;cursor:pointer;font-size:12px;font-weight:600;';

    dateInput.addEventListener('change', function () {
      state.date = dateInput.value || '';
      loadHotspots(state.date);
      if (state.lat !== null && state.lon !== null) {
        runPredict();
      }
    });

    clearDateBtn.addEventListener('click', function () {
      dateInput.value = '';
      state.date = '';
      loadHotspots('');
      if (state.lat !== null && state.lon !== null) {
        runPredict();
      }
    });

    dateWrap.appendChild(dateLabel);
    dateWrap.appendChild(dateInput);
    dateWrap.appendChild(clearDateBtn);
    input.parentNode.parentNode.insertBefore(dateWrap, input.parentNode);
  }

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

  function renderSelection(statusText) {
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
    pending.id = 'ga-risk-slot';
    pending.textContent = statusText || 'Đang phân tích dữ liệu...';
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

  function makeDiv(cls, text) {
    var d = document.createElement('div');
    if (cls) { d.className = cls; }
    if (text) { d.textContent = text; }
    return d;
  }

  function mapRiskClass(data) {
    var tier = (data.tier_code || '').toLowerCase();
    if (tier === 'red' || data.risk_level === 'Cao') { return 'high'; }
    if (tier === 'yellow' || data.risk_level === 'Trung bình') { return 'mid'; }
    return 'low';
  }

  function appendFeaturesAndWhy(slot, data) {
    var feat = data.features || {};
    var box = makeDiv('ga-why');
    box.appendChild(makeDiv('ga-why-title', 'Vì sao?'));

    var detailLines = [];
    if (feat.slope_max_deg !== undefined && feat.slope_max_deg !== null) {
      detailLines.push('Độ dốc: ' + feat.slope_max_deg + '°');
    }
    if (feat.rain_3d_mm !== undefined && feat.rain_3d_mm !== null) {
      detailLines.push('Mưa 3 ngày: ' + feat.rain_3d_mm + ' mm');
    }
    if (feat.rain_15d_mm !== undefined && feat.rain_15d_mm !== null) {
      detailLines.push('Mưa 15 ngày: ' + feat.rain_15d_mm + ' mm');
    }
    if (feat.soil_moisture_pct !== undefined && feat.soil_moisture_pct !== null) {
      detailLines.push('Độ ẩm đất: ' + feat.soil_moisture_pct + '%');
    }
    if (feat.ndvi !== undefined && feat.ndvi !== null) {
      detailLines.push('NDVI: ' + feat.ndvi);
    }
    if (detailLines.length) {
      box.appendChild(makeDiv('ga-why-note', detailLines.join(' · ')));
    }

    var contribs = Array.isArray(data.contributions) ? data.contributions : [];
    if (contribs.length) {
      var sorted = contribs.slice().sort(function (a, b) {
        return (Number(b.contribution_pct) || 0) - (Number(a.contribution_pct) || 0);
      });
      var maxPct = sorted[0].contribution_pct || 1;
      sorted.forEach(function (c) {
        var pct = Number(c.contribution_pct) || 0;
        var item = makeDiv('ga-why-item');
        var top = makeDiv('ga-why-top');
        top.appendChild(makeDiv('ga-why-name', c.label || c.feature || 'Yếu tố'));
        var valText = (c.value !== undefined && c.value !== null)
          ? (c.value + (c.unit ? ' ' + c.unit : ''))
          : '';
        top.appendChild(makeDiv('ga-why-val', valText));
        item.appendChild(top);
        var track = makeDiv('ga-why-track');
        var fill = makeDiv('ga-why-fill');
        fill.style.width = Math.max(4, Math.round(pct / maxPct * 100)) + '%';
        track.appendChild(fill);
        item.appendChild(track);
        item.appendChild(makeDiv('ga-why-pct', pct.toFixed(1) + '% mức đóng góp'));
        box.appendChild(item);
      });
    }

    if (data.recommendation) {
      box.appendChild(makeDiv('ga-why-note', 'Khuyến nghị: ' + data.recommendation));
    }
    slot.appendChild(box);
  }

  function renderPredictionResult(data) {
    var slot = document.getElementById('ga-risk-slot');
    if (!slot) { return; }
    slot.innerHTML = '';
    slot.className = 'ga-risk';

    var riskCls = mapRiskClass(data);
    var head = makeDiv('ga-risk-head ga-risk-' + riskCls);
    head.appendChild(makeDiv('ga-risk-label', 'Nguy cơ sạt lở'));
    head.appendChild(makeDiv('ga-risk-level', data.risk_level || ''));
    slot.appendChild(head);

    if (data.area_km2 !== undefined && data.area_km2 !== null) {
      slot.appendChild(row('Diện tích khảo sát', Number(data.area_km2).toFixed(1) + ' km²'));
    }
    if (data.prob_max_radius_pct !== undefined && data.prob_max_radius_pct !== null) {
      slot.appendChild(row('Xác suất cao nhất trong bán kính', Number(data.prob_max_radius_pct).toFixed(1) + '%'));
    }
    if (data.prob_point_pct !== undefined && data.prob_point_pct !== null) {
      slot.appendChild(row('Xác suất tại điểm chọn', Number(data.prob_point_pct).toFixed(1) + '%'));
    }

    appendFeaturesAndWhy(slot, data);

    if (data.updated_at) {
      slot.appendChild(row('Cập nhật', new Date(data.updated_at).toLocaleString('vi-VN')));
    }
    if (data.source) {
      slot.appendChild(row('Nguồn', data.source));
    }
  }

  async function fetchHotspots(dateStr) {
    var query = dateStr ? ('?date=' + encodeURIComponent(dateStr)) : '';
    var response = await fetch(API_BASE + '/hotspots' + query);
    if (!response.ok) {
      throw new Error('Không tải được danh sách điểm trọng điểm');
    }
    return await response.json();
  }

  async function fetchPredict(payloadObj) {
    var payload = {
      lat: Number(payloadObj.lat),
      lon: Number(payloadObj.lon),
      radius_m: Number(payloadObj.radiusM),
      date: payloadObj.dateStr || null
    };
    var response = await fetch(API_BASE + '/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      var err = await response.json().catch(function () { return {}; });
      throw new Error(err.detail || 'Lỗi khi gọi API dự báo');
    }
    return await response.json();
  }

  function tierColor(tier) {
    var t = (tier || '').toLowerCase();
    if (t === 'red') { return '#dc2626'; }
    if (t === 'yellow') { return '#d97706'; }
    return '#16a34a';
  }

  function loadHotspots(dateStr) {
    fetchHotspots(dateStr)
      .then(function (data) {
        hotspotsLayer.clearLayers();
        var items = Array.isArray(data) ? data : (data.hotspots || data.items || []);
        items.forEach(function (pt) {
          var lat = Number(pt.lat !== undefined ? pt.lat : pt.latitude);
          var lon = Number(pt.lon !== undefined ? pt.lon : pt.longitude);
          if (Number.isNaN(lat) || Number.isNaN(lon)) { return; }
          var color = tierColor(pt.tier_code);
          var probText = (pt.prob_pct !== undefined && pt.prob_pct !== null)
            ? (Number(pt.prob_pct).toFixed(1) + '%')
            : ((pt.prob !== undefined) ? ((Number(pt.prob) * 100).toFixed(1) + '%') : '');
          var title = pt.name || pt.place || 'Điểm trọng điểm';

          var cm = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
          });
          cm.bindTooltip(title + (probText ? (' — ' + probText) : ''));
          cm.on('click', function (ev) {
            L.DomEvent.stopPropagation(ev);
            setPoint(lat, lon, title, true);
          });
          cm.addTo(hotspotsLayer);
        });
      })
      .catch(function (err) {
        console.warn('GEOALERT hotspots:', err);
      });
  }

  function setControlsDisabled(disabled) {
    isPredicting = disabled;
    if (btn) { btn.disabled = disabled; }
    if (dateInput) { dateInput.disabled = disabled; }
    radiusBtns.forEach(function (b) { b.disabled = disabled; });
  }

  function runPredict() {
    if (state.lat === null || state.lon === null) { return; }
    var token = ++predictToken;
    setControlsDisabled(true);
    renderSelection('Đang phân tích dữ liệu...');

    document.dispatchEvent(new CustomEvent('geoalert:select', {
      detail: { lat: state.lat, lon: state.lon, radius: state.radius, label: state.label, date: state.date }
    }));

    fetchPredict({
      lat: state.lat,
      lon: state.lon,
      radiusM: state.radius,
      dateStr: state.date
    })
      .then(function (res) {
        if (token !== predictToken) { return; }
        renderPredictionResult(res);
      })
      .catch(function (err) {
        if (token !== predictToken) { return; }
        var slot = document.getElementById('ga-risk-slot');
        if (slot) {
          slot.className = 'ga-pending';
          slot.textContent = err.message || 'Không thể lấy kết quả dự báo lúc này.';
        }
      })
      .finally(function () {
        if (token === predictToken) {
          setControlsDisabled(false);
        }
      });
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
    renderSelection('Đang phân tích dữ liệu...');
    if (shouldFit) { fitCircle(); }
    runPredict();
  }

  // Cho phép các nút chọn nhanh gọi thẳng tọa độ và dự báo qua API
  window.zoomToZone = function (lat, lon, zoom) {
    setPoint(Number(lat), Number(lon), 'Vùng chọn nhanh (' + Number(lat).toFixed(4) + ', ' + Number(lon).toFixed(4) + ')', false);
    map.flyTo([Number(lat), Number(lon)], Number(zoom) || 14, { duration: 1 });
  };

  function clearPoint() {
    predictToken++;
    setControlsDisabled(false);
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
      if (isPredicting) { return; }
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
    if (isPredicting) { return; }
    setPoint(e.latlng.lat, e.latlng.lng, '', false);
  });

  radiusBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (isPredicting) { return; }
      var r = parseInt(b.getAttribute('data-r'), 10);
      if (!r || r > MAX_RADIUS) { return; }
      radiusBtns.forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      state.radius = r;
      if (state.lat !== null && state.lon !== null) {
        drawCircle();
        fitCircle();
        runPredict();
      }
    });
  });

  function doSearch() {
    if (!input || !list || isPredicting) { return; }
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

  loadHotspots('');
});