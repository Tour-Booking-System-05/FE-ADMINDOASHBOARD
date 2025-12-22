// assets/js/statistics-page.js
(() => {
  const API_BASE = "http://localhost:8080/api/v1/statistic";
  const STATUS = {
    PENDING: "Đợi đi",
    PROCESS: "Đang đi",
    COMPLETE: "Đã đi",
    CANCEL: "Hủy",
  };

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);

  const els = {
    selectMonth: $("selectMonth"),
    selectType: $("selectType"),
    exportBtn: $("exportReportBtn"),

    statRevenue: $("statRevenue"),
    statOrders: $("statOrders"),
    statCustomers: $("statCustomers"),
    statCancelRate: $("statCancelRate"),
  };

  // ===== Charts instances =====
  const charts = {
    revenueArea: null,  // ApexCharts
    customerLine: null, // ApexCharts
    orderPie: null,     // Chart.js
    vipDonut: null,     // Chart.js
  };

  // ===== Auth Fetch =====
  function authFetch(url, options = {}) {
    const token = sessionStorage.getItem("token");
    if (!token) {
      window.location.href = "login.html";
      return Promise.reject("No token -> redirect login");
    }

    const isFormData = options.body instanceof FormData;
    const method = (options.method || "GET").toUpperCase();

    const headers = {
      ...(options.headers || {}),
      Authorization: "Bearer " + token,
      Accept: "application/json",
    };

    // Chỉ set JSON content-type khi có body, không phải FormData, và không phải GET
    if (!isFormData && options.body && method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    return fetch(url, { ...options, headers }).then(async (res) => {
      // 401: token hết hạn/sai => xoá token & về login
      if (res.status === 401) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("me");
        sessionStorage.removeItem("userEmail");
        sessionStorage.removeItem("userId");
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        window.location.href = "login.html";
        return Promise.reject("401 Unauthorized -> redirect login");
      }

      // 403: không đủ quyền / endpoint chặn => KHÔNG XOÁ token
      if (res.status === 403) {
        const text = await res.text().catch(() => "");
        console.error("403 Forbidden:", url, text);
        alert("Bạn không có quyền truy cập chức năng này (403).");
        return Promise.reject("403 Forbidden");
      }

      return res;
    });
  }

  async function apiGet(path) {
    const url = `${API_BASE}${path}`;
    const res = await authFetch(url, { method: "GET" });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${path} failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  // ===== Utils =====
  function getRange() {
    const text = els.selectMonth?.value || "12 tháng";
    if (text.includes("12")) return 12;
    if (text.includes("6")) return 6;
    if (text.includes("3")) return 3;
    return 1;
  }

  function getSelectedType() {
    return els.selectType?.value || "Doanh thu";
  }

  function safeNumber(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }

  function formatVnd(n) {
    return safeNumber(n).toLocaleString("vi-VN") + " ₫";
  }

  async function loadKpis(range) {
    const d = await apiGet(`/kpis?range=${range}`);

    // số liệu chính
    els.statRevenue.textContent = formatVnd(d.revenue);
    els.statOrders.textContent = String(safeNumber(d.orders));
    els.statCustomers.textContent = String(safeNumber(d.customers));
    els.statCancelRate.textContent =
      (safeNumber(d.cancelRate) * 100).toFixed(2) + "%";

    // helper set % (tự đổi màu/icon)
    const setPct = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;

      const pct = safeNumber(v);
      const up = pct >= 0;

      el.classList.remove("text-success", "text-danger", "text-secondary");
      el.classList.add(up ? "text-success" : "text-danger");

      const icon = up ? "bi bi-graph-up-arrow" : "bi bi-graph-down-arrow";
      el.innerHTML = `<i class="${icon}"></i> ${pct.toFixed(2)}% so với kỳ trước`;
    };

    setPct("statRevenuePct", d.revenueChangePct);
    setPct("statOrdersPct", d.ordersChangePct);
    setPct("statCustomersPct", d.customersChangePct);
    setPct("statCancelRatePct", d.cancelRateChangePct);
  }



  // ===== Apex helpers =====
  function destroyApex(inst) {
    if (inst && typeof inst.destroy === "function") inst.destroy();
  }

  function renderAreaChart(labels, values, title) {
    destroyApex(charts.revenueArea);

    const el = document.querySelector("#areaChart");
    if (!el) return;

    charts.revenueArea = new ApexCharts(el, {
      series: [{ name: title, data: values }],
      chart: { type: "area", height: 350, toolbar: { show: true } },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth" },
      xaxis: { categories: labels, title: { text: "Tháng" } },
      yaxis: { title: { text: title } },
      tooltip: { y: { formatter: (v) => safeNumber(v).toLocaleString("vi-VN") } },
    });

    charts.revenueArea.render();
  }

  function renderLineChart(labels, values, title) {
    destroyApex(charts.customerLine);

    const el = document.querySelector("#lineChart");
    if (!el) return;

    charts.customerLine = new ApexCharts(el, {
      series: [{ name: title, data: values }],
      chart: { type: "line", height: 350, zoom: { enabled: false } },
      dataLabels: { enabled: true },
      stroke: { curve: "straight" },
      xaxis: { categories: labels, title: { text: "Tháng" } },
      yaxis: { title: { text: title } },
    });

    charts.customerLine.render();
  }

  // ===== Chart.js helpers =====
  function destroyChartJs(inst) {
    if (inst && typeof inst.destroy === "function") inst.destroy();
  }

  function normalizeOrderStatusRows(rows) {
    const out = { PENDING: 0, PROCESS: 0, COMPLETE: 0, CANCEL: 0 };

    (rows || []).forEach((r) => {
      const k = r.orderStatus;         // backend trả enum string
      const q = safeNumber(r.quantity);

      if (k === "PENDING" || k === 0) out.PENDING = q;
      else if (k === "PROCESS" || k === 1) out.PROCESS = q;
      else if (k === "COMPLETE" || k === 2) out.COMPLETE = q;
      else if (k === "CANCEL" || k === 3) out.CANCEL = q;
    });

    return out;
  }

  function renderOrderStatusPie(rows) {
    const canvas = $("pieChart");
    if (!canvas) return;

    const s = normalizeOrderStatusRows(rows);
    destroyChartJs(charts.orderPie);

    charts.orderPie = new Chart(canvas, {
      type: "pie",
      data: {
        labels: [STATUS.PENDING, STATUS.PROCESS, STATUS.COMPLETE, STATUS.CANCEL],
        datasets: [
          {
            data: [s.PENDING, s.PROCESS, s.COMPLETE, s.CANCEL],
            backgroundColor: [
              "#6c757d", // PENDING - xám
              "#0d6efd", // PROCESS - xanh dương
              "#198754", // COMPLETE - xanh lá
              "#dc3545", // CANCEL - đỏ
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" } },
      },
    });
  }


  function renderVipDonut(dto) {
    const canvas = $("donutChart");
    if (!canvas) return;

    destroyChartJs(charts.vipDonut);

    // ĐÚNG thứ tự: BRONZE, SILVER, GOLD, DIAMOND
    const data = [
      safeNumber(dto?.bronze),
      safeNumber(dto?.silver),
      safeNumber(dto?.gold),
      safeNumber(dto?.diamond),
    ];

    charts.vipDonut = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Đồng", "Bạc", "Vàng", "Kim cương"],
        datasets: [
          {
            data,
            // Bạn yêu cầu fix màu => set cố định theo rank
            backgroundColor: [
              "#CD7F32", // Bronze
              "#C0C0C0", // Silver
              "#FFD700", // Gold
              "#00BFFF", // Diamond (xanh)
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "bottom" },
        },
        cutout: "65%",
      },
    });
  }

  // ===== Load charts =====
  async function loadOverviewCharts(range) {
    const type = getSelectedType();

    if (type === "Doanh thu") {
      const series = await apiGet(`/revenue-series?range=${range}`);
      renderAreaChart(
        series.map((x) => x.label),
        series.map((x) => safeNumber(x.value)),
        "Doanh thu"
      );
    } else if (type === "Khách hàng") {
      const series = await apiGet(`/customer-series?range=${range}`);
      renderAreaChart(
        series.map((x) => x.label),
        series.map((x) => safeNumber(x.value)),
        "Khách hàng"
      );
    } else {
      const series = await apiGet(`/revenue-series?range=${range}`);
      renderAreaChart(
        series.map((x) => x.label),
        series.map((x) => safeNumber(x.value)),
        "Doanh thu (tạm thời)"
      );
    }

    const status = await apiGet(`/order-status?range=${range}`);
    renderOrderStatusPie(status);
  }

  async function loadCustomerCharts(range) {
    const vip = await apiGet(`/customer-vip?range=${range}`);
    renderVipDonut(vip);

    const series = await apiGet(`/customer-series?range=${range}`);
    renderLineChart(
      series.map((x) => x.label),
      series.map((x) => safeNumber(x.value)),
      "Khách hàng theo tháng"
    );
  }

  // ===== Reload =====
  async function reloadAll() {
    const range = getRange();
    await Promise.all([
      loadKpis(range),
      loadOverviewCharts(range),
      loadCustomerCharts(range),
    ]);
  }

  // ===== Events =====
  function bindEvents() {
    els.selectMonth?.addEventListener("change", () => reloadAll().catch(console.error));
    els.selectType?.addEventListener("change", () => reloadAll().catch(console.error));
    els.exportBtn?.addEventListener("click", async () => {
      try {
        const range = getRange();
        await exportReportXlsx(range);
      } catch (e) {
        console.error(e);
        alert("Xuất Excel thất bại");
      }
    });


  }

  // ===== Boot =====
  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    reloadAll().catch(console.error);
  });
  // ===== Export helpers =====
  function csvEscape(v) {
    if (v === null || v === undefined) return "";
    const s = String(v).replaceAll('"', '""');
    return `"${s}"`;
  }

  function downloadTextFile(filename, content, mime = "text/csv;charset=utf-8;") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function rangeLabel(range) {
    if (range === 12) return "12-thang";
    if (range === 6) return "6-thang";
    if (range === 3) return "3-thang";
    return "1-thang";
  }

  function nowStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  // ===== Export report (calls APIs again to ensure latest) =====
  // async function exportReport(range) {
  //   // lấy lại data mới nhất theo range đang chọn
  //   const [kpis, revenueSeries, customerSeries, orderStatus, vip] = await Promise.all([
  //     apiGet(`/kpis?range=${range}`),
  //     apiGet(`/revenue-series?range=${range}`),
  //     apiGet(`/customer-series?range=${range}`),
  //     apiGet(`/order-status?range=${range}`),
  //     apiGet(`/customer-vip?range=${range}`),
  //   ]);

  //   // build CSV gồm nhiều "section"
  //   const lines = [];
  //   lines.push(csvEscape("TRAVEL ADMIN - BÁO CÁO THỐNG KÊ"));
  //   lines.push(csvEscape(`TThời gian: ${range} tháng`));
  //   lines.push(csvEscape(`Báo cáo được xuất lúc: ${new Date().toLocaleString("vi-VN")}`));
  //   lines.push(""); // blank line

  //   // KPI
  //   lines.push(csvEscape("Tổng quan"));
  //   lines.push(["Chỉ số", "Giá trị"].map(csvEscape).join(","));
  //   lines.push(["Doanh thu", kpis.revenue].map(csvEscape).join(","));
  //   lines.push(["Đơn đặt", kpis.orders].map(csvEscape).join(","));
  //   lines.push(["Khách hàng", kpis.customers].map(csvEscape).join(","));
  //   lines.push([
  //     "Tỉ lệ hủy chuyến đi",
  //     (safeNumber(kpis.cancelRate) * 100).toFixed(2) + "%"
  //   ].map(csvEscape).join(","));
  //   lines.push(""); // blank

  //   lines.push(csvEscape("% thay đổi so với kỳ trước"));
  //   lines.push(["Chỉ số", "% thay đổi"].map(csvEscape).join(","));
  //   lines.push(["Doanh thu", kpis.revenueChangePct].map(csvEscape).join(","));
  //   lines.push(["Đơn đặt", kpis.ordersChangePct].map(csvEscape).join(","));
  //   lines.push(["Khách hàng", kpis.customersChangePct].map(csvEscape).join(","));
  //   lines.push(["Tỉ lệ hủy", kpis.cancelRateChangePct].map(csvEscape).join(","));
  //   lines.push("");

  //   // Revenue series
  //   lines.push(csvEscape("Doanh thu theo tháng"));
  //   lines.push(["Tháng", "Doanh thu"].map(csvEscape).join(","));
  //   (revenueSeries || []).forEach(p => {
  //     lines.push([p.label, p.value].map(csvEscape).join(","));
  //   });
  //   lines.push("");

  //   // Order status
  //   lines.push(csvEscape("Trạng thái đơn đặt"));
  //   lines.push(["Trạng thái", "Số lượng"].map(csvEscape).join(","));
  //   (orderStatus || []).forEach(r => {
  //     // backend trả orderStatus enum string + quantity
  //     lines.push([r.orderStatus, r.quantity].map(csvEscape).join(","));
  //   });
  //   lines.push("");

  //   // Customer VIP
  //   lines.push(csvEscape("Khách hàng theo mức VIP"));
  //   lines.push(["Hạng", "Số lượng"].map(csvEscape).join(","));
  //   lines.push(["BRONZE", vip.bronze].map(csvEscape).join(","));
  //   lines.push(["SILVER", vip.silver].map(csvEscape).join(","));
  //   lines.push(["GOLD", vip.gold].map(csvEscape).join(","));
  //   lines.push(["DIAMOND", vip.diamond].map(csvEscape).join(","));
  //   lines.push("");

  //   // Customer series
  //   lines.push(csvEscape("Khách hàng theo tháng"));
  //   lines.push(["Tháng", "Số khách hàng"].map(csvEscape).join(","));
  //   (customerSeries || []).forEach(p => {
  //     lines.push([p.label, p.value].map(csvEscape).join(","));
  //   });

  //   const filename = `bao-cao-thong-ke_${rangeLabel(range)}_${nowStamp()}.csv`;
  //   downloadTextFile(filename, lines.join("\n"));
  // }
  async function exportReportXlsx(range) {
    const [kpis, revenueSeries, customerSeries, orderStatus, vip] = await Promise.all([
      apiGet(`/kpis?range=${range}`),
      apiGet(`/revenue-series?range=${range}`),
      apiGet(`/customer-series?range=${range}`),
      apiGet(`/order-status?range=${range}`),
      apiGet(`/customer-vip?range=${range}`),
    ]);

    const wb = XLSX.utils.book_new();
    const rows = [];

    // ===== HEADER =====
    rows.push(["TRAVEL ADMIN - BÁO CÁO THỐNG KÊ"]);
    rows.push([`Thời gian: ${range} tháng`]);
    rows.push([`Xuất lúc: ${new Date().toLocaleString("vi-VN")}`]);
    rows.push([]);

    // ===== KPI =====
    rows.push(["KPI"]);
    rows.push(["Chỉ số", "Giá trị"]);
    rows.push(["Doanh thu", kpis.revenue]);
    rows.push(["Đơn đặt", kpis.orders]);
    rows.push(["Khách hàng", kpis.customers]);
    rows.push(["Tỉ lệ huỷ (%)", Number((safeNumber(kpis.cancelRate) * 100).toFixed(2))]);
    rows.push([]);

    rows.push(["% thay đổi so với kỳ trước"]);
    rows.push(["Chỉ số", "%"]);
    rows.push(["Doanh thu", Number(safeNumber(kpis.revenueChangePct).toFixed(2))]);
    rows.push(["Đơn đặt", Number(safeNumber(kpis.ordersChangePct).toFixed(2))]);
    rows.push(["Khách hàng", Number(safeNumber(kpis.customersChangePct).toFixed(2))]);
    rows.push(["Tỉ lệ huỷ", Number(safeNumber(kpis.cancelRateChangePct).toFixed(2))]);
    rows.push([]);

    // ===== DOANH THU THEO THÁNG =====
    rows.push(["Doanh thu theo tháng"]);
    rows.push(["Tháng", "Doanh thu"]);
    (revenueSeries || []).forEach(p => {
      rows.push([p.label, safeNumber(p.value)]);
    });
    rows.push([]);

    // ===== TRẠNG THÁI ĐƠN =====
    rows.push(["Trạng thái đơn hàng"]);
    rows.push(["Trạng thái", "Số lượng"]);

    (orderStatus || []).forEach(r => {
      let label = r.orderStatus;

      switch (r.orderStatus) {
        case "PENDING":
          label = "Đợi đi";
          break;
        case "PROCESS":
          label = "Đang đi";
          break;
        case "COMPLETE":
          label = "Đã đi";
          break;
        case "CANCEL":
          label = "Đã hủy";
          break;
      }

      rows.push([label, safeNumber(r.quantity)]);
    });

    rows.push([]);


    // ===== KHÁCH HÀNG VIP =====
    rows.push(["Khách hàng theo hạng VIP"]);
    rows.push(["Hạng", "Số lượng"]);
    rows.push(["Đồng", safeNumber(vip.bronze)]);
    rows.push(["Bạc", safeNumber(vip.silver)]);
    rows.push(["Vàng", safeNumber(vip.gold)]);
    rows.push(["Kim cương", safeNumber(vip.diamond)]);
    rows.push([]);

    // ===== KHÁCH HÀNG THEO THÁNG =====
    rows.push(["Khách hàng theo tháng"]);
    rows.push(["Tháng", "Số khách hàng"]);
    (customerSeries || []).forEach(p => {
      rows.push([p.label, safeNumber(p.value)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // chỉnh độ rộng cột cho dễ đọc
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, "BaoCaoThongKe");

    const filename = `bao-cao-thong-ke_${rangeLabel(range)}_${nowStamp()}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

})();
