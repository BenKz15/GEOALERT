(function (global) {
  "use strict";

  const GEOALERT_V92_META = {
    version: "GeoAlert V9.2 (Final Disaster-Grade Production)",
    terrainResolutionM: 30,
    waterMask: "ESA WorldCover (Class 80)",
    calibrationMethod: "sigmoid",
    softSlopeGate: { zeroDeg: 4.0, fullDeg: 8.0 },
    thresholds: {
      yellowSafetyFirst: 0.3725,
      yellowBalancedMode: 0.4875,
      redActionFirst: 0.69
    }
  };

  const VERIFICATION_GROUPS = [
    {
      group: "1. Sạt lở thực tế (Đã định vị Google Earth & kiểm chứng 30m)",
      items: [
        {
          id: "baoloc_20230730",
          label: "#1 · Đèo Bảo Lộc — Ngày xảy ra sạt lở (30/07/2023)",
          lat: 11.455536,
          lon: 107.717375,
          date: "2023-07-30",
          expected: "Cao (Ưu tiên >= 88%)",
          note: "Tọa độ thực địa 11°27'19.93\"N 107°43'02.55\"E (cao độ 680.5m). Kiểm chứng 30m: XS tâm 90.21%, lệch 1.7m."
        },
        {
          id: "baoloc_20230729",
          label: "#2 · Đèo Bảo Lộc — Cảnh báo sớm trước 24h (29/07/2023)",
          lat: 11.455536,
          lon: 107.717375,
          date: "2023-07-29",
          expected: "Cao (Ưu tiên >= 88%)",
          note: "Cùng tọa độ điểm sạt 30/07/2023, dữ liệu trước 24h. Kiểm chứng 30m: XS tâm 88.30%, lệch 1.7m."
        },
        {
          id: "mimosa_20251118",
          label: "#3 · Đèo Mimosa — Cảnh báo sớm trước 24h (18/11/2025)",
          lat: 11.904572,
          lon: 108.463161,
          date: "2025-11-18",
          expected: "Cao (Ưu tiên >= 88%)",
          note: "Tọa độ thực địa 11°54'16.46\"N 108°27'47.38\"E (cao độ 1207.6m). Kiểm chứng 30m: XS tâm 91.73%, lệch 10.5m."
        },
        {
          id: "mimosa_20251119",
          label: "#4 · Đèo Mimosa — Ngày xảy ra sạt lở (19/11/2025)",
          lat: 11.904572,
          lon: 108.463161,
          date: "2025-11-19",
          expected: "Cao",
          note: "Cùng tọa độ thực địa sự cố sạt lở Đèo Mimosa ngày 19/11/2025."
        }
      ]
    },
    {
      group: "2. Đối chứng Mùa khô (Tại đúng tọa độ sạt lở — Chứng minh 0% báo giả)",
      items: [
        {
          id: "baoloc_dry_20230215",
          label: "#5 · Đèo Bảo Lộc — Đối chứng Mùa khô (15/02/2023)",
          lat: 11.455536,
          lon: 107.717375,
          date: "2023-02-15",
          expected: "Thấp (An toàn)",
          note: "Cùng tọa độ vết sạt 30/07/2023 nhưng vào mùa khô. Kiểm chứng 30m: XS tâm 11.32%, 0 pixel ưu tiên."
        },
        {
          id: "mimosa_dry_20250215",
          label: "#6 · Đèo Mimosa — Đối chứng Mùa khô (15/02/2025)",
          lat: 11.904572,
          lon: 108.463161,
          date: "2025-02-15",
          expected: "Thấp (An toàn)",
          note: "Cùng tọa độ vết sạt 19/11/2025 nhưng vào mùa khô để đối chứng phản ứng theo mưa."
        }
      ]
    },
    {
      group: "3. Đối chứng Đô thị bằng phẳng & Mặt nước (Kiểm chứng lọc địa hình)",
      items: [
        {
          id: "lamvien_flat",
          label: "#7 · Quảng trường Lâm Viên — Đà Lạt (Bằng phẳng)",
          lat: 11.9392,
          lon: 108.4419,
          date: "2023-07-30",
          expected: "Thấp (An toàn)",
          note: "Khu đô thị bằng phẳng tại trung tâm Đà Lạt."
        },
        {
          id: "lienkhuong_flat",
          label: "#8 · Sân bay Liên Khương — Đức Trọng (Bằng phẳng)",
          lat: 11.7519,
          lon: 108.3711,
          date: "2023-07-30",
          expected: "Thấp (An toàn)",
          note: "Khu vực đường băng bằng phẳng."
        },
        {
          id: "baoloc_city_flat",
          label: "#9 · Trung tâm TP. Bảo Lộc (Bằng phẳng)",
          lat: 11.5458,
          lon: 107.8055,
          date: "2023-07-30",
          expected: "Thấp (An toàn)",
          note: "Khu dân cư trung tâm dù cùng ngày mưa bão 30/07/2023."
        },
        {
          id: "liennghia_flat",
          label: "#10 · Thị trấn Liên Nghĩa — Đức Trọng (Bằng phẳng)",
          lat: 11.7355,
          lon: 108.3735,
          date: "2023-07-30",
          expected: "Thấp (An toàn)",
          note: "Khu vực đô thị bằng phẳng."
        },
        {
          id: "cattien_flat",
          label: "#11 · Thị trấn Cát Tiên (Đồng bằng chuẩn)",
          lat: 11.5664,
          lon: 107.3676,
          date: "2023-07-30",
          expected: "Thấp (An toàn)",
          note: "Vùng đồng bằng thấp, độ dốc gần 0 độ."
        },
        {
          id: "baoloc_lake_water",
          label: "#12 · Mặt nước hồ Bảo Lộc (Test lọc mặt nước Water Mask)",
          lat: 11.57113,
          lon: 107.81668,
          date: "2023-07-30",
          expected: "Mặt nước (0%)",
          note: "Điểm kiểm chứng lớp lọc ESA WorldCover: ngày bão lớn vẫn trả 0% (Mặt nước) tại điểm."
        }
      ]
    }
  ];

  const FLAT_ITEMS = [];
  VERIFICATION_GROUPS.forEach((grp) => {
    grp.items.forEach((item) => FLAT_ITEMS.push(item));
  });

  function renderNote(noteEl, item) {
    if (!noteEl || !item) return;
    noteEl.innerHTML =
      `<div><strong>Kỳ vọng mô hình V9.2:</strong> <span style="color:#1F4D2B;font-weight:600;">${item.expected}</span> · <strong>Ngày:</strong> ${item.date} · <strong>Tọa độ:</strong> ${item.lat}, ${item.lon}</div>` +
      `<div style="margin-top:4px;color:#475569;">${item.note}</div>`;
  }

  function applyVerificationItem(item, shouldRunMap) {
    if (!item) return;
    const noteEl = document.getElementById("ga-st-note");
    renderNote(noteEl, item);

    if (shouldRunMap && typeof global.runGeoAlertVerificationPoint === "function") {
      global.runGeoAlertVerificationPoint(item);
    }
  }

  function initV92LabUI() {
    if (global.__GEOALERT_V92_BOUND__) return;
    const sel = document.getElementById("ga-st-select");
    const btnApply = document.getElementById("ga-st-apply-btn");
    const noteEl = document.getElementById("ga-st-note");
    if (!sel) return;

    global.__GEOALERT_V92_BOUND__ = true;
    sel.innerHTML = "";

    VERIFICATION_GROUPS.forEach((grp) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = grp.group;
      grp.items.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.label;
        optgroup.appendChild(opt);
      });
      sel.appendChild(optgroup);
    });

    function getSelectedItem() {
      const id = sel.value;
      return FLAT_ITEMS.find((x) => x.id === id) || FLAT_ITEMS[0];
    }

    sel.addEventListener("change", () => {
      applyVerificationItem(getSelectedItem(), true);
    });

    if (btnApply) {
      btnApply.addEventListener("click", () => {
        applyVerificationItem(getSelectedItem(), true);
      });
    }

    renderNote(noteEl, FLAT_ITEMS[0]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initV92LabUI);
  } else {
    initV92LabUI();
  }

  global.GEOALERT_V92 = {
    meta: GEOALERT_V92_META,
    groups: VERIFICATION_GROUPS,
    items: FLAT_ITEMS
  };
})(window);