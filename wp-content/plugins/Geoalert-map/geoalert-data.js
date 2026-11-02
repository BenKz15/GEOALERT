/* GEOALERT: lớp dữ liệu ("ổ cắm") */
window.GEOALERT = window.GEOALERT || {};
(function (G) {
  // ===== CẤU HÌNH =====
  G.config = {
    demoMode: true,            // true: dùng dữ liệu minh họa. Khi nối lõi thật, đổi thành false
    riskTileUrl: null,         // sau này: đường dẫn tile lớp nguy cơ, ví dụ 'https://.../{z}/{x}/{y}'
    vegTileUrl: null,          // sau này: đường dẫn tile lớp phủ thực vật
    thresholds: { mid: 0.33, high: 0.66 }  // xác suất < mid: Thấp; < high: Trung bình; còn lại: Cao
  };

  // ===== NỐI LÕI THẬT (làm sau) =====
  // Gán G.provider = function (lat, lon, radius) { return Promise<kết quả> };
  // Kết quả phải có dạng:
  // { type:'real', level:'low'|'mid'|'high', probability:0..1, probabilityMax:0..1,
  //   radius:số mét, factors:[{key,label,value,unit,contribution}],
  //   updatedAt:'2026-10-24T08:00:00Z', source:'GEE Random Forest' }
  G.provider = null;

  function levelOf(p) {
    var t = G.config.thresholds;
    if (p < t.mid) { return 'low'; }
    if (p < t.high) { return 'mid'; }
    return 'high';
  }
  G.levelOf = levelOf;

  // Số ngẫu nhiên có hạt giống: cùng một điểm luôn ra cùng một kết quả
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function demoResult(lat, lon, radius) {
    var key = Math.round(lat * 1000) * 100003 + Math.round(lon * 1000) * 7919;
    var rnd = seeded(key);
    var rain3 = Math.round(rnd() * 150);
    var rain14 = Math.round(rnd() * 250);
    var soil = Math.round(rnd() * 100) / 100;
    var ndvi = Math.round((rnd() * 1.0 - 0.2) * 100) / 100;
    var slope = Math.round(rnd() * 45);

    var w = [rnd() + 0.3, rnd() + 0.3, rnd() + 0.3, rnd() + 0.3, rnd() + 0.3];
    var sum = w.reduce(function (a, b) { return a + b; }, 0);
    var contrib = w.map(function (x) { return x / sum; });

    var p = Math.min(0.97, Math.max(0.03,
      0.5 * (slope / 45) + 0.25 * (rain14 / 250) + 0.15 * soil + 0.1 * (1 - Math.max(0, ndvi)) * 0.8 + (rnd() - 0.5) * 0.2));
    var pMax = Math.min(0.98, p + (radius / 3000) * rnd() * 0.3);

    return {
      type: 'demo',
      level: levelOf(pMax),
      probability: p,
      probabilityMax: pMax,
      radius: radius,
      factors: [
        { key: 'rain3', label: 'Mưa 3 ngày', value: rain3, unit: 'mm', contribution: contrib[0] },
        { key: 'rain14', label: 'Mưa 14 ngày', value: rain14, unit: 'mm', contribution: contrib[1] },
        { key: 'soil', label: 'Độ ẩm đất (radar)', value: Math.round(soil * 100), unit: '%', contribution: contrib[2] },
        { key: 'ndvi', label: 'Độ che phủ rừng (NDVI)', value: ndvi, unit: '', contribution: contrib[3] },
        { key: 'slope', label: 'Độ dốc', value: slope, unit: '°', contribution: contrib[4] }
      ],
      updatedAt: new Date().toISOString(),
      source: 'Dữ liệu minh họa tạo ngẫu nhiên'
    };
  }

  // ===== HÀM DUY NHẤT GIAO DIỆN GỌI =====
  G.getRisk = function (lat, lon, radius) {
    if (typeof G.provider === 'function') {
      return G.provider(lat, lon, radius);
    }
    if (G.config.demoMode) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(demoResult(lat, lon, radius)); }, 400);
      });
    }
    return Promise.resolve(null);   // null = chưa có dữ liệu
  };
})(window.GEOALERT);