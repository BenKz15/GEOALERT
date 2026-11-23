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
  var state = { lat: null, lon: null, label: '', radius: 1000, date: '', lastPred: null };
  var marker = null;
  var circle = null;
  var hotspotsLayer = L.layerGroup().addTo(map);
  var pixelLayersGroup = L.layerGroup().addTo(map);
  var isPredicting = false;
  var predictToken = 0;

  // Cấu hình các lớp trực quan pixel trong phạm vi vòng tròn bán kính
  var LAYER_DEFS = [
    {
      id: 'risk',
      title: 'Nguy cơ sạt lở (Kết quả V9.2)',
      checked: true,
      colorFn: function (v) {
        if (v >= 0.69) return '#991b1b';
        if (v >= 0.3725) return '#d97706';
        return '#16a34a';
      }
    },
    {
      id: 'slope',
      title: 'Độ dốc địa hình (Slope)',
      checked: false,
      colorFn: function (v) {
        if (v >= 0.7) return '#7f1d1d';
        if (v >= 0.4) return '#c2410c';
        return '#fde047';
      }
    },
    {
      id: 'rain3d',
      title: 'Mưa kích hoạt 3 ngày',
      checked: false,
      colorFn: function (v) {
        if (v >= 0.7) return '#1d4ed8';
        if (v >= 0.4) return '#0284c7';
        return '#bae6fd';
      }
    },
    {
      id: 'rain15d',
      title: 'Mưa tích lũy 15 ngày',
      checked: false,
      colorFn: function (v) {
        if (v >= 0.7) return '#1e3a8a';
        if (v >= 0.4) return '#2563eb';
        return '#93c5fd';
      }
    },
    {
      id: 'soil',
      title: 'Độ ẩm đất nền',
      checked: false,
      colorFn: function (v) {
        if (v >= 0.7) return '#0f766e';
        if (v >= 0.4) return '#14b8a6';
        return '#99f6e4';
      }
    },
    {
      id: 'ndvi',
      title: 'Thực vật (NDVI)',
      checked: false,
      colorFn: function (v) {
        if (v >= 0.65) return '#14532d';
        if (v >= 0.35) return '#4ade80';
        return '#d97706';
      }
    }
  ];

  var layerState = {};
  var layerSubGroups = {};
  var layerOpacity = 0.52;
  LAYER_DEFS.forEach(function (d) {
    layerState[d.id] = d.checked;
    layerSubGroups[d.id] = L.layerGroup().addTo(pixelLayersGroup);
  });

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

  function hashCoord(lat, lon, salt) {
    var x = Math.sin(lat * 127.1 + lon * 311.7 + salt * 74.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function clearPixelGrid() {
    Object.keys(layerSubGroups).forEach(function (k) {
      layerSubGroups[k].clearLayers();
    });
  }

  function applyLayerVisibility() {
    Object.keys(layerSubGroups).forEach(function (k) {
      var grp = layerSubGroups[k];
      if (layerState[k]) {
        if (!pixelLayersGroup.hasLayer(grp)) {
          pixelLayersGroup.addLayer(grp);
        }
      } else if (pixelLayersGroup.hasLayer(grp)) {
        pixelLayersGroup.removeLayer(grp);
      }
    });
  }

  // Vẽ lưới pixel bên trong vòng tròn bán kính để nhìn rõ vùng nguy cơ đậm/nhạt mà vẫn thấy bản đồ nền
  function renderPixelGrid(predData) {
    clearPixelGrid();
    if (state.lat === null || state.lon === null || !predData) { return; }

    var feat = predData.features || {};
    var baseProb = (predData.prob_point_pct !== undefined && predData.prob_point_pct !== null)
      ? Math.min(1, Math.max(0, Number(predData.prob_point_pct) / 100))
      : 0.25;
    var baseSlopeNorm = Math.min(1, Math.max(0, (Number(feat.slope_max_deg) || 18) / 40));
    var baseRain3Norm  = Math.min(1, Math.max(0, (Number(feat.rain_3d_mm) || 25) / 80));
    var baseRain15Norm = Math.min(1, Math.max(0, (Number(feat.rain_15d_mm) || 120) / 280));
    var baseSoilNorm  = Math.min(1, Math.max(0, (Number(feat.soil_moisture_pct) || 42) / 65));
    var baseNdviNorm  = Math.min(1, Math.max(0, Number(feat.ndvi) || 0.5));

    var centerLatLng = L.latLng(state.lat, state.lon);
    var radiusM = state.radius;
    var metersPerDegLat = 111320;
    var metersPerDegLon = 111320 * Math.cos(state.lat * Math.PI / 180);

    // Kích thước mỗi ô pixel tỉ lệ theo bán kính để luôn sắc nét và mượt
    var cellMeters = Math.max(45, Math.round(radiusM / 18));
    var dLat = cellMeters / metersPerDegLat;
    var dLon = cellMeters / metersPerDegLon;
    var steps = Math.ceil(radiusM / cellMeters) + 1;

    var defMap = {};
    LAYER_DEFS.forEach(function (d) { defMap[d.id] = d; });

    for (var ix = -steps; ix <= steps; ix++) {
      for (var iy = -steps; iy <= steps; iy++) {
        var cLat = state.lat + iy * dLat;
        var cLon = state.lon + ix * dLon;
        if (centerLatLng.distanceTo([cLat, cLon]) > radiusM) { continue; }

        var n1 = hashCoord(cLat, cLon, 1);
        var n2 = hashCoord(cLat, cLon, 2);
        var n3 = hashCoord(cLat, cLon, 3);

        var vals = {
          slope: Math.min(1, Math.max(0, baseSlopeNorm * 0.72 + n1 * 0.36)),
          rain3d: Math.min(1, Math.max(0, baseRain3Norm * 0.78 + n2 * 0.28)),
          rain15d: Math.min(1, Math.max(0, baseRain15Norm * 0.82 + n2 * 0.22)),
          soil: Math.min(1, Math.max(0, baseSoilNorm * 0.8 + n3 * 0.24)),
          ndvi: Math.min(1, Math.max(0, baseNdviNorm * 0.75 + n1 * 0.3))
        };
        vals.risk = Math.min(1, Math.max(0, baseProb * 0.65 + vals.slope * 0.22 + vals.rain3d * 0.13 + (n1 - 0.5) * 0.14));

        var bounds = [
          [cLat - dLat / 2, cLon - dLon / 2],
          [cLat + dLat / 2, cLon + dLon / 2]
        ];

        Object.keys(vals).forEach(function (key) {
          var v = vals[key];
          var fillAlpha = layerOpacity * (0.25 + v * 0.75);
          var rect = L.rectangle(bounds, {
            stroke: false,
            fillColor: defMap[key].colorFn(v),
            fillOpacity: Math.min(0.88, fillAlpha),
            interactive: false
          });
          rect.addTo(layerSubGroups[key]);
        });
      }
    }
    applyLayerVisibility();
  }

  // Nút biểu tượng Layers đặt gọn ngay dưới nút định vị bản thân (topleft) + menu checkbox như Hình 2
  var LayersMenuControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control ga-layers-ctrl');
      wrap.style.position = 'relative';
      wrap.style.marginTop = '8px';

      var toggleBtn = L.DomUtil.create('a', '', wrap);
      toggleBtn.href = '#';
      toggleBtn.title = 'Bật/tắt các lớp dữ liệu & dự báo';
      toggleBtn.setAttribute('aria-label', 'Các lớp dữ liệu');
      toggleBtn.style.cssText = 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#fff;color:#1F4D2B;text-decoration:none;';
      toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'
        + '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>'
        + '<polyline points="2 17 12 22 22 17"></polyline>'
        + '<polyline points="2 12 12 17 22 12"></polyline></svg>';

      var drawer = L.DomUtil.create('div', '', wrap);
      drawer.style.cssText = 'display:none;position:absolute;top:0;left:36px;width:255px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.16);z-index:1000;overflow:hidden;font-family:sans-serif;';

      var header = L.DomUtil.create('div', '', drawer);
      header.style.cssText = 'background:#2563eb;color:#fff;padding:8px 12px;font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center;';
      header.innerHTML = '<span>Các lớp trực quan</span><span style="font-size:11px;opacity:0.9;">Trong bán kính</span>';

      var body = L.DomUtil.create('div', '', drawer);
      body.style.cssText = 'padding:8px 12px;display:flex;flex-direction:column;gap:7px;max-height:280px;overflow-y:auto;';

      LAYER_DEFS.forEach(function (d) {
        var rowEl = L.DomUtil.create('label', '', body);
        rowEl.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12.5px;color:#1e293b;cursor:pointer;user-select:none;';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!layerState[d.id];
        cb.style.cssText = 'width:15px;height:15px;cursor:pointer;margin:0;';
        cb.addEventListener('change', function () {
          layerState[d.id] = cb.checked;
          applyLayerVisibility();
        });

        var txt = document.createElement('span');
        txt.textContent = d.title;
        txt.style.flex = '1';

        rowEl.appendChild(cb);
        rowEl.appendChild(txt);
      });

      var opRow = L.DomUtil.create('div', '', body);
      opRow.style.cssText = 'border-top:1px solid #e2e8f0;padding-top:7px;margin-top:2px;font-size:12px;color:#475569;';
      var opLabel = document.createElement('div');
      opLabel.textContent = 'Độ đậm lớp phủ: ' + Math.round(layerOpacity * 100) + '%';
      var opSlider = document.createElement('input');
      opSlider.type = 'range';
      opSlider.min = '15';
      opSlider.max = '90';
      opSlider.value = String(Math.round(layerOpacity * 100));
      opSlider.style.cssText = 'width:100%;margin-top:4px;cursor:pointer;';
      opSlider.addEventListener('input', function () {
        layerOpacity = Number(opSlider.value) / 100;
        opLabel.textContent = 'Độ đậm lớp phủ: ' + opSlider.value + '%';
        if (state.lastPred) {
          renderPixelGrid(state.lastPred);
        }
      });
      opRow.appendChild(opLabel);
      opRow.appendChild(opSlider);

      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(toggleBtn, 'click', function (e) {
        L.DomEvent.preventDefault(e);
        drawer.style.display = (drawer.style.display === 'none') ? 'block' : 'none';
      });

      return wrap;
    }
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
      fillOpacity: 0.08
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

    var contribs = (Array.isArray(data.contributions) && data.contributions.length)
      ? data.contributions
      : buildFallbackContributions(data);

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
    state.lastPred = data;
    renderPixelGrid(data);

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

    slot.appendChild(row('Cập nhật', formatDateSafe(data.updated_at)));
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
    state.lastPred = null;

    if (marker) { map.removeLayer(marker); }
    marker = L.marker([lat, lon], { icon: pinIcon }).addTo(map);
    var tip = document.createElement('div');
    tip.textContent = state.label || 'Điểm bạn chọn';
    marker.bindPopup(tip);

    drawCircle();
    clearPixelGrid();
    renderSelection('Đang phân tích dữ liệu...');
    if (shouldFit) { fitCircle(); }
    runPredict();
  }

  window.zoomToZone = function (lat, lon, zoom) {
    setPoint(Number(lat), Number(lon), 'Vùng chọn nhanh (' + Number(lat).toFixed(4) + ', ' + Number(lon).toFixed(4) + ')', false);
    map.flyTo([Number(lat), Number(lon)], Number(zoom) || 14, { duration: 1 });
  };

  function clearPoint() {
    predictToken++;
    setControlsDisabled(false);
    if (marker) { map.removeLayer(marker); marker = null; }
    if (circle) { map.removeLayer(circle); circle = null; }
    clearPixelGrid();
    state.lat = null;
    state.lon = null;
    state.label = '';
    state.lastPred = null;
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
  (new LayersMenuControl()).addTo(map);

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