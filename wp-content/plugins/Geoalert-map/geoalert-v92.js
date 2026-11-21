(function (global) {
  "use strict";

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
    },
    metricsSummary: {
      aucHoldout: 0.8546,
      aucTemporal2016: 0.8397,
      brierGated: 0.1566,
      eceTest: 0.0562,
      yellowRecall: 0.8377,
      yellowPrecision: 0.7262,
      redPrecision: 0.8512,
      redRecall: 0.6272,
      stressTestPassRate: "100.0% (19/19)"
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
    {"id":24,"group":"E. Đèo Mưa lớn 05/23","place":"Đèo Khánh Lê (05/23)","lat":12.185,"lon":108.715,"date":"2023-05-20","label":-1,"slope":42.5741,"rain1d":3.33,"rain3d":15.73,"rain15d":294.089,"soil":0.4387,"stress1d":2.2529,"stress3d":10.642,"stress15d":198.9639,"hydroStress":4.6688,"xsAi":0.627,"xsGate":0.627,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"},
    {"id":25,"group":"E. Đèo Mưa lớn 05/23","place":"Đèo Prenn (05/23)","lat":11.9,"lon":108.445,"date":"2023-05-20","label":-1,"slope":23.9422,"rain1d":11.98,"rain3d":20.26,"rain15d":265.176,"soil":0.4242,"stress1d":4.8617,"stress3d":8.2218,"stress15d":107.6126,"hydroStress":3.4874,"xsAi":0.6382,"xsGate":0.6382,"alert":1,"level":"Vàng (Theo dõi)","eval":"Quan sát"},
    {"id": 26, "group": "E. Đèo Mưa lớn 05/23", "place": "Đèo Con Ó (05/23)", "lat": 11.5956, "lon": 107.5519, "date": "2023-05-20", "label": -1, "slope": 18.0541, "rain1d": 25.43, "rain3d": 37.94, "rain15d": 159.64, "soil": 0.4096, "stress1d": 7.8811, "stress3d": 11.7582, "stress15d": 49.4748, "hydroStress": 4.8162, "xsAi": 0.6669, "xsGate": 0.6669, "alert": 1, "level": "Vàng (Theo dõi)", "eval": "Quan sát"}
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
      return { code: "RED", label: "Đỏ (Khẩn cấp)", alert: 1 };
    }
    if (p >= yellowSafetyFirst) {
      return { code: "YELLOW", label: "Vàng (Theo dõi)", alert: 1 };
    }
    return { code: "GREEN", label: "Xanh (An toàn)", alert: 0 };
  }

  function predictV92FromInputs(rawInput) {
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

    const z =
      -2.35 +
      0.042 * slope +
      0.012 * rain1d +
      0.014 * rain3d +
      0.0045 * rain15d +
      3.8 * (soil - GEOALERT_V92_META.soilMoistureImputeMedian) +
      0.025 * stress1d +
      0.048 * stress3d +
      0.008 * stress15d +
      0.02 * hydroStress;

    const xsAi = 1 / (1 + Math.exp(-z));
    const gateFactor = softSlopeGateFactor(slope);
    const xsGate = Number((xsAi * gateFactor).toFixed(4));
    const cls = classifyV92Probability(xsGate);

    return {
      slope,
      rain1d,
      rain3d,
      rain15d,
      soil,
      stress1d,
      stress3d,
      stress15d,
      hydroStress,
      xsAi: Number(xsAi.toFixed(4)),
      xsGate,
      alert: cls.alert,
      level: cls.label,
      tierCode: cls.code
    };
  }

  global.GEOALERT_V92 = {
    meta: GEOALERT_V92_META,
    stressTest: GEOALERT_V92_STRESS_TEST,
    softSlopeGateFactor,
    classifyV92Probability,
    predictV92FromInputs
  };
})(window);