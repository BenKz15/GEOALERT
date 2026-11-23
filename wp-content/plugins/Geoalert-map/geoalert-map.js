// Biến toàn cục để các nút chọn nhanh và bảng dự đoán V9.2 có thể gọi được
var globalGeoAlertMap = null;
var setGeoAlertV92Point = null;
var updateGeoAlertV92RightPanel = null;

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
  var state = { lat: null, lon: null, label: '', radius: 1000, date: '', v92Result: null };
  var marker = null;
  var circle = null;
  var hotspotsLayer = L.layerGroup().addTo(map);
  var predictToken = 0;

  var input = document.getElementById('ga-search-input');
  var btn = document.getElementById('ga-search-btn');
  var list = document.getElementById('ga-search-results');
  var resultBody = document.getElementById('ga-result-body');
  var radiusBtns = document.querySelectorAll('#ga-radius-btns button');

  // Bộ chọn ngày (quá khứ & hiện tại)
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
      if (state.lat !== null && state.lon !== null && !state.v92Result) {
        runApiPredict();
      }
    });

    clearDateBtn.addEventListener('click', function () {
      dateInput.value = '';
      state.date = '';
      loadHotspots('');
      if (state.lat !== null && state.lon !== null && !state.v92Result) {
        runApiPredict();
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

  function formatDateSafe(rawDate) {
    if (!rawDate) { return new Date().toLocaleString('vi-VN'); }
    var d = new Date(rawDate);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('vi-VN');
    }
    return String(rawDate);
  }

  function makeDiv(cls, text) {
    var d = document.createElement('div');
    if (cls) { d.className = cls; }
    if (text) { d.textContent = text; }
    return d;
  }

  function buildFallbackContributions(data) {
    var feat = data.features || {};
    var items = [
      { label: 'Mưa tích lũy 15 ngày', value: feat.rain_15d_mm, unit: 'mm', weight: Number(feat.rain_15d_mm) || 20 },
      { label: 'Độ dốc địa hình', value: feat.slope_max_deg, unit: '°', weight: Number(feat.slope_max_deg) || 15 },
      { label: 'Mưa kích hoạt 3 ngày', value: feat.rain_3d_mm, unit: 'mm', weight: Number(feat.rain_3d_mm) || 12 },
      { label: 'Độ ẩm đất nền', value: feat.soil_moisture_pct, unit: '%', weight: Number(feat.soil_moisture_pct) || 10 },
      { label: 'Chỉ số thực vật NDVI', value: feat.ndvi, unit: '', weight: (Number(feat.ndvi) || 0.5) * 20 }
    ].filter(function (x) { return x.value !== undefined && x.value !== null; });

    var total = items.reduce(function (s, x) { return s + Math.max(0.1, x.weight); }, 0) || 1;
    return items.map(function (x) {
      return {
        label: x.label,
        value: x.value,
        unit: x.unit,
        contribution_pct: Number(((Math.max(0.1, x.weight) / total) * 100).toFixed(1))
      };
    });
  }

  var LEVEL_NAME = { low: 'Thấp', mid: 'Trung bình', high: 'Cao' };

  function renderV92RightPanel(res) {
    var slot = document.getElementById('ga-risk-slot');
    if (!slot) { return; }
    slot.innerHTML = '';
    if (!res) {
      slot.style.display = 'none';
      return;
    }
    slot.style.display = 'block';
    slot.className = 'ga-risk';

    var head = makeDiv('ga-risk-head ga-risk-' + (res.level || 'low'));
    head.appendChild(makeDiv('ga-risk-label', 'Nguy cơ sạt lở'));
    head.appendChild(makeDiv('ga-risk-level', LEVEL_NAME[res.level] || ''));
    slot.appendChild(head);

    var radiusFactor = state.radius > 1000 ? Math.min(1, 1 + (state.radius - 1000) * 0.00004) : 1;
    var probPoint = Math.min(1, Math.max(0, Number(res.probability) || 0));
    var probMax = Math.min(1, Math.max(probPoint, Number(res.probabilityMax || probPoint) * radiusFactor));

    slot.appendChild(row('Xác suất cao nhất trong bán kính', (probMax * 100).toFixed(1) + '%'));
    slot.appendChild(row('Xác suất tại điểm chọn', (probPoint * 100).toFixed(1) + '%'));

    if (res.factors && res.factors.length) {
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
        var valStr = (typeof f.value === 'number' && !f.unit) ? f.value.toFixed(2) : f.value;
        top.appendChild(makeDiv('ga-why-val', valStr + (f.unit ? ' ' + f.unit : '')));
        item.appendChild(top);
        var track = makeDiv('ga-why-track');
        var fill = makeDiv('ga-why-fill');
        fill.style.width = Math.max(4, Math.round(f.contribution / max * 100)) + '%';
        track.appendChild(fill);
        item.appendChild(track);
        item.appendChild(makeDiv('ga-why-pct', Math.round(f.contribution * 100) + '% mức đóng góp'));
        box.appendChild(item);
      });
      box.appendChild(makeDiv('ga-why-note', res.summaryReason || 'Thanh dài hơn nghĩa là yếu tố đó góp nhiều hơn vào kết quả.'));
      slot.appendChild(box);
    }

    slot.appendChild(row('Cập nhật', formatDateSafe(res.updatedAt)));
    if (res.source) {
      slot.appendChild(row('Nguồn', res.source));
    }
  }

  function renderApiPredictionResult(data) {
    var slot = document.getElementById('ga-risk-slot');
    if (!slot) { return; }
    slot.innerHTML = '';
    slot.style.display = 'block';
    slot.className = 'ga-risk';

    var tier = (data.tier_code || '').toLowerCase();
    var riskCls = (tier === 'red' || data.risk_level === 'Cao') ? 'high'
      : ((tier === 'yellow' || data.risk_level === 'Trung bình') ? 'mid' : 'low');

    var head = makeDiv('ga-risk-head ga-risk-' + riskCls);
    head.appendChild(makeDiv('ga-risk-label', 'Nguy cơ sạt lở'));
    head.appendChild(makeDiv('ga-risk-level', data.risk_level || ''));
    slot.appendChild(head);

    if (data.prob_max_radius_pct !== undefined && data.prob_max_radius_pct !== null) {
      slot.appendChild(row('Xác suất cao nhất trong bán kính', Number(data.prob_max_radius_pct).toFixed(1) + '%'));
    }
    if (data.prob_point_pct !== undefined && data.prob_point_pct !== null) {
      slot.appendChild(row('Xác suất tại điểm chọn', Number(data.prob_point_pct).toFixed(1) + '%'));
    }

    var contribs = (Array.isArray(data.contributions) && data.contributions.length)
      ? data.contributions
      : buildFallbackContributions(data);

    if (contribs.length) {
      var box = makeDiv('ga-why');
      box.appendChild(makeDiv('ga-why-title', 'Vì sao?'));
      var sorted = contribs.slice().sort(function (a, b) {
        return (Number(b.contribution_pct) || 0) - (Number(a.contribution_pct) || 0);
      });
      var maxPct = sorted[0].contribution_pct || 1;
      sorted.forEach(function (c) {
        var pct = Number(c.contribution_pct) || 0;
        var item = makeDiv('ga-why-item');
        var top = makeDiv('ga-why-top');
        top.appendChild(makeDiv('ga-why-name', c.label || c.feature || 'Yếu tố'));
        top.appendChild(makeDiv('ga-why-val', (c.value !== undefined && c.value !== null) ? (c.value + (c.unit ? ' ' + c.unit : '')) : ''));
        item.appendChild(top);
        var track = makeDiv('ga-why-track');
        var fill = makeDiv('ga-why-fill');
        fill.style.width = Math.max(4, Math.round(pct / maxPct * 100)) + '%';
        track.appendChild(fill);
        item.appendChild(track);
        item.appendChild(makeDiv('ga-why-pct', pct.toFixed(1) + '% mức đóng góp'));
        box.appendChild(item);
      });
      if (data.recommendation) {
        box.appendChild(makeDiv('ga-why-note', 'Khuyến nghị: ' + data.recommendation));
      }
      slot.appendChild(box);
    }

    slot.appendChild(row('Cập nhật', formatDateSafe(data.updated_at)));
    if (data.source) {
      slot.appendChild(row('Nguồn', data.source));
    }
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

    var riskSlot = document.createElement('div');
    riskSlot.id = 'ga-risk-slot';
    resultBody.appendChild(riskSlot);

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ga-clear';
    clear.textContent = 'Xóa điểm đã chọn';
    clear.addEventListener('click', clearPoint);
    resultBody.appendChild(clear);

    if (state.v92Result) {
      renderV92RightPanel(state.v92Result);
    } else if (statusText) {
      riskSlot.className = 'ga-pending';
      riskSlot.textContent = statusText;
    } else {
      riskSlot.style.display = 'none';
    }
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
    var bodyJson = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(bodyJson.detail || 'Lỗi khi gọi API dự báo');
    }
    return bodyJson;
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
            setPoint(lat, lon, title, true, null);
          });
          cm.addTo(hotspotsLayer);
        });
      })
      .catch(function (err) {
        console.warn('GEOALERT hotspots:', err);
      });
  }

  function runApiPredict() {
    if (state.lat === null || state.lon === null) { return; }
    var token = ++predictToken;
    renderSelection('Đang phân tích dữ liệu...');

    fetchPredict({
      lat: state.lat,
      lon: state.lon,
      radiusM: state.radius,
      dateStr: state.date
    })
      .then(function (res) {
        if (token !== predictToken) { return; }
        renderApiPredictionResult(res);
      })
      .catch(function (err) {
        if (token !== predictToken) { return; }
        var slot = document.getElementById('ga-risk-slot');
        if (slot) {
          slot.style.display = 'block';
          slot.className = 'ga-pending';
          slot.textContent = err.message || 'Không thể lấy kết quả dự báo lúc này.';
        }
      });
  }

  function setPoint(lat, lon, label, shouldFit, v92Result) {
    if (!tinhBounds.contains([lat, lon])) {
      emptyMessage('Vị trí này nằm ngoài khu vực Lâm Đồng mà GEOALERT hỗ trợ.');
      return;
    }
    state.lat = Number(lat);
    state.lon = Number(lon);
    state.label = label || '';
    state.v92Result = v92Result || null;

    if (marker) { map.removeLayer(marker); }
    marker = L.marker([state.lat, state.lon], { icon: pinIcon }).addTo(map);
    var tip = document.createElement('div');
    tip.textContent = state.label || 'Điểm bạn chọn';
    marker.bindPopup(tip);

    drawCircle();
    if (state.v92Result) {
      renderSelection('');
      if (shouldFit) { fitCircle(); }
    } else {
      renderSelection('Đang phân tích dữ liệu...');
      if (shouldFit) { fitCircle(); }
      runApiPredict();
    }
  }

  // Luôn cho phép nạp kết quả từ bảng dự đoán V9.2 lên bản đồ và cột phải
  window.setGeoAlertV92Point = function (lat, lon, label, v92Result) {
    predictToken++;
    setPoint(Number(lat), Number(lon), label, true, v92Result);
  };
  setGeoAlertV92Point = window.setGeoAlertV92Point;

  window.updateGeoAlertV92RightPanel = function (v92Result) {
    state.v92Result = v92Result || null;
    if (state.lat !== null && state.lon !== null) {
      renderV92RightPanel(state.v92Result);
    }
  };
  updateGeoAlertV92RightPanel = window.updateGeoAlertV92RightPanel;

  function clearPoint() {
    predictToken++;
    if (marker) { map.removeLayer(marker); marker = null; }
    if (circle) { map.removeLayer(circle); circle = null; }
    state.lat = null;
    state.lon = null;
    state.label = '';
    state.v92Result = null;
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
          setPoint(lat, lon, 'Vị trí hiện tại của bạn', true, null);
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
    setPoint(e.latlng.lat, e.latlng.lng, '', false, null);
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
        fitCircle();
        if (state.v92Result) {
          renderSelection('');
        } else {
          runApiPredict();
        }
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
            setPoint(coords[1], coords[0], label, true, null);
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