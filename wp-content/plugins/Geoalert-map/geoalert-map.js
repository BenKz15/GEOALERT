// Biến toàn cục kết nối bản đồ với 4 nút chọn nhanh và bảng 12 điểm kiểm chứng V9.2
var globalGeoAlertMap = null;
var zoomToZone = null;
var runGeoAlertZoneSelect = null;
var runGeoAlertVerificationPoint = null;

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

  // Hai lớp nền: Bản đồ đường phố OSM & Ảnh vệ tinh Esri WorldImagery
  var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '&copy; OpenStreetMap contributors'
  });
  var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 17,
    attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics'
  });
  osmLayer.addTo(map);

  L.control.layers(
    {
      'Bản đồ đường phố (OSM)': osmLayer,
      'Ảnh vệ tinh (Esri)': satLayer
    },
    {},
    { position: 'topright', collapsed: true }
  ).addTo(map);

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  var MAX_RADIUS = 3000;
  var state = {
    lat: null,
    lon: null,
    label: '',
    radius: 1000,
    date: ''
  };

  var marker = null;
  var circle = null;
  var maxRadiusMarker = null;
  var maxRadiusLine = null;
  var hotspotsLayer = L.layerGroup().addTo(map);

  var isPredicting = false;
  var predictToken = 0;
  var isLoadingOverlay = false;
  var activeOverlays = { hotspot: null, zoning: null, ndvi: null };
  var overlayState = { hotspot: false, zoning: false, ndvi: false };

  var input = document.getElementById('ga-search-input');
  var btn = document.getElementById('ga-search-btn');
  var list = document.getElementById('ga-search-results');
  var resultBody = document.getElementById('ga-result-body');
  var radiusBtns = document.querySelectorAll('#ga-radius-btns button');

  var cbHotspot = document.getElementById('ga-layer-hotspot');
  var cbZoning  = document.getElementById('ga-layer-zoning');
  var cbNdvi    = document.getElementById('ga-layer-ndvi');
  var overlayStatusEl = document.getElementById('ga-overlay-status');

  // Bộ chọn ngày dự báo (quá khứ & hiện tại)
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
        runPredictAndSyncOverlays();
      } else {
        refreshActiveOverlays();
      }
    });

    clearDateBtn.addEventListener('click', function () {
      dateInput.value = '';
      state.date = '';
      loadHotspots('');
      if (state.lat !== null && state.lon !== null) {
        runPredictAndSyncOverlays();
      } else {
        refreshActiveOverlays();
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

  // Định dạng giờ VN an toàn (chống Invalid Date)
  function formatVnUpdatedAt(isoStr) {
    var d = isoStr ? new Date(isoStr) : new Date();
    var safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
    return (
      safeDate.toLocaleTimeString('vi-VN', { hour12: false }) +
      ' ' +
      safeDate.toLocaleDateString('vi-VN')
    );
  }

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

  function makeDiv(cls, text) {
    var d = document.createElement('div');
    if (cls) { d.className = cls; }
    if (text) { d.textContent = text; }
    return d;
  }

  // Vẽ / xóa ghim phụ chỉ đúng điểm nguy cơ cao nhất trong bán kính trên Leaflet
  function clearMaxRadiusMarker() {
    if (maxRadiusMarker) { map.removeLayer(maxRadiusMarker); maxRadiusMarker = null; }
    if (maxRadiusLine) { map.removeLayer(maxRadiusLine); maxRadiusLine = null; }
  }

  function updateMaxRadiusMarker(data) {
    clearMaxRadiusMarker();
    var mr = data && data.max_in_radius;
    if (!mr || mr.distance_m < 25 || mr.prob_pct < 50) { return; }

    var pinColor = mr.tier_code === 'red' ? '#dc2626' : '#eab308';
    maxRadiusLine = L.polyline(
      [[data.lat, data.lon], [mr.lat, mr.lon]],
      { color: pinColor, weight: 2, dashArray: '5, 6', opacity: 0.9 }
    ).addTo(map);

    maxRadiusMarker = L.circleMarker([mr.lat, mr.lon], {
      radius: 7,
      color: '#111827',
      weight: 1.5,
      fillColor: pinColor,
      fillOpacity: 0.95
    })
      .bindTooltip(
        'Điểm nguy cơ cao nhất trong bán kính: ' + mr.prob_pct + '% (' + mr.risk_level + ')<br>' +
        mr.location_text + ' — Dốc ' + mr.slope_deg + '°',
        { direction: 'top' }
      )
      .addTo(map);
  }

  // Render khối giải thích "Vì sao?"
  function renderWhySection(containerEl, data) {
    if (!containerEl || !data) { return; }
    var cObj = data.contributions || {};
    var feat = data.features || {};
    var factors = (Array.isArray(data.why_factors) && data.why_factors.length > 0)
      ? data.why_factors
      : [
          { label: 'Độ dốc địa hình (30m)', contribution_pct: cObj.slope !== undefined ? cObj.slope : 25, value: feat.slope_point_deg !== undefined ? feat.slope_point_deg : '-', unit: '°' },
          { label: 'Mưa 15 ngày (CHIRPS)', contribution_pct: cObj.rain_15d !== undefined ? cObj.rain_15d : 25, value: feat.rain_15d_mm !== undefined ? feat.rain_15d_mm : '-', unit: 'mm' },
          { label: 'Mưa 3 ngày (GPM)', contribution_pct: cObj.rain_3d !== undefined ? cObj.rain_3d : 15, value: feat.rain_3d_mm !== undefined ? feat.rain_3d_mm : '-', unit: 'mm' },
          { label: 'Độ ẩm đất nền', contribution_pct: cObj.soil_moisture !== undefined ? cObj.soil_moisture : 20, value: feat.soil_moisture_pct !== undefined ? feat.soil_moisture_pct : '-', unit: '%' },
          { label: 'Thảm phủ thực vật (NDVI)', contribution_pct: cObj.ndvi !== undefined ? cObj.ndvi : 15, value: feat.ndvi !== undefined ? feat.ndvi : '-', unit: '' }
        ].sort(function (a, b) { return Number(b.contribution_pct) - Number(a.contribution_pct); });

    var box = makeDiv('ga-why');
    box.appendChild(makeDiv('ga-why-title', 'Vì sao có mức nguy cơ này?'));

    if (data.why_summary) {
      var sumP = document.createElement('p');
      sumP.className = 'why-summary';
      sumP.textContent = data.why_summary;
      box.appendChild(sumP);
    }

    factors.forEach(function (f) {
      var pct = Math.min(Math.max(Number(f.contribution_pct) || 0, 0), 100);
      var item = makeDiv('ga-why-item');
      var top = makeDiv('ga-why-top');
      top.appendChild(makeDiv('ga-why-name', f.label));
      top.appendChild(makeDiv('ga-why-val', f.value + (f.unit || '') + ' (' + pct + '%)'));
      item.appendChild(top);

      var track = makeDiv('ga-why-track');
      var fill = makeDiv('ga-why-fill');
      fill.style.width = Math.max(4, Math.round(pct)) + '%';
      track.appendChild(fill);
      item.appendChild(track);
      box.appendChild(item);
    });

    containerEl.appendChild(box);
  }

  function renderPredictionResult(data) {
    var slot = document.getElementById('ga-risk-slot');
    if (!slot) { return; }
    slot.innerHTML = '';
    slot.className = 'ga-risk';

    var tier = (data.tier_code || '').toLowerCase();
    var isWater = Boolean(data.is_water) || tier === 'water';
    var probPt = (data.prob_point_pct !== undefined && data.prob_point_pct !== null)
      ? Number(data.prob_point_pct).toFixed(1)
      : '0.0';

    var headCls = 'ga-risk-low';
    var badgeText = (data.risk_level || 'Thấp') + ' — ' + probPt + '%';
    if (isWater) {
      headCls = 'ga-risk-water';
      badgeText = 'Mặt nước — 0%';
    } else if (tier === 'red' || data.risk_level === 'Cao') {
      headCls = 'ga-risk-high';
    } else if (tier === 'yellow' || data.risk_level === 'Trung bình') {
      headCls = 'ga-risk-mid';
    }

    var head = makeDiv('ga-risk-head ' + headCls);
    head.appendChild(makeDiv('ga-risk-label', 'Nguy cơ sạt lở tại điểm'));
    head.appendChild(makeDiv('ga-risk-level', badgeText));
    slot.appendChild(head);

    if (data.recommendation) {
      slot.appendChild(makeDiv('ga-rec-box', data.recommendation));
    }

    // Khối phụ Tham khảo trong bán kính (max_in_radius)
    var mr = data.max_in_radius;
    if (mr) {
      var isHighRef = Number(mr.prob_pct) >= 50;
      var refBox = makeDiv('ga-max-ref' + (isHighRef ? '' : ' is-safe'));
      refBox.appendChild(makeDiv('ga-max-ref-title', 'Tham khảo trong bán kính'));
      refBox.appendChild(makeDiv('', 'Cao nhất trong bán kính: ' + mr.prob_pct + '% (' + mr.risk_level + ')'));
      refBox.appendChild(makeDiv('', 'Vị trí: ' + mr.location_text + ' — Dốc ' + mr.slope_deg + '° (' + Number(mr.lat).toFixed(5) + ', ' + Number(mr.lon).toFixed(5) + ')'));
      slot.appendChild(refBox);
    } else if (data.prob_max_radius_pct !== undefined && data.prob_max_radius_pct !== null) {
      slot.appendChild(row('Cao nhất trong bán kính', Number(data.prob_max_radius_pct).toFixed(1) + '%'));
    }

    updateMaxRadiusMarker(data);
    renderWhySection(slot, data);

    slot.appendChild(row('Cập nhật', formatVnUpdatedAt(data.updated_at)));
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
    resultBody.appendChild(row('Diện tích khảo sát', area.toFixed(2) + ' km²'));

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

  function syncOverlayCheckboxes() {
    if (cbHotspot) { cbHotspot.checked = overlayState.hotspot; }
    if (cbZoning)  { cbZoning.checked  = overlayState.zoning; }
    if (cbNdvi)    { cbNdvi.checked    = overlayState.ndvi; }
  }

  function setOverlayStatus(text) {
    if (overlayStatusEl) {
      overlayStatusEl.textContent = text || '';
    }
  }

  // Bật/tắt 3 lớp bản đồ từ POST /overlay (hotspot & zoning loại trừ nhau)
  async function toggleMapOverlay(layerName, isChecked) {
    overlayState[layerName] = Boolean(isChecked);

    if (!isChecked) {
      if (activeOverlays[layerName]) {
        map.removeLayer(activeOverlays[layerName]);
        activeOverlays[layerName] = null;
      }
      syncOverlayCheckboxes();
      setOverlayStatus('');
      return;
    }

    if (layerName === 'hotspot' && (overlayState.zoning || activeOverlays.zoning)) {
      overlayState.zoning = false;
      if (activeOverlays.zoning) {
        map.removeLayer(activeOverlays.zoning);
        activeOverlays.zoning = null;
      }
    } else if (layerName === 'zoning' && (overlayState.hotspot || activeOverlays.hotspot)) {
      overlayState.hotspot = false;
      if (activeOverlays.hotspot) {
        map.removeLayer(activeOverlays.hotspot);
        activeOverlays.hotspot = null;
      }
    }
    syncOverlayCheckboxes();

    var center = (state.lat !== null && state.lon !== null)
      ? { lat: state.lat, lon: state.lon }
      : map.getCenter();

    if (isLoadingOverlay) { return; }
    isLoadingOverlay = true;
    setOverlayStatus('Đang tải lớp bản đồ...');
    try {
      var res = await fetch(API_BASE + '/overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: Number(center.lat),
        lon: Number(center.lng !== undefined ? center.lng : center.lon),
        radius_m: Number(state.radius),
        date: state.date || null,
        layer: layerName
      })
    });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.detail || ('Không tải được lớp bản đồ ' + layerName));
      }
      var data = await res.json();
      if (!overlayState[layerName]) { return; }

      if (activeOverlays[layerName]) {
        map.removeLayer(activeOverlays[layerName]);
      }
      var ov = L.imageOverlay(data.image_base64, data.bounds, {
        opacity: layerName === 'ndvi' ? 0.65 : 0.92,
        interactive: false
      }).addTo(map);

      if (layerName !== 'ndvi') {
        ov.bringToFront();
      } else {
        ov.bringToBack();
      }
      activeOverlays[layerName] = ov;

      if (data.stats && data.stats.hotspot_pct !== undefined && layerName === 'hotspot') {
        setOverlayStatus('Điểm nóng ưu tiên: ' + data.stats.hotspot_pct + '% diện tích (' + data.stats.hotspot_pixels + ' pixel 30m)');
      } else {
        setOverlayStatus('');
      }
    } catch (e) {
      overlayState[layerName] = false;
      syncOverlayCheckboxes();
      setOverlayStatus(e.message || 'Lỗi tải lớp bản đồ.');
    } finally {
      isLoadingOverlay = false;
    }
  }

  async function refreshActiveOverlays() {
    if (overlayState.ndvi) {
      await toggleMapOverlay('ndvi', true);
    }
    if (overlayState.hotspot) {
      await toggleMapOverlay('hotspot', true);
    } else if (overlayState.zoning) {
      await toggleMapOverlay('zoning', true);
    }
  }

  if (cbHotspot) {
    cbHotspot.addEventListener('change', function () {
      toggleMapOverlay('hotspot', cbHotspot.checked);
    });
  }
  if (cbZoning) {
    cbZoning.addEventListener('change', function () {
      toggleMapOverlay('zoning', cbZoning.checked);
    });
  }
  if (cbNdvi) {
    cbNdvi.addEventListener('change', function () {
      toggleMapOverlay('ndvi', cbNdvi.checked);
    });
  }

  function setControlsDisabled(disabled) {
    isPredicting = disabled;
    if (btn) { btn.disabled = disabled; }
    if (dateInput) { dateInput.disabled = disabled; }
    radiusBtns.forEach(function (b) { b.disabled = disabled; });
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

  function runPredict() {
    if (state.lat === null || state.lon === null) { return; }
    var token = ++predictToken;
    setControlsDisabled(true);
    clearMaxRadiusMarker();
    renderSelection('Đang phân tích dữ liệu...');

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

  function runPredictAndSyncOverlays() {
    runPredict();
    refreshActiveOverlays();
  }

  function setPoint(lat, lon, label, shouldFit, zoomLevel) {
    if (!tinhBounds.contains([lat, lon])) {
      emptyMessage('Vị trí này nằm ngoài khu vực Lâm Đồng mà GEOALERT hỗ trợ.');
      return;
    }
    state.lat = Number(lat);
    state.lon = Number(lon);
    state.label = label || '';

    if (marker) { map.removeLayer(marker); }
    marker = L.marker([state.lat, state.lon], { icon: pinIcon }).addTo(map);
    var tip = document.createElement('div');
    tip.textContent = state.label || 'Điểm bạn chọn';
    marker.bindPopup(tip);

    drawCircle();
    if (zoomLevel) {
      map.flyTo([state.lat, state.lon], zoomLevel, { duration: 0.9 });
    } else if (shouldFit) {
      fitCircle();
    }
    runPredictAndSyncOverlays();
  }

  // Kết nối 4 nút tắt nhanh trên thanh đầu trang
  window.runGeoAlertZoneSelect = function (lat, lon, zoom, label) {
    if (isPredicting) { return; }
    setPoint(Number(lat), Number(lon), label || 'Khu vực chọn nhanh', false, Number(zoom) || 15);
  };
  runGeoAlertZoneSelect = window.runGeoAlertZoneSelect;
  window.zoomToZone = window.runGeoAlertZoneSelect;
  zoomToZone = window.runGeoAlertZoneSelect;

  // Kết nối dropdown 12 điểm kiểm chứng chuẩn thực địa V9.2
  window.runGeoAlertVerificationPoint = function (item) {
    if (!item || isPredicting) { return; }
    if (dateInput) {
      dateInput.value = item.date || '';
    }
    state.date = item.date || '';
    loadHotspots(state.date);
    setPoint(Number(item.lat), Number(item.lon), item.label, false, 15);
  };
  runGeoAlertVerificationPoint = window.runGeoAlertVerificationPoint;

  function clearPoint() {
    predictToken++;
    setControlsDisabled(false);
    clearMaxRadiusMarker();
    if (marker) { map.removeLayer(marker); marker = null; }
    if (circle) { map.removeLayer(circle); circle = null; }
    state.lat = null;
    state.lon = null;
    state.label = '';
    if (input) { input.value = ''; }
    emptyMessage('Bấm lên bản đồ, chọn chấm trọng điểm hoặc chọn mốc kiểm chứng để xem mức nguy cơ.');
  }

  function tierColor(tier) {
    var t = (tier || '').toLowerCase();
    if (t === 'red') { return '#dc2626'; }
    if (t === 'yellow') { return '#d97706'; }
    return '#16a34a';
  }

  function loadHotspots(dateStr) {
    var query = dateStr ? ('?date=' + encodeURIComponent(dateStr)) : '';
    fetch(API_BASE + '/hotspots' + query)
      .then(function (res) {
        if (!res.ok) { throw new Error('Không tải được danh sách điểm trọng điểm'); }
        return res.json();
      })
      .then(function (data) {
        hotspotsLayer.clearLayers();
        var items = Array.isArray(data) ? data : (data.hotspots || data.items || []);
        items.forEach(function (pt) {
          var lat = Number(pt.lat !== undefined ? pt.lat : pt.latitude);
          var lon = Number(pt.lon !== undefined ? pt.lon : pt.longitude);
          if (Number.isNaN(lat) || Number.isNaN(lon)) { return; }

          var rawText = JSON.stringify(pt).toLowerCase();
          var isDaLat = rawText.indexOf('đà lạt') !== -1 || rawText.indexOf('da lat') !== -1 || rawText.indexOf('dalat') !== -1
                     || (Math.abs(lat - 11.939272) < 0.006 && Math.abs(lon - 108.461561) < 0.006);
          var isPrenn = rawText.indexOf('prenn') !== -1
                     || (Math.abs(lat - 11.896950) < 0.006 && Math.abs(lon - 108.451639) < 0.006);

          var title = pt.name || pt.label || pt.place || 'Điểm trọng điểm';
          if (isDaLat) {
            lat = 11.939272;
            lon = 108.461561;
            if (!pt.name && !pt.label && !pt.place) { title = 'Trung tâm Đà Lạt'; }
          } else if (isPrenn) {
            lat = 11.896950;
            lon = 108.451639;
            if (!pt.name && !pt.label && !pt.place) { title = 'Đèo Prenn'; }
          }

          var color = tierColor(pt.tier_code);
          var probText = (pt.prob_pct !== undefined && pt.prob_pct !== null)
            ? (Number(pt.prob_pct).toFixed(1) + '%')
            : ((pt.prob !== undefined) ? ((Number(pt.prob) * 100).toFixed(1) + '%') : '');

          var cm = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.92
          });
          cm.bindTooltip(title + (probText ? (' — ' + probText) : ''));
          cm.on('click', function (ev) {
            L.DomEvent.stopPropagation(ev);
            if (!isPredicting) {
              setPoint(lat, lon, title, true, 15);
            }
          });
          cm.addTo(hotspotsLayer);
        });
      })
      .catch(function (err) {
        console.warn('GEOALERT hotspots:', err);
      });
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
    if (isPredicting) { return; }
    setPoint(e.latlng.lat, e.latlng.lng, '', false, null);
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
        runPredictAndSyncOverlays();
      }
    });
  });

  function applyHemisphere(val, dir, isLat, isVietnamese) {
    var num = Math.abs(val);
    if (!dir) { return val; }
    var d = dir.toUpperCase();
    if (isLat) {
      if (d === 'S' || (d === 'N' && isVietnamese)) { return -num; }
      return num; // 'B' (Bắc) hoặc 'N' (North)
    } else {
      if (d === 'W' || d === 'T') { return -num; }
      return num; // 'Đ' (Đông) hoặc 'E' (East)
    }
  }

  function parseCoordinates(raw) {
    var text = raw.trim();

    // 1. Tọa độ Độ - Phút - Giây (DMS) tiếng Việt & Anh: vd 11°16'26.4"B 107°51'18.0"Đ hoặc 11°27'19.93"N 107°43'02.55"E
    var dmsRegex = /^(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″”]|'')?\s*([BbNnSs])\s*[,;\s]+\s*(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″”]|'')?\s*([ĐđEeWwTt])$/;
    var dmsMatch = text.match(dmsRegex);
    if (dmsMatch) {
      var isViDms = /[BbĐđTt]/.test(dmsMatch[4] + dmsMatch[8]);
      var latDms = Number(dmsMatch[1]) + Number(dmsMatch[2]) / 60 + Number(dmsMatch[3]) / 3600;
      var lonDms = Number(dmsMatch[5]) + Number(dmsMatch[6]) / 60 + Number(dmsMatch[7]) / 3600;
      latDms = applyHemisphere(latDms, dmsMatch[4], true, isViDms);
      lonDms = applyHemisphere(lonDms, dmsMatch[8], false, isViDms);
      if (Math.abs(latDms) <= 90 && Math.abs(lonDms) <= 180) {
        return { lat: latDms, lon: lonDms };
      }
    }

    // 2. Tọa độ Độ thập phân (DD) có hoặc không có ký hiệu °, B/Đ, N/E: vd 11.274°B, 107.855°Đ hoặc 11.274, 107.855
    var ddRegex = /^([+-]?\d+(?:\.\d+)?)\s*[°º]?\s*([BbNnSs])?\s*[,;\s]+\s*([+-]?\d+(?:\.\d+)?)\s*[°º]?\s*([ĐđEeWwTt])?$/;
    var ddMatch = text.match(ddRegex);
    if (ddMatch) {
      var a = Number(ddMatch[1]);
      var latDir = ddMatch[2] || '';
      var b = Number(ddMatch[3]);
      var lonDir = ddMatch[4] || '';
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        // Tự động đảo chiều nếu người dùng dán ngược (Kinh độ ~107-109 trước, Vĩ độ ~11-12 sau)
        if (!latDir && !lonDir && Math.abs(a) > 90 && Math.abs(a) <= 180 && Math.abs(b) <= 90) {
          return { lat: b, lon: a };
        }
        var isViDd = /[BbĐđTt]/.test(latDir + lonDir);
        var lat = applyHemisphere(a, latDir, true, isViDd);
        var lon = applyHemisphere(b, lonDir, false, isViDd);
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          return { lat: lat, lon: lon };
        }
      }
    }

    return null;
  }

  function doSearch() {
    if (!input || !list || isPredicting) { return; }
    var q = input.value.trim();
    list.innerHTML = '';
    if (!q) { return; }

    // Nếu nhập tọa độ -> nhảy thẳng tới điểm đó và chạy dự báo
    var coords = parseCoordinates(q);
    if (coords) {
      var coordLabel = 'Tọa độ: ' + coords.lat.toFixed(6) + ', ' + coords.lon.toFixed(6);
      setPoint(coords.lat, coords.lon, coordLabel, true, 15);
      return;
    }

    // Nếu nhập chữ -> tìm tên địa điểm qua Photon như cũ
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
          var geomCoords = f.geometry && f.geometry.coordinates;
          if (!geomCoords) { return; }
          var parts = [p.name, p.street, p.district, p.city, p.state].filter(Boolean);
          var label = parts.join(', ') || q;
          var li = document.createElement('li');
          li.textContent = label;
          li.addEventListener('click', function () {
            list.innerHTML = '';
            input.value = label;
            setPoint(geomCoords[1], geomCoords[0], label, true, null);
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