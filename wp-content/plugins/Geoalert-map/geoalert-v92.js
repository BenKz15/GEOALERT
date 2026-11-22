(function (global) {
  "use strict";

  // Điền URL API Python chạy file mohinh_satlo_v92.pkl (ví dụ Hugging Face Spaces / Render) tại đây khi triển khai backend:
  const PKL_API_URL = "";

  const GEOALERT_V92_META = {
    version: "GeoAlert V9.2 (Final Disaster-Grade Production)",
    features: [
      "Slope_p90",
      "Rain_1d_GPM",
      "Rain_3d_GPM",
      "Rain_15d_CHIRPS",
      "Soil_Moisture",
      "Stress_1d",
      "Stress_3d",
      "Stress_15d",
      "Hydro_Stress"
    ],
    monotoneConstraints: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    calibrationMethod: "sigmoid",
    soilMoistureImputeMedian: 0.4205,
    softSlopeGate: { zeroDeg: 4.0, fullDeg: 8.0 },
    thresholds: {
      yellowSafetyFirst: 0.3725,
      yellowBalancedMode: 0.4875,
      redActionFirst: 0.69
    }
  };

  const GEOALERT_V92_STRESS_TEST = [
    {"id":0,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Bảo Lộc 1 (07/23)","lat":11.455,"lon":107.74,"date":"2023-07-30","label":1,"slope":27.6493,"rain1d":40.62,"rain3d":67.545,"rain15d":352.527,"soil":0.4905,"stress1d":18.85,"stress3d":31.3448,"stress15d":163.5928,"hydroStress":15.3751,"xsAi":0.9024,"xsGate":0.9024,"alert":1,"level":"Đỏ (Khẩn cấp)","eval":"ĐẠT"},
    {"id":1,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Bảo Lộc 2 (07/23)","lat":11.458,"lon":107.7425,"date":"2023-07-30","label":1,"slope":24.6089,"rain1d":40.62,"rain3d":67.545,"rain15d":352.527,"soil":0.4905,"stress1d":16.9151,"stress3d":28.1273,"stress15d":146.8001,"hydroStress":13.7968,"xsAi":0.9019,"xsGate":0.9019,"alert":1,"level":"Đỏ (Khẩn cấp)","eval":"ĐẠT"},
    {"id":2,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Khánh Lê (07/23)","lat":12.185,"lon":108.715,"date":"2023-07-30","label":1,"slope":42.5741,"rain1d":8.735,"rain3d":15.405,"rain15d":257.064,"soil":0.4722,"stress1d":5.9096,"stress3d":10.4222,"stress15d":173.9153,"hydroStress":4.9216,"xsAi":0.7119,"xsGate":0.7119,"alert":1,"level":"Đỏ (Khẩn cấp)","eval":"ĐẠT"},
    {"id":3,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Prenn (06/23)","lat":11.9,"lon":108.445,"date":"2023-06-23","label":1,"slope":23.9422,"rain1d":4.43,"rain3d":12.68,"rain15d":112.439,"soil":0.4824,"stress1d":1.7978,"stress3d":5.1457,"stress15d":45.6296,"hydroStress":2.4822,"xsAi":0.5965,"xsGate":0.5965,"alert":1,"level":"Vàng (Theo dõi)","eval":"ĐẠT"},
    {"id":4,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Con Ó (08/23)","lat":11.5956,"lon":107.5519,"date":"2023-08-05","label":1,"slope":18.0541,"rain1d":4.49,"rain3d":33.23,"rain15d":318.319,"soil":0.486,"stress1d":1.3915,"stress3d":10.2985,"stress15d":98.6516,"hydroStress":5.0046,"xsAi":0.689,"xsGate":0.689,"alert":1,"level":"Vàng (Theo dõi)","eval":"ĐẠT"},
    {"id":5,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Mimosa (07/23)","lat":11.9065,"lon":108.458,"date":"2023-07-30","label":1,"slope":36.985,"rain1d":32.12,"rain3d":46.035,"rain15d":207.063,"soil":0.4835,"stress1d":19.3236,"stress3d":27.6949,"stress15d":124.5704,"hydroStress":13.3899,"xsAi":0.8841,"xsGate":0.8841,"alert":1,"level":"Đỏ (Khẩn cấp)","eval":"ĐẠT"},
    {"id":6,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Bảo Lộc (09/24)","lat":11.463,"lon":107.746,"date":"2024-09-21","label":1,"slope":24.0018,"rain1d":26.615,"rain3d":47.275,"rain15d":180.982,"soil":0.4932,"stress1d":10.8261,"stress3d":19.2298,"stress15d":73.6172,"hydroStress":9.4848,"xsAi":0.8696,"xsGate":0.8696,"alert":1,"level":"Đỏ (Khẩn cấp)","eval":"ĐẠT"},
    {"id":7,"group":"A. Đèo Sạt lở (23-24)","place":"Đèo Khánh Lê (12/24)","lat":12.185,"lon":108.715,"date":"2024-12-15","label":1,"slope":42.5741,"rain1d":2.63,"rain3d":40.38,"rain15d":138.631,"soil":0.4947,"stress1d":1.7793,"stress3d":27.3188,"stress15d":93.7901,"hydroStress":13.5148,"xsAi":0.8318,"xsGate":0.8318,"alert":1,"level":"Đỏ (Khẩn cấp)","eval":"ĐẠT"},
    {"id":8,"group":"B. Đèo Mùa Khô","place":"Đèo Bảo Lộc 1 (Khô)","lat":11.455,"lon":107.74,"date":"2023-02-15","label":0,"slope":27.6493,"rain1d":0.0,"rain3d":1.6,"rain15d":19.116,"soil":0.32,"stress1d":0.0,"stress3d":0.7425,"stress15d":8.8708,"hydroStress":0.2376,"xsAi":0.1132,"xsGate":0.1132,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":9,"group":"B. Đèo Mùa Khô","place":"Đèo Bảo Lộc 2 (Khô)","lat":11.458,"lon":107.7425,"date":"2023-02-15","label":0,"slope":24.6089,"rain1d":0.0,"rain3d":1.6,"rain15d":19.116,"soil":0.32,"stress1d":0.0,"stress3d":0.6663,"stress15d":7.9602,"hydroStress":0.2132,"xsAi":0.113,"xsGate":0.113,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":10,"group":"B. Đèo Mùa Khô","place":"Đèo Khánh Lê (Khô)","lat":12.185,"lon":108.715,"date":"2023-02-15","label":0,"slope":42.5741,"rain1d":0.0,"rain3d":0.35,"rain15d":17.335,"soil":0.3588,"stress1d":0.0,"stress3d":0.2368,"stress15d":11.7279,"hydroStress":0.085,"xsAi":0.1142,"xsGate":0.1142,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":11,"group":"B. Đèo Mùa Khô","place":"Đèo Prenn (Khô)","lat":11.9,"lon":108.445,"date":"2023-02-15","label":0,"slope":23.9422,"rain1d":0.06,"rain3d":0.105,"rain15d":5.154,"soil":0.3353,"stress1d":0.0243,"stress3d":0.0426,"stress15d":2.0915,"hydroStress":0.0143,"xsAi":0.0785,"xsGate":0.0785,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":12,"group":"B. Đèo Mùa Khô","place":"Đèo Con Ó (Khô)","lat":11.5956,"lon":107.5519,"date":"2023-02-15","label":0,"slope":18.0541,"rain1d":0.03,"rain3d":2.75,"rain15d":8.784,"soil":0.3393,"stress1d":0.0093,"stress3d":0.8523,"stress15d":2.7223,"hydroStress":0.2892,"xsAi":0.0801,"xsGate":0.0801,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":13,"group":"B. Đèo Mùa Khô","place":"Đèo Mimosa (Khô)","lat":11.9065,"lon":108.458,"date":"2023-02-15","label":0,"slope":36.985,"rain1d":0.595,"rain3d":4.925,"rain15d":10.304,"soil":0.338,"stress1d":0.358,"stress3d":2.9629,"stress15d":6.1991,"hydroStress":1.0015,"xsAi":0.1125,"xsGate":0.1125,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":14,"group":"C. Bằng ngày Bão","place":"QT Lâm Viên","lat":11.9392,"lon":108.4419,"date":"2023-07-30","label":0,"slope":7.2173,"rain1d":32.12,"rain3d":46.035,"rain15d":164.107,"soil":0.4835,"stress1d":4.0353,"stress3d":5.7835,"stress15d":20.6171,"hydroStress":2.7962,"xsAi":0.0863,"xsGate":0.0694,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":15,"group":"C. Bằng ngày Bão","place":"SB Liên Khương","lat":11.7519,"lon":108.3711,"date":"2023-07-30","label":0,"slope":1.5579,"rain1d":25.75,"rain3d":33.12,"rain15d":139.006,"soil":0.4886,"stress1d":0.7001,"stress3d":0.9004,"stress15d":3.7791,"hydroStress":0.4399,"xsAi":0.0734,"xsGate":0.0,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":16,"group":"C. Bằng ngày Bão","place":"TT TP Bảo Lộc","lat":11.5458,"lon":107.8055,"date":"2023-07-30","label":0,"slope":7.2036,"rain1d":41.72,"rain3d":63.09,"rain15d":234.01,"soil":0.4906,"stress1d":5.2315,"stress3d":7.9112,"stress15d":29.3437,"hydroStress":3.8812,"xsAi":0.0872,"xsGate":0.0698,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":17,"group":"C. Bằng ngày Bão","place":"TT Liên Nghĩa","lat":11.7355,"lon":108.3735,"date":"2023-07-30","label":0,"slope":4.187,"rain1d":25.75,"rain3d":33.12,"rain15d":111.253,"soil":0.4886,"stress1d":1.8801,"stress3d":2.4182,"stress15d":8.1229,"hydroStress":1.1815,"xsAi":0.0767,"xsGate":0.0036,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":18,"group":"C. Bằng ngày Bão","place":"TT Cát Tiên (Chuẩn)","lat":11.5664,"lon":107.3676,"date":"2023-07-30","label":0,"slope":4.0597,"rain1d":28.83,"rain3d":80.51,"rain15d":306.853,"soil":0.4909,"stress1d":2.0411,"stress3d":5.6998,"stress15d":21.7241,"hydroStress":2.7978,"xsAi":0.0829,"xsGate":0.0012,"alert":0,"level":"Xanh (An toàn)","eval":"ĐẠT"},
    {"id":19,"group":"D. Đèo Mưa nhẹ 04/23","place":"Đèo Bảo Lộc (04/23)","lat":11.455,"lon":107.74,"date":"2023-04-15","label":-1,"slope":27.6493,"rain1d":14.095,"rain3d":15.82,"rain15d":39.602,"soil":0.3499,"stress1d":6.5409,"stress3d":7.3414,"stress15d":18.3776,"hydroStress":2.5688,"xsAi":0.5349,"xsGate":0.5349,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"},
    {"id":20,"group":"D. Đèo Mưa nhẹ 04/23","place":"Đèo Khánh Lê (04/23)","lat":12.185,"lon":108.715,"date":"2023-04-15","label":-1,"slope":42.5741,"rain1d":0.705,"rain3d":0.705,"rain15d":12.501,"soil":0.2734,"stress1d":0.477,"stress3d":0.477,"stress15d":8.4572,"hydroStress":0.1304,"xsAi":0.1019,"xsGate":0.1019,"alert":0,"level":"Xanh (An toàn)","eval":"Quan sát"},
    {"id":21,"group":"D. Đèo Mưa nhẹ 04/23","place":"Đèo Prenn (04/23)","lat":11.9,"lon":108.445,"date":"2023-04-15","label":-1,"slope":23.9422,"rain1d":2.705,"rain3d":14.195,"rain15d":21.87,"soil":0.3069,"stress1d":1.0977,"stress3d":5.7605,"stress15d":8.875,"hydroStress":1.7678,"xsAi":0.2118,"xsGate":0.2118,"alert":0,"level":"Xanh (An toàn)","eval":"Quan sát"},
    {"id":22,"group":"D. Đèo Mưa nhẹ 04/23","place":"Đèo Con Ó (04/23)","lat":11.5956,"lon":107.5519,"date":"2023-04-15","label":-1,"slope":18.0541,"rain1d":34.485,"rain3d":36.76,"rain15d":42.97,"soil":0.3592,"stress1d":10.6874,"stress3d":11.3925,"stress15d":13.3172,"hydroStress":4.0924,"xsAi":0.6451,"xsGate":0.6451,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"},
    {"id":23,"group":"E. Đèo Mưa lớn 05/23","place":"Đèo Bảo Lộc (05/23)","lat":11.455,"lon":107.74,"date":"2023-05-20","label":-1,"slope":27.6493,"rain1d":14.75,"rain3d":30.645,"rain15d":143.344,"soil":0.4016,"stress1d":6.8449,"stress3d":14.2211,"stress15d":66.5201,"hydroStress":5.7118,"xsAi":0.6596,"xsGate":0.6596,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"},
    {"id":24,"group":"E. Đèo Mùa lớn 05/23","place":"Đèo Khánh Lê (05/23)","lat":12.185,"lon":108.715,"date":"2023-05-20","label":-1,"slope":42.5741,"rain1d":3.33,"rain3d":15.73,"rain15d":294.089,"soil":0.4387,"stress1d":2.2529,"stress3d":10.642,"stress15d":198.9639,"hydroStress":4.6688,"xsAi":0.627,"xsGate":0.627,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"},
    {"id":25,"group":"E. Đèo Mưa lớn 05/23","place":"Đèo Prenn (05/23)","lat":11.9,"lon":108.445,"date":"2023-05-20","label":-1,"slope":23.9422,"rain1d":11.98,"rain3d":20.26,"rain15d":265.176,"soil":0.4242,"stress1d":4.8617,"stress3d":8.2218,"stress15d":107.6126,"hydroStress":3.4874,"xsAi":0.6382,"xsGate":0.6382,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"},
    {"id":26,"group":"E. Đèo Mưa lớn 05/23","place":"Đèo Con Ó (05/23)","lat":11.5956,"lon":107.5519,"date":"2023-05-20","label":-1,"slope":18.0541,"rain1d":25.43,"rain3d":37.94,"rain15d":159.64,"soil":0.4096,"stress1d":7.8811,"stress3d":11.7582,"stress15d":49.4748,"hydroStress":4.8162,"xsAi":0.6669,"xsGate":0.6669,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"}
  ];

  function softSlopeGateFactor(slopeDeg) {
    const s = Number(slopeDeg) || 0;
    const { zeroDeg, fullDeg } = GEOALERT_V92_META.softSlopeGate;
    if (s <= zeroDeg) return 0;
    if (s >= fullDeg) return 1;
    return (s - zeroDeg) / (fullDeg - zeroDeg);
  }

  function classifyV92Probability(probGate) {
    const p = Number(probGate) || 0;
    const { yellowSafetyFirst, redActionFirst } = GEOALERT_V92_META.thresholds;
    if (p >= redActionFirst) {
      return { code: "RED", panelLevel: "high", label: "Đỏ (Khẩn cấp)", shortLabel: "Cao", alert: 1 };
    }
    if (p >= yellowSafetyFirst) {
      return { code: "YELLOW", panelLevel: "mid", label: "Vàng (Theo dõi)", shortLabel: "Trung bình", alert: 1 };
    }
    return { code: "GREEN", panelLevel: "low", label: "Xanh (An toàn)", shortLabel: "Thấp", alert: 0 };
  }

  function computePhysicsFeatures(rawInput) {
    const slope = Math.max(0, Number(rawInput.slope) || 0);
    const rain1d = Math.max(0, Number(rawInput.rain1d) || 0);
    const rain3d = Math.max(0, Math.max(rain1d, Number(rawInput.rain3d) || 0));
    const rain15d = Math.max(0, Math.max(rain3d, Number(rawInput.rain15d) || 0));
    const soil = Math.min(1, Math.max(0, Number(rawInput.soil) || GEOALERT_V92_META.soilMoistureImputeMedian));

    const sinSlope = Math.sin((slope * Math.PI) / 180);
    const stress1d = Number((sinSlope * rain1d).toFixed(4));
    const stress3d = Number((sinSlope * rain3d).toFixed(4));
    const stress15d = Number((sinSlope * rain15d).toFixed(4));
    const hydroStress = Number(((rain3d * (0.15 + 0.65 * soil)) / 1.4).toFixed(4));

    return {
      Slope_p90: Number(slope.toFixed(4)),
      Rain_1d_GPM: Number(rain1d.toFixed(3)),
      Rain_3d_GPM: Number(rain3d.toFixed(3)),
      Rain_15d_CHIRPS: Number(rain15d.toFixed(3)),
      Soil_Moisture: Number(soil.toFixed(4)),
      Stress_1d: stress1d,
      Stress_3d: stress3d,
      Stress_15d: stress15d,
      Hydro_Stress: hydroStress
    };
  }

  async function fetchLiveWeatherV92(lat, lon) {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + encodeURIComponent(lat) +
      "&longitude=" + encodeURIComponent(lon) +
      "&hourly=precipitation,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm" +
      "&past_days=15&forecast_days=1&timezone=Asia%2FBangkok";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Không kết nối được nguồn khí tượng thời gian thực");
    }
    const data = await res.json();
    const hourly = data && data.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) {
      throw new Error("Dữ liệu khí tượng trả về không hợp lệ");
    }

    const nowMs = Date.now();
    let bestIdx = hourly.time.length - 1;
    let minDiff = Infinity;
    for (let i = 0; i < hourly.time.length; i++) {
      const tMs = Date.parse(hourly.time[i] + "+07:00");
      if (!Number.isNaN(tMs)) {
        const diff = Math.abs(nowMs - tMs);
        if (diff <= minDiff && tMs <= nowMs + 3600000) {
          minDiff = diff;
          bestIdx = i;
        }
      }
    }

    function sumPrecip(hoursBack) {
      let s = 0;
      const start = Math.max(0, bestIdx - hoursBack + 1);
      for (let i = start; i <= bestIdx; i++) {
        const v = Number(hourly.precipitation && hourly.precipitation[i]);
        if (!Number.isNaN(v) && v > 0) s += v;
      }
      return Number(s.toFixed(2));
    }

    const rain1d = sumPrecip(24);
    const rain3d = sumPrecip(72);
    const rain15d = sumPrecip(360);

    const sm07 = Number(hourly.soil_moisture_0_to_7cm && hourly.soil_moisture_0_to_7cm[bestIdx]);
    const sm728 = Number(hourly.soil_moisture_7_to_28cm && hourly.soil_moisture_7_to_28cm[bestIdx]);
    const sm28100 = Number(hourly.soil_moisture_28_to_100cm && hourly.soil_moisture_28_to_100cm[bestIdx]);

    let soil = GEOALERT_V92_META.soilMoistureImputeMedian;
    if (!Number.isNaN(sm07) && !Number.isNaN(sm728) && !Number.isNaN(sm28100)) {
      soil = Number(((7 * sm07 + 21 * sm728 + 72 * sm28100) / 100).toFixed(4));
    } else if (!Number.isNaN(sm07)) {
      soil = Number(sm07.toFixed(4));
    }

    return {
      rain1d,
      rain3d,
      rain15d,
      soil,
      observedTime: hourly.time[bestIdx],
      fetchedAt: new Date().toISOString()
    };
  }

  async function predictV92WithBackendOrLocal(rawInput) {
    const feats = computePhysicsFeatures(rawInput);

    // Nếu đã cấu hình PKL_API_URL, gọi trực tiếp mô hình Python mohinh_satlo_v92.pkl
    if (PKL_API_URL) {
      try {
        const resp = await fetch(PKL_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feats)
        });
        if (resp.ok) {
          const apiData = await resp.json();
          const xsAi = Number(apiData.xs_ai);
          const xsGate = Number(apiData.xs_gate);
          const cls = classifyV92Probability(xsGate);
          return {
            features: feats,
            xsAi: Number(xsAi.toFixed(4)),
            xsGate: Number(xsGate.toFixed(4)),
            alert: cls.alert,
            level: cls.label,
            panelLevel: cls.panelLevel,
            tierCode: cls.code,
            engineSource: "mohinh_satlo_v92.pkl (API trực tiếp)"
          };
        }
      } catch (e) {
        console.warn("PKL API không phản hồi, chuyển sang bộ tính V9.2 dự phòng:", e);
      }
    }

    const z =
      -2.35 +
      0.042 * feats.Slope_p90 +
      0.012 * feats.Rain_1d_GPM +
      0.014 * feats.Rain_3d_GPM +
      0.0045 * feats.Rain_15d_CHIRPS +
      3.8 * (feats.Soil_Moisture - GEOALERT_V92_META.soilMoistureImputeMedian) +
      0.025 * feats.Stress_1d +
      0.048 * feats.Stress_3d +
      0.008 * feats.Stress_15d +
      0.02 * feats.Hydro_Stress;

    const xsAi = 1 / (1 + Math.exp(-z));
    const gateFactor = softSlopeGateFactor(feats.Slope_p90);
    const xsGate = Number((xsAi * gateFactor).toFixed(4));
    const cls = classifyV92Probability(xsGate);

    return {
      features: feats,
      xsAi: Number(xsAi.toFixed(4)),
      xsGate,
      alert: cls.alert,
      level: cls.label,
      panelLevel: cls.panelLevel,
      tierCode: cls.code,
      engineSource: "GeoAlert V9.2 (Hiệu chỉnh Sigmoid + Soft Gate)"
    };
  }

  function buildRightPanelExplanation(pred, sourceLabel, updatedAtIso) {
    const f = pred.features;
    const rawWeights = [
      {
        label: "Mưa tích lũy 15 ngày",
        value: Number(f.Rain_15d_CHIRPS.toFixed(1)),
        unit: "mm",
        score: Math.max(0.05, (f.Rain_15d_CHIRPS / 250) * 0.32)
      },
      {
        label: "Độ dốc địa hình (Slope_p90)",
        value: Number(f.Slope_p90.toFixed(1)),
        unit: "°",
        score: Math.max(0.05, (f.Slope_p90 / 35) * 0.28)
      },
      {
        label: "Mưa kích hoạt 3 ngày",
        value: Number(f.Rain_3d_GPM.toFixed(1)),
        unit: "mm",
        score: Math.max(0.04, (f.Rain_3d_GPM / 60) * 0.22)
      },
      {
        label: "Mưa ngày gần nhất (24h)",
        value: Number(f.Rain_1d_GPM.toFixed(1)),
        unit: "mm",
        score: Math.max(0.03, (f.Rain_1d_GPM / 35) * 0.12)
      },
      {
        label: "Độ ẩm đất nền (0–100 cm)",
        value: Number(f.Soil_Moisture.toFixed(2)),
        unit: "m³/m³",
        score: Math.max(0.02, (f.Soil_Moisture / 0.5) * 0.06)
      }
    ];

    const totalScore = rawWeights.reduce((acc, item) => acc + item.score, 0) || 1;
    const factors = rawWeights.map((item) => ({
      label: item.label,
      value: item.value,
      unit: item.unit,
      contribution: Number((item.score / totalScore).toFixed(3))
    }));

    let summaryReason = "";
    if (f.Slope_p90 <= 4.0) {
      summaryReason =
        "Địa hình bằng phẳng (Slope_p90 = " + f.Slope_p90.toFixed(1) + "° ≤ 4,0°), cổng độ dốc mềm khóa xác suất về mức an toàn bất kể lượng mưa.";
    } else if (pred.tierCode === "RED") {
      summaryReason =
        "Nguy cơ Đỏ khẩn cấp (≥ 69%): Sườn dốc lớn (" + f.Slope_p90.toFixed(1) + "°) kết hợp mưa 3 ngày (" +
        f.Rain_3d_GPM.toFixed(1) + " mm) và mưa tích lũy 15 ngày (" + f.Rain_15d_CHIRPS.toFixed(1) +
        " mm) đẩy ứng suất thủy văn Hydro_Stress lên " + f.Hydro_Stress.toFixed(2) + ".";
    } else if (pred.tierCode === "YELLOW") {
      summaryReason =
        "Nguy cơ Vàng cần theo dõi (≥ 37,25%): Độ dốc " + f.Slope_p90.toFixed(1) + "° kèm lượng mưa tích lũy 15 ngày " +
        f.Rain_15d_CHIRPS.toFixed(1) + " mm và độ ẩm đất " + f.Soil_Moisture.toFixed(2) + " làm gia tăng ứng suất sườn dốc.";
    } else {
      summaryReason =
        "Mức an toàn (< 37,25%): Lượng mưa ngắn hạn (" + f.Rain_3d_GPM.toFixed(1) +
        " mm / 3 ngày) và ứng suất thủy văn (" + f.Hydro_Stress.toFixed(2) + ") chưa vượt ngưỡng kích hoạt sạt lở tại độ dốc " +
        f.Slope_p90.toFixed(1) + "°.";
    }

    return {
      type: "v92",
      level: pred.panelLevel,
      probability: pred.xsGate,
      probabilityMax: Math.min(1, Number((pred.xsGate * 1.06).toFixed(4))),
      factors,
      summaryReason,
      updatedAt: updatedAtIso || new Date().toISOString(),
      source: sourceLabel || pred.engineSource
    };
  }

  function initV92LabUI() {
    if (global.__GEOALERT_V92_BOUND__) return;
    const sel = document.getElementById("ga-st-select");
    const out = document.getElementById("ga-v92-result");
    const inSlope = document.getElementById("ga-in-slope");
    const inR1d = document.getElementById("ga-in-r1d");
    const inR3d = document.getElementById("ga-in-r3d");
    const inR15d = document.getElementById("ga-in-r15d");
    const inSoil = document.getElementById("ga-in-soil");
    const btnApply = document.getElementById("ga-st-apply-btn");
    const btnRun = document.getElementById("ga-v92-run-btn");

    if (!sel || !out || !btnRun) return;
    global.__GEOALERT_V92_BOUND__ = true;

    sel.innerHTML = "";
    GEOALERT_V92_STRESS_TEST.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = "#" + (item.id + 1) + " · " + item.place + " (" + item.lat.toFixed(4) + ", " + item.lon.toFixed(4) + ")";
      sel.appendChild(opt);
    });

    function fillInputsFromCase(item) {
      inSlope.value = item.slope;
      inR1d.value = item.rain1d;
      inR3d.value = item.rain3d;
      inR15d.value = item.rain15d;
      inSoil.value = item.soil;
    }

    async function executeLivePrediction(pushToMap) {
      const item = GEOALERT_V92_STRESS_TEST[Number(sel.value)] || GEOALERT_V92_STRESS_TEST[0];
      out.innerHTML =
        "<div style='color:#1F4D2B;font-weight:600;'>Đang kéo dữ liệu mưa &amp; độ ẩm đất cập nhật mới nhất tại " +
        item.place + " (" + item.lat.toFixed(4) + ", " + item.lon.toFixed(4) + ")...</div>";

      let liveInfo = null;
      let dataModeText = "";
      try {
        liveInfo = await fetchLiveWeatherV92(item.lat, item.lon);
        inR1d.value = liveInfo.rain1d;
        inR3d.value = liveInfo.rain3d;
        inR15d.value = liveInfo.rain15d;
        inSoil.value = liveInfo.soil;
        dataModeText = "Dữ liệu khí tượng hiện tại (cập nhật lúc " + new Date(liveInfo.fetchedAt).toLocaleTimeString("vi-VN") + ")";
      } catch (err) {
        dataModeText = "Dữ liệu đang nhập trên bảng (không kéo được API thời tiết lúc này)";
      }

      const pred = await predictV92WithBackendOrLocal({
        slope: inSlope.value,
        rain1d: inR1d.value,
        rain3d: inR3d.value,
        rain15d: inR15d.value,
        soil: inSoil.value
      });

      const updatedIso = (liveInfo && liveInfo.fetchedAt) || new Date().toISOString();
      const sourceLabel = pred.engineSource + " · " + dataModeText;

      out.innerHTML =
        "<div><strong>Địa điểm:</strong> " + item.place + " <span style='color:#64748b;'>(" + item.lat.toFixed(4) + ", " + item.lon.toFixed(4) + ")</span></div>" +
        "<div><strong>Xác suất dự đoán hiện tại (XS_Gate / XS_AI):</strong> <strong>" + (pred.xsGate * 100).toFixed(2) + "%</strong> / " + (pred.xsAi * 100).toFixed(2) + "% — <strong>" + pred.level + "</strong></div>" +
        "<div style='font-size:12.5px;color:#334155;margin-top:4px;'>Slope_p90=" + pred.features.Slope_p90.toFixed(2) + "° · Mưa 24h=" + pred.features.Rain_1d_GPM + "mm · Mưa 3d=" + pred.features.Rain_3d_GPM + "mm · Mưa 15d=" + pred.features.Rain_15d_CHIRPS + "mm · Độ ẩm đất=" + pred.features.Soil_Moisture + " · Hydro_Stress=" + pred.features.Hydro_Stress + "</div>" +
        "<div style='font-size:12px;color:#1F4D2B;margin-top:4px;'>Nguồn: " + sourceLabel + "</div>";

      const rightPanelPayload = buildRightPanelExplanation(pred, sourceLabel, updatedIso);

      if (pushToMap && typeof global.setGeoAlertV92Point === "function") {
        global.setGeoAlertV92Point(item.lat, item.lon, item.place + " (GeoAlert V9.2)", rightPanelPayload);
      } else if (typeof global.updateGeoAlertV92RightPanel === "function") {
        global.updateGeoAlertV92RightPanel(rightPanelPayload);
      }
    }

    sel.addEventListener("change", () => {
      const item = GEOALERT_V92_STRESS_TEST[Number(sel.value)] || GEOALERT_V92_STRESS_TEST[0];
      fillInputsFromCase(item);
      executeLivePrediction(false);
    });

    if (btnApply) {
      btnApply.addEventListener("click", () => {
        executeLivePrediction(true);
      });
    }

    btnRun.addEventListener("click", () => {
      executeLivePrediction(true);
    });

    fillInputsFromCase(GEOALERT_V92_STRESS_TEST[0]);
    out.innerHTML =
      "<div style='color:#334155;'>Chọn địa điểm bên trên rồi nhấn <strong>Chạy dự đoán V9.2</strong> hoặc <strong>Nạp lên bản đồ</strong> để lấy dữ liệu thời tiết – độ ẩm đất mới nhất ngay lúc này và hiển thị kết quả sang cột bên phải.</div>";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initV92LabUI);
  } else {
    initV92LabUI();
  }

  global.GEOALERT_V92 = {
    meta: GEOALERT_V92_META,
    stressTest: GEOALERT_V92_STRESS_TEST,
    softSlopeGateFactor,
    classifyV92Probability,
    fetchLiveWeatherV92,
    predictV92WithBackendOrLocal
  };
})(window);