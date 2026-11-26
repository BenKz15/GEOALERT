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

  // Điểm A: Xóa sạch toàn bộ lớp phủ overlay cũ khi lỗi 503 / mất mạng (tránh sót lớp Xanh giả)
  function clearAllActiveOverlays() {
    ['hotspot', 'zoning', 'ndvi'].forEach(function (k) {
      overlayState[k] = false;
      if (activeOverlays[k]) {
        map.removeLayer(activeOverlays[k]);
        activeOverlays[k] = null;
      }
    });
    syncOverlayCheckboxes();
  }

  // Điểm A: Hiển thị khung cảnh báo Fail-Loud màu xám/cam thay cho thẻ kết quả cũ
  function renderFailLoudWarning(detailMsg) {
    var slot = document.getElementById('ga-risk-slot');
    if (!slot) { return; }
    slot.innerHTML = '';
    slot.className = 'ga-risk';

    var warnBox = document.createElement('div');
    warnBox.style.cssText = 'padding:12px 14px;border-radius:10px;background:#fff7ed;border:1.5px solid #ea580c;color:#4b5563;font-size:13.5px;line-height:1.5;';

    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight:700;color:#c2410c;margin-bottom:4px;';
    titleEl.textContent = '⚠️ ' + (detailMsg || 'Tạm gián đoạn dữ liệu khí tượng.');

    var subEl = document.createElement('div');
    subEl.style.cssText = 'font-weight:600;color:#374151;font-size:12.5px;';
    subEl.textContent = 'Chưa thể đánh giá nguy cơ — không dùng làm căn cứ lưu thông.';

    warnBox.appendChild(titleEl);
    warnBox.appendChild(subEl);
    slot.appendChild(warnBox);
  }

  // Vẽ / xóa ghim phụ chỉ đúng điểm nguy cơ cao nhất trong bán kính trên Leaflet
  function clearMaxRadiusMarker() {
    if (maxRadiusMarker) { map.removeLayer(maxRadiusMarker); maxRadiusMarker = null; }
    if (maxRadiusLine) { map.removeLayer(maxRadiusLine); maxRadiusLine = null; }
  }

  function updateMaxRadiusMarker(data) {
    clearMaxRadiusMarker();
    var mr = data && data.max_in_radius;
    if (!mr || mr.distance_m < 25 || mr.prob_pct === null || mr.prob_pct === undefined || mr.prob_pct < 50) { return; }

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

  // Điểm C: Render khối giải thích "Vì sao?" (4 yếu tố Exact Group Shapley + khung NDVI tham khảo tách biệt)
  function renderWhySection(containerEl, data) {
    if (!containerEl || !data) { return; }
    var cObj = data.contributions || {};
    var feat = data.features || {};
    var factors = (Array.isArray(data.why_factors) && data.why_factors.length > 0)
      ? data.why_factors
      : [
          { key: 'slope', label: 'Độ dốc địa hình (30m)', contribution_pct: cObj.slope !== undefined ? cObj.slope : 0, value: feat.slope_point_deg !== undefined ? feat.slope_point_deg : '-', unit: '°' },
          { key: 'rain_15d', label: 'Mưa 15 ngày (CHIRPS)', contribution_pct: cObj.rain_15d !== undefined ? cObj.rain_15d : 0, value: feat.rain_15d_mm !== undefined ? feat.rain_15d_mm : '-', unit: 'mm' },
          { key: 'rain_3d', label: 'Mưa ngắn hạn 1–3 ngày', contribution_pct: cObj.rain_3d !== undefined ? cObj.rain_3d : 0, value: feat.rain_3d_mm !== undefined ? feat.rain_3d_mm : '-', unit: 'mm' },
          { key: 'soil_moisture', label: 'Độ ẩm đất nền', contribution_pct: cObj.soil_moisture !== undefined ? cObj.soil_moisture : 0, value: feat.soil_moisture_pct !== undefined ? feat.soil_moisture_pct : '-', unit: '%' }
        ].sort(function (a, b) { return Number(b.contribution_pct) - Number(a.contribution_pct); });

    var box = makeDiv('ga-why');
    box.appendChild(makeDiv('ga-why-title', 'Vì sao có mức nguy cơ này? (4 nhóm yếu tố AI)'));

    if (data.why_summary) {
      var sumP = document.createElement('p');
      sumP.className = 'why-summary';
      sumP.textContent = data.why_summary;
      box.appendChild(sumP);
    }

    factors.forEach(function (f) {
      var pct = Math.min(Math.max(Number(f.contribution_pct) || 0, 0), 100);
      var hasShapley = f.shapley_pp !== undefined && f.shapley_pp !== null && !Number.isNaN(Number(f.shapley_pp));
      var shapleyNum = hasShapley ? Number(f.shapley_pp) : 0;
      var shapleyLabel = hasShapley
        ? ((shapleyNum >= 0 ? '+' : '') + shapleyNum.toFixed(1) + ' điểm % · chiếm ' + pct + '%')
        : ('chiếm ' + pct + '%');

      var valDisplay = (f.value !== undefined && f.value !== null ? f.value : '-') + (f.unit || '');
      if (f.rain_1d_value !== undefined && f.rain_1d_value !== null) {
        valDisplay = '1 ngày: ' + f.rain_1d_value + 'mm · 3 ngày: ' + (f.value !== undefined ? f.value : '-') + (f.unit || 'mm');
      }

      var item = makeDiv('ga-why-item');
      var top = makeDiv('ga-why-top');
      top.appendChild(makeDiv('ga-why-name', f.label + ' (' + valDisplay + ')'));
      top.appendChild(makeDiv('ga-why-val', shapleyLabel));
      item.appendChild(top);

      var track = makeDiv('ga-why-track');
      var fill = makeDiv('ga-why-fill');
      fill.style.width = Math.max(4, Math.round(pct)) + '%';
      track.appendChild(fill);
      item.appendChild(track);
      box.appendChild(item);
    });

    containerEl.appendChild(box);

    // Khung tham khảo tách biệt cho NDVI (surface_context — nằm ngoài lõi 9 biến AI)
    var sc = data.surface_context;
    if (sc && typeof sc === 'object') {
      var scBox = document.createElement('div');
      scBox.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:8px;background:#f8fafc;border:1px solid #cbd5e1;font-size:12.5px;color:#334155;';

      var scHeader = document.createElement('div');
      scHeader.style.cssText = 'font-weight:700;color:#1e293b;margin-bottom:4px;';
      var scVal = (sc.value !== undefined && sc.value !== null) ? (' = ' + sc.value) : '';
      scHeader.textContent = (sc.label || 'Thảm phủ thực vật 30m (NDVI — chỉ số tham khảo ngoài lõi AI)') + scVal;
      scBox.appendChild(scHeader);

      if (sc.status) {
        var scStatus = document.createElement('div');
        scStatus.style.cssText = 'font-weight:600;color:#0f766e;margin-bottom:2px;';
        scStatus.textContent = 'Trạng thái lớp phủ: ' + sc.status;
        scBox.appendChild(scStatus);
      }

      if (sc.note) {
        var scNote = document.createElement('div');
        scNote.style.cssText = 'color:#475569;line-height:1.4;';
        scNote.textContent = sc.note;
        scBox.appendChild(scNote);
      }

      containerEl.appendChild(scBox);
    }
  }

  function renderPredictionResult(data) {
    var slot = document.getElementById('ga-risk-slot');
    if (!slot) { return; }
    slot.innerHTML = '';
    slot.className = 'ga-risk';

    var tier = (data.tier_code || '').toLowerCase();
    var isWater = Boolean(data.is_water) || tier === 'water';
    var hasValidProb = data.prob_point_pct !== undefined && data.prob_point_pct !== null && !Number.isNaN(Number(data.prob_point_pct));

    var headCls = 'ga-risk-low';
    var badgeText = hasValidProb
      ? ((data.risk_level || 'Thấp') + ' — ' + Number(data.prob_point_pct).toFixed(1) + '%')
      : (data.risk_level || 'Chưa đánh giá được');

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

    // Điểm B: Nhãn cảnh báo khi dùng cache trễ < 3h tại đúng vị trí
    if (data.data_status === 'stale_same_location') {
      var staleBadge = document.createElement('div');
      staleBadge.style.cssText = 'margin:8px 0;padding:7px 10px;border-radius:8px;background:#fffbeb;border:1px solid #f59e0b;color:#b45309;font-size:12.5px;font-weight:600;';
      staleBadge.textContent = '⏱️ Đang dùng dữ liệu cache trễ (< 3h) tại đúng vị trí này';
      slot.appendChild(staleBadge);
    }

    if (data.recommendation) {
      slot.appendChild(makeDiv('ga-rec-box', data.recommendation));
    }

    // Khối phụ Tham khảo trong bán kính (max_in_radius)
    var mr = data.max_in_radius;
    if (mr && mr.prob_pct !== null && mr.prob_pct !== undefined) {
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

  function setOverlayStatus(text, isWarning) {
    if (overlayStatusEl) {
      overlayStatusEl.textContent = text || '';
      overlayStatusEl.style.color = isWarning ? '#b45309' : '';
      overlayStatusEl.style.fontWeight = isWarning ? '600' : '';
    }
  }

  // Bật/tắt 3 lớp bản đồ từ POST /overlay (kèm xử lý lỗi 503 & cache trễ < 3h)
  async function toggleMapOverlay(layerName, isChecked) {
    overlayState[layerName] = Boolean(isChecked);

    if (!isChecked) {
      if (activeOverlays[layerName]) {
        map.removeLayer(activeOverlays[layerName]);
        activeOverlays[layerName] = null;
      }
      syncOverlayCheckboxes();
      setOverlayStatus('', false);
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
    setOverlayStatus('Đang tải lớp bản đồ...', false);
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
        throw new Error(err.detail || (res.status === 503
          ? 'Tạm gián đoạn dữ liệu khí tượng (HTTP 503).'
          : ('Không tải được lớp bản đồ ' + layerName)));
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

      // Điểm B: Kiểm tra data_stale trên /overlay
      var statusParts = [];
      var isStale = Boolean(data.stats && data.stats.data_stale === true);
      if (isStale) {
        statusParts.push('⏱️ Đang dùng dữ liệu cache trễ (< 3h) tại đúng vị trí này');
      }
      if (data.stats && data.stats.hotspot_pct !== undefined && layerName === 'hotspot') {
        statusParts.push('Điểm nóng ưu tiên: ' + data.stats.hotspot_pct + '% diện tích (' + data.stats.hotspot_pixels + ' pixel 30m)');
      }
      setOverlayStatus(statusParts.join(' | '), isStale);
    } catch (e) {
      // Điểm A: Xóa sạch lớp phủ cũ khi gặp 503 / mất mạng
      var errMsg = (e && e.message && e.message !== 'Failed to fetch')
        ? e.message
        : 'Tạm gián đoạn kết nối dữ liệu khí tượng.';
      clearAllActiveOverlays();
      renderFailLoudWarning(errMsg);
      setOverlayStatus('⚠️ ' + errMsg + ' — Chưa thể đánh giá nguy cơ, không dùng làm căn cứ lưu thông.', true);
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
    var response;
    try {
      response = await fetch(API_BASE + '/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (networkErr) {
      throw new Error('Tạm gián đoạn kết nối mạng hoặc máy chủ dữ liệu khí tượng.');
    }
    var bodyJson = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(bodyJson.detail || (response.status === 503
        ? 'Tạm gián đoạn dữ liệu khí tượng (HTTP 503).'
        : 'Lỗi khi gọi API dự báo'));
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
        // Điểm A: Xóa sạch lớp phủ cũ và hiện cảnh báo Fail-Loud khi nhận HTTP 503 hoặc mất mạng
        clearAllActiveOverlays();
        setOverlayStatus('', false);
        renderFailLoudWarning(err.message);
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

  // Điểm D: Màu xám (#6b7280) cho trạng thái unavailable / đang tải (không ép về xanh)
  function tierColor(tier) {
    var t = (tier || '').toLowerCase();
    if (t === 'unavailable' || t === 'loading') { return '#6b7280'; }
    if (t === 'red') { return '#dc2626'; }
    if (t === 'yellow') { return '#d97706'; }
    return '#16a34a';
  }

  // 5 chấm trọng điểm cố định (khởi tạo ở trạng thái 'loading' xám cho tới khi API /hotspots trả về)
  var DEFAULT_HOTSPOTS = [
    { name: 'Trung tâm Đà Lạt', lat: 11.939272, lon: 108.461561, tier_code: 'loading', prob_pct: null, risk_level: 'Đang tải dữ liệu...' },
    { name: 'Đèo Prenn',        lat: 11.896950, lon: 108.451639, tier_code: 'loading', prob_pct: null, risk_level: 'Đang tải dữ liệu...' },
    { name: 'Đèo Mimosa',       lat: 11.904572, lon: 108.463161, tier_code: 'loading', prob_pct: null, risk_level: 'Đang tải dữ liệu...' },
    { name: 'Đèo Khánh Lê',     lat: 12.222164, lon: 108.772731, tier_code: 'loading', prob_pct: null, risk_level: 'Đang tải dữ liệu...' },
    { name: 'Đèo Bảo Lộc',      lat: 11.455536, lon: 107.717375, tier_code: 'loading', prob_pct: null, risk_level: 'Đang tải dữ liệu...' }
  ];

  function matchFixedHotspot(pt, lat, lon) {
    var raw = JSON.stringify(pt).toLowerCase();
    if (raw.indexOf('mimosa') !== -1) { return DEFAULT_HOTSPOTS[2]; }
    if (raw.indexOf('khánh lê') !== -1 || raw.indexOf('khanh le') !== -1) { return DEFAULT_HOTSPOTS[3]; }
    if (raw.indexOf('bảo lộc') !== -1 || raw.indexOf('bao loc') !== -1) { return DEFAULT_HOTSPOTS[4]; }
    if (raw.indexOf('đà lạt') !== -1 || raw.indexOf('da lat') !== -1 || raw.indexOf('dalat') !== -1
        || (Math.abs(lat - 11.939272) < 0.015 && Math.abs(lon - 108.459000) < 0.015)) {
      return DEFAULT_HOTSPOTS[0];
    }
    if (raw.indexOf('prenn') !== -1
        || (lon < 108.457 && Math.abs(lat - 11.898000) < 0.015 && Math.abs(lon - 108.448000) < 0.015)) {
      return DEFAULT_HOTSPOTS[1];
    }
    return null;
  }

  function renderHotspotMarkers(listItems, isInitialPlaceholder) {
    hotspotsLayer.clearLayers();
    var seenNames = {};
    var mergedList = [];

    listItems.forEach(function (pt) {
      var lat = Number(pt.lat !== undefined ? pt.lat : pt.latitude);
      var lon = Number(pt.lon !== undefined ? pt.lon : pt.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) { return; }

      var fixed = matchFixedHotspot(pt, lat, lon);
      var title = fixed ? fixed.name : (pt.name || pt.label || pt.place || 'Điểm trọng điểm');
      if (fixed) {
        lat = fixed.lat;
        lon = fixed.lon;
        seenNames[fixed.name] = true;
      }
      mergedList.push({
        title: title,
        lat: lat,
        lon: lon,
        tier_code: pt.tier_code,
        prob_pct: pt.prob_pct,
        prob: pt.prob,
        risk_level: pt.risk_level,
        error: pt.error
      });
    });

    // Nếu thiếu điểm nào sau khi API trả về -> gắn trạng thái 'unavailable' màu xám (tuyệt đối không ép xanh)
    DEFAULT_HOTSPOTS.forEach(function (def) {
      if (!seenNames[def.name]) {
        mergedList.push({
          title: def.name,
          lat: def.lat,
          lon: def.lon,
          tier_code: isInitialPlaceholder ? 'loading' : 'unavailable',
          prob_pct: null,
          prob: undefined,
          risk_level: isInitialPlaceholder ? 'Đang tải dữ liệu...' : 'Chưa đánh giá được',
          error: isInitialPlaceholder ? '' : 'Chưa có dữ liệu khí tượng tại điểm này'
        });
      }
    });

    mergedList.forEach(function (item) {
      // Điểm D: Kiểm tra tier_code === 'unavailable' || prob_pct === null trước khi vẽ badge
      var isUnavailable = (item.tier_code === 'unavailable' || item.prob_pct === null || item.prob_pct === undefined);
      var color = isUnavailable ? '#6b7280' : tierColor(item.tier_code);

      var statusText = '';
      if (item.tier_code === 'loading') {
        statusText = item.risk_level || 'Đang tải dữ liệu...';
      } else if (isUnavailable) {
        statusText = (item.risk_level || 'Chưa đánh giá được') + (item.error ? (' — ' + item.error) : '');
      } else if (item.prob_pct !== undefined && item.prob_pct !== null) {
        statusText = (item.risk_level ? (item.risk_level + ' — ') : '') + Number(item.prob_pct).toFixed(1) + '%';
      } else if (item.prob !== undefined && item.prob !== null) {
        statusText = (Number(item.prob) * 100).toFixed(1) + '%';
      }

      var cm = L.circleMarker([item.lat, item.lon], {
        radius: 8,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.92
      });
      cm.bindTooltip(item.title + (statusText ? (' — ' + statusText) : ''));
      cm.on('click', function (ev) {
        L.DomEvent.stopPropagation(ev);
        if (!isPredicting) {
          setPoint(item.lat, item.lon, item.title, true, 15);
        }
      });
      cm.addTo(hotspotsLayer);
    });
  }

  function loadHotspots(dateStr) {
    renderHotspotMarkers(DEFAULT_HOTSPOTS, true);
    var query = dateStr ? ('?date=' + encodeURIComponent(dateStr)) : '';
    fetch(API_BASE + '/hotspots' + query)
      .then(function (res) {
        if (!res.ok) { throw new Error('Không tải được danh sách điểm trọng điểm'); }
        return res.json();
      })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.hotspots || data.items || []);
        renderHotspotMarkers(items, false);
      })
      .catch(function (err) {
        console.warn('GEOALERT hotspots:', err);
        renderHotspotMarkers([], false);
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