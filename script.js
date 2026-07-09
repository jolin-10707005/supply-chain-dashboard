// ============================================================================
// 供應鏈與倉儲物流戰情室 - 前端核心邏輯（React + Tailwind 原型）
// 業務邏輯全部封裝為獨立 function，方便 IT 工程師日後抽換為真實 API。
// ============================================================================

const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  createContext,
  useContext
} = React;

// ----------------------------------------------------------------------------
// 0. 全域設定 / 常數
// ----------------------------------------------------------------------------
const WAREHOUSES = ["北區倉", "中區倉", "南區倉", "桃園倉"];
const CATEGORIES = ["3C配件", "家用五金", "食品飲料", "服飾配件", "生鮮冷藏", "辦公用品"];
const DEFAULT_THRESHOLDS = {
  turnoverWarn: 15,
  // 庫存週轉天數 - 警戒(橙)
  turnoverDanger: 20,
  // 庫存週轉天數 - 危險(紅)
  staleDays: 45,
  // 呆滯判定天數(超過N天未出貨)
  onTimeTarget: 98,
  // 出貨時效達成率目標(%)
  diffRateWarn: 1.0,
  // 盤差率警戒(%)
  diffRateDanger: 2.0,
  // 盤差率危險(%)
  maxLoginAttempts: 5,
  // 登入鎖定門檻
  lockoutMinutes: 15
};

// TODO: IT 工程師請在此串接真實後端 API base URL
const API_BASE = "/api"; // 目前使用 Mock Data，不會實際發送請求

// ----------------------------------------------------------------------------
// 1. Mock Data 產生
// ----------------------------------------------------------------------------
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rnd = seededRandom(20260703);
function genSkuData() {
  const names = ["USB-C充電線", "藍牙耳機", "無線滑鼠", "螺絲起子組", "LED燈泡", "延長線", "礦泉水(箱)", "洋芋片", "即溶咖啡", "棉質T恤", "運動襪", "帆布包", "冷凍水餃", "鮮乳", "冷凍雞胸肉", "文件夾", "原子筆(盒)", "A4影印紙", "行動電源", "藍牙喇叭", "五金收納盒", "餅乾禮盒", "牛仔褲", "保溫瓶"];
  return names.map((name, i) => {
    const category = CATEGORIES[i % CATEGORIES.length];
    const warehouse = WAREHOUSES[i % WAREHOUSES.length];
    const avgDailyOutbound = Math.round((rnd() * 18 + 2) * 10) / 10;
    const safetyStock = Math.round(avgDailyOutbound * 7);
    let currentStock = Math.round(avgDailyOutbound * (rnd() * 30 + 2));
    const daysSinceLastOut = Math.floor(rnd() * 60);
    // 人為製造缺貨與呆滯案例，符合圖表需求（9個缺貨/18個呆滯）
    if (i % 8 === 0) currentStock = Math.max(0, Math.round(safetyStock * 0.15));
    if (i % 5 === 0) currentStock = Math.round(avgDailyOutbound * 90);
    const daysOfStock = avgDailyOutbound > 0 ? Math.round(currentStock / avgDailyOutbound * 10) / 10 : 0;
    const unitCost = Math.round(rnd() * 480 + 20);
    let status = "正常";
    if (currentStock <= safetyStock * 0.3) status = "缺貨";else if (daysSinceLastOut > DEFAULT_THRESHOLDS.staleDays || daysOfStock > 60) status = "呆滯";else if (currentStock <= safetyStock) status = "低庫存";
    return {
      id: `SKU${String(i + 1).padStart(4, "0")}`,
      name,
      category,
      warehouse,
      currentStock,
      safetyStock,
      avgDailyOutbound,
      daysOfStock,
      daysSinceLastOut,
      unitCost,
      status,
      updatedAt: "2026-07-0" + (i % 3 + 1)
    };
  });
}
function genTurnoverTrend() {
  // 近7天庫存週轉天數（供長條圖 + 門檻色帶）
  const days = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
  return days.map((d, i) => ({
    day: d,
    turnoverDays: Math.round((14 + rnd() * 10 + (i === 5 ? 6 : 0)) * 10) / 10
  }));
}
function genShipmentData() {
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const onTime = rnd() > 0.032;
    rows.push({
      orderId: `SO${20260600 + i}`,
      warehouse: WAREHOUSES[i % WAREHOUSES.length],
      promisedHours: 24,
      actualHours: onTime ? Math.round(rnd() * 20 + 2) : Math.round(rnd() * 20 + 26),
      onTime,
      date: `2026-06-${String(i % 28 + 1).padStart(2, "0")}`
    });
  }
  return rows;
}
function genPickingData() {
  const shifts = ["早班", "中班", "晚班"];
  const days = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
  const rows = [];
  days.forEach(day => {
    shifts.forEach(shift => {
      const workHours = 8;
      const pickedQty = Math.round(workHours * (95 + rnd() * 45));
      rows.push({
        day,
        shift,
        pickedQty,
        workHours,
        efficiency: Math.round(pickedQty / workHours)
      });
    });
  });
  return rows;
}
function genCountData() {
  const rows = [];
  for (let i = 0; i < 24; i++) {
    const bookQty = Math.round(rnd() * 900 + 100);
    const diffPct = (rnd() - 0.55) * 0.06;
    const actualQty = Math.max(0, Math.round(bookQty * (1 + diffPct)));
    rows.push({
      id: `SKU${String(i + 1).padStart(4, "0")}`,
      warehouse: WAREHOUSES[i % WAREHOUSES.length],
      bookQty,
      actualQty,
      diffQty: actualQty - bookQty,
      unitCost: Math.round(rnd() * 480 + 20)
    });
  }
  return rows;
}

// ----------------------------------------------------------------------------
// 2. 業務計算邏輯（KPI 公式）
// ----------------------------------------------------------------------------
function calcTurnoverDays(skuList) {
  const totalStock = skuList.reduce((s, x) => s + x.currentStock, 0);
  const totalDaily = skuList.reduce((s, x) => s + x.avgDailyOutbound, 0);
  return totalDaily > 0 ? Math.round(totalStock / totalDaily * 10) / 10 : 0;
}
function calcStockoutStaleCounts(skuList) {
  return {
    stockout: skuList.filter(s => s.status === "缺貨").length,
    stale: skuList.filter(s => s.status === "呆滯").length
  };
}
function calcOnTimeRate(shipments) {
  if (!shipments.length) return 0;
  const onTime = shipments.filter(s => s.onTime).length;
  return Math.round(onTime / shipments.length * 1000) / 10;
}
function calcPickingEfficiency(pickingRows) {
  const totalQty = pickingRows.reduce((s, r) => s + r.pickedQty, 0);
  const totalHrs = pickingRows.reduce((s, r) => s + r.workHours, 0);
  return totalHrs > 0 ? Math.round(totalQty / totalHrs) : 0;
}
function calcDiffLoss(countRows) {
  const totalBook = countRows.reduce((s, r) => s + r.bookQty, 0);
  const totalAbsDiff = countRows.reduce((s, r) => s + Math.abs(r.diffQty), 0);
  const lossValue = countRows.reduce((s, r) => s + (r.diffQty < 0 ? Math.abs(r.diffQty) * r.unitCost : 0), 0);
  const diffRate = totalBook > 0 ? Math.round(totalAbsDiff / totalBook * 1000) / 10 : 0;
  return {
    diffRate,
    lossValue
  };
}

// ----------------------------------------------------------------------------
// 3. Toast Context
// ----------------------------------------------------------------------------
const ToastContext = createContext(null);
function useToast() {
  return useContext(ToastContext);
}
function ToastProvider({
  children
}) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const pushToast = useCallback((message, type = "info") => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, {
      id,
      message,
      type,
      leaving: false
    }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? {
        ...t,
        leaving: true
      } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 4200);
  }, []);
  return /*#__PURE__*/React.createElement(ToastContext.Provider, {
    value: pushToast
  }, children, /*#__PURE__*/React.createElement("div", {
    className: "fixed top-4 right-4 z-[999] flex flex-col gap-2 w-80 max-w-[90vw]"
  }, toasts.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: `toast-enter ${t.leaving ? "toast-leave" : ""} pointer-events-auto rounded-lg shadow-lg border px-4 py-3 text-sm flex items-start gap-2 ${t.type === "error" ? "bg-red-50 border-red-300 text-red-700" : t.type === "warning" ? "bg-orange-50 border-orange-300 text-orange-700" : t.type === "success" ? "bg-green-50 border-green-300 text-green-700" : "bg-slate-800 border-slate-700 text-white"}`
  }, /*#__PURE__*/React.createElement("span", null, t.type === "error" ? "❌" : t.type === "warning" ? "⚠️" : t.type === "success" ? "✅" : "ℹ️"), /*#__PURE__*/React.createElement("span", {
    className: "flex-1 leading-snug"
  }, t.message)))));
}

// ----------------------------------------------------------------------------
// 4. 共用 UI 元件
// ----------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  unit,
  subtitle,
  tone,
  danger,
  onClick
}) {
  const toneMap = {
    red: "border-l-red-500 text-red-600",
    orange: "border-l-orange-500 text-orange-600",
    green: "border-l-green-600 text-green-600",
    blue: "border-l-blue-600 text-blue-600",
    teal: "border-l-teal-600 text-teal-600"
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    className: `bg-white dark:bg-slate-800 rounded-xl shadow p-4 border-l-4 ${toneMap[tone]} ${danger ? "pulse-danger" : ""} ${onClick ? "cursor-pointer hover:shadow-md" : ""} transition`
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-medium text-slate-500 dark:text-slate-400"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: `kpi-value mt-1 text-2xl font-bold ${toneMap[tone].split(" ")[1]}`
  }, value, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium ml-1"
  }, unit)), /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-tight"
  }, subtitle));
}
function EmptyState({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "py-10 text-center text-slate-400 text-sm"
  }, "🔍 ", text || "查無資料");
}
function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 z-[998] flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold text-slate-800 dark:text-white mb-2"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-500 dark:text-slate-300 mb-5"
  }, message), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    className: "px-4 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200"
  }, "取消"), /*#__PURE__*/React.createElement("button", {
    onClick: onConfirm,
    className: "px-4 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
  }, "確認"))));
}

// ----------------------------------------------------------------------------
// 5. 圖表元件（Chart.js 命令式綁定）
// ----------------------------------------------------------------------------
function useChart(canvasRef, buildConfig, deps) {
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, buildConfig());
    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
    // eslint-disable-next-line
  }, deps);
  return chartRef;
}
function TurnoverTrendChart({
  data,
  thresholds
}) {
  const canvasRef = useRef(null);
  useChart(canvasRef, () => ({
    type: "bar",
    data: {
      labels: data.map(d => d.day),
      datasets: [{
        label: "庫存週轉天數",
        data: data.map(d => d.turnoverDays),
        backgroundColor: data.map(d => d.turnoverDays >= thresholds.turnoverDanger ? "#dc2626" : d.turnoverDays >= thresholds.turnoverWarn ? "#f59e0b" : "#16a34a"),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: c => `${c.parsed.y} 天`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "天"
          }
        }
      }
    }
  }), [data, thresholds]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    height: "220",
    "data-chart-name": "庫存週轉趨勢"
  });
}
function StatusDonutChart({
  counts,
  onSliceClick,
  activeStatus
}) {
  const canvasRef = useRef(null);
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const colors = {
    "正常": "#16a34a",
    "低庫存": "#3b82f6",
    "呆滯": "#f59e0b",
    "缺貨": "#dc2626"
  };
  const chartRef = useChart(canvasRef, () => ({
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map(l => colors[l] || "#94a3b8"),
        borderColor: "#fff",
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label: c => {
              const t = values.reduce((a, b) => a + b, 0);
              return ` ${c.label}：${c.parsed} 筆（${t ? Math.round(c.parsed / t * 100) : 0}%）`;
            }
          }
        }
      },
      onClick: (evt, elements) => {
        if (elements.length && onSliceClick) onSliceClick(labels[elements[0].index]);
      }
    }
  }), [counts]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    height: "220",
    className: "chart-clickable",
    "data-chart-name": "庫存狀態分布"
  }), activeStatus && /*#__PURE__*/React.createElement("p", {
    className: "text-center text-xs text-blue-600 mt-2"
  }, "已篩選：", activeStatus, /*#__PURE__*/React.createElement("button", {
    onClick: () => onSliceClick(null),
    className: "ml-2 underline"
  }, "清除篩選")));
}
function PickingEfficiencyChart({
  data
}) {
  const canvasRef = useRef(null);
  const days = [...new Set(data.map(d => d.day))];
  const shifts = ["早班", "中班", "晚班"];
  const shiftColors = {
    "早班": "#2563eb",
    "中班": "#0d9488",
    "晚班": "#7c3aed"
  };
  useChart(canvasRef, () => ({
    type: "bar",
    data: {
      labels: days,
      datasets: shifts.map(shift => ({
        label: shift,
        data: days.map(day => (data.find(d => d.day === day && d.shift === shift) || {}).efficiency || 0),
        backgroundColor: shiftColors[shift]
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "單/小時"
          }
        }
      }
    }
  }), [data]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    height: "220",
    "data-chart-name": "各班次揀貨效率"
  });
}

// ----------------------------------------------------------------------------
// 6. 互動式資料表（搜尋 / 排序 / 分頁）
// ----------------------------------------------------------------------------
function DataTable({
  columns,
  rows,
  pageSize = 8,
  rowKey = "id",
  onRowStatusHighlight
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r => columns.some(c => String(r[c.key] ?? "").toLowerCase().includes(q)));
  }, [rows, search, columns]);
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey],
        bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv), "zh-Hant") : String(bv).localeCompare(String(av), "zh-Hant");
    });
    return copy;
  }, [filtered, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage(1);
  }, [search, rows]);
  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3"
  }, /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "搜尋關鍵字...",
    className: "w-full sm:w-64 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, "共 ", sorted.length, " 筆")), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-slate-50 dark:bg-slate-700/60"
  }, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    onClick: () => c.sortable !== false && toggleSort(c.key),
    className: `px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-200 whitespace-nowrap ${c.sortable !== false ? "cursor-pointer select-none" : ""}`
  }, c.label, sortKey === c.key && /*#__PURE__*/React.createElement("span", {
    className: "ml-1"
  }, sortDir === "asc" ? "▲" : "▼"))))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-slate-100 dark:divide-slate-700"
  }, pageRows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length
  }, /*#__PURE__*/React.createElement(EmptyState, null))), pageRows.map(row => /*#__PURE__*/React.createElement("tr", {
    key: row[rowKey],
    className: "data-row"
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    className: "px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200"
  }, c.render ? c.render(row) : row[c.key]))))))), totalPages > 1 && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-end gap-2 mt-3 text-sm"
  }, /*#__PURE__*/React.createElement("button", {
    disabled: page === 1,
    onClick: () => setPage(p => p - 1),
    className: "px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
  }, "上一頁"), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500"
  }, page, " / ", totalPages), /*#__PURE__*/React.createElement("button", {
    disabled: page === totalPages,
    onClick: () => setPage(p => p + 1),
    className: "px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
  }, "下一頁")));
}
function StatusBadge({
  status
}) {
  const map = {
    "正常": "bg-green-100 text-green-700",
    "低庫存": "bg-blue-100 text-blue-700",
    "呆滯": "bg-orange-100 text-orange-700",
    "缺貨": "bg-red-100 text-red-700"
  };
  return /*#__PURE__*/React.createElement("span", {
    className: `px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || "bg-slate-100 text-slate-600"}`
  }, status);
}

// ----------------------------------------------------------------------------
// 7. Excel 上傳與重繪
// ----------------------------------------------------------------------------
const REQUIRED_SKU_COLUMNS = ["SKU編號", "品名", "分類", "倉別", "目前庫存", "安全庫存", "日均出貨量"];
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB 上限，避免超大檔案耗用瀏覽器記憶體

function parseSkuExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, {
          type: "array"
        });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {
          defval: null
        });
        if (!json.length) {
          reject(new Error("檔案內容為空，找不到任何資料列。"));
          return;
        }
        const headers = Object.keys(json[0]);
        const missing = REQUIRED_SKU_COLUMNS.filter(c => !headers.includes(c));
        if (missing.length) {
          reject(new Error(`缺少必要欄位：${missing.join("、")}`));
          return;
        }
        const warnings = [];
        const rows = json.map((r, i) => {
          const currentStock = Number(r["目前庫存"]);
          const safetyStock = Number(r["安全庫存"]);
          const avgDailyOutbound = Number(r["日均出貨量"]);
          if (isNaN(currentStock) || isNaN(safetyStock) || isNaN(avgDailyOutbound)) {
            warnings.push(`第 ${i + 2} 列數值欄位格式錯誤，已跳過`);
            return null;
          }
          const daysOfStock = avgDailyOutbound > 0 ? Math.round(currentStock / avgDailyOutbound * 10) / 10 : 0;
          let status = "正常";
          if (currentStock <= safetyStock * 0.3) status = "缺貨";else if (daysOfStock > 60) status = "呆滯";else if (currentStock <= safetyStock) status = "低庫存";
          return {
            id: String(r["SKU編號"]),
            name: String(r["品名"]),
            category: String(r["分類"]),
            warehouse: String(r["倉別"]),
            currentStock,
            safetyStock,
            avgDailyOutbound,
            daysOfStock,
            daysSinceLastOut: 0,
            unitCost: Number(r["單位成本"]) || 0,
            status,
            updatedAt: new Date().toISOString().slice(0, 10)
          };
        }).filter(Boolean);
        resolve({
          rows,
          warnings
        });
      } catch (err) {
        reject(new Error("檔案解析失敗，請確認為有效的 Excel 格式（.xlsx / .xls）。"));
      }
    };
    reader.onerror = () => reject(new Error("檔案讀取失敗，請確認檔案未損毀。"));
    reader.readAsArrayBuffer(file);
  });
}
function ExcelUploadPanel({
  onDataLoaded
}) {
  const toast = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  async function handleFile(file) {
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (!isExcel) {
      toast("檔案格式錯誤：請上傳 .xlsx 或 .xls 格式的 Excel 檔案，原資料維持不變。", "error");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast("檔案過大：請上傳 10MB 以內的 Excel 檔案，原資料維持不變。", "error");
      return;
    }
    setLoading(true);
    try {
      const {
        rows,
        warnings
      } = await parseSkuExcel(file);
      onDataLoaded(rows);
      toast(`成功匯入 ${rows.length} 筆庫存資料，圖表與資料表已即時更新。${warnings.length ? `（${warnings.length} 列已略過）` : ""}`, "success");
      if (warnings.length) console.warn("[Excel上傳警告]", warnings);
    } catch (err) {
      toast(`匯入失敗：${err.message}（原網頁資料維持不變）`, "error");
    } finally {
      setLoading(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    id: "excel-drop-zone",
    className: `rounded-xl p-6 text-center cursor-pointer ${dragOver ? "drag-over" : ""}`,
    onClick: () => fileInputRef.current.click(),
    onDragOver: e => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: e => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    }
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileInputRef,
    type: "file",
    accept: ".xlsx,.xls",
    className: "hidden",
    onChange: e => {
      handleFile(e.target.files[0]);
      e.target.value = "";
    }
  }), loading ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-blue-600"
  }, "解析中，請稍候...") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium text-slate-600 dark:text-slate-300"
  }, "📤 點擊或拖曳 Excel 檔案至此處上傳，重新繪製儀表板"), /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-xs text-slate-400"
  }, "必要欄位：SKU編號、品名、分類、倉別、目前庫存、安全庫存、日均出貨量"))));
}

// ----------------------------------------------------------------------------
// 8. 匯出功能（PDF / 圖檔）
// ----------------------------------------------------------------------------
async function exportDashboardAsPdf(elementId, toast) {
  const el = document.getElementById(elementId);
  if (!el) return;
  toast("正在產生 PDF，請稍候...", "info");
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff"
    });
    const imgData = canvas.toDataURL("image/png");
    const {
      jsPDF
    } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = canvas.height * pageWidth / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
    pdf.save(`供應鏈物流戰情室報告_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast("PDF 報告已匯出完成。", "success");
  } catch (err) {
    toast("PDF 匯出失敗，請確認瀏覽器版本或稍後再試。", "error");
  }
}
function exportChartAsPng(chartName) {
  const canvas = document.querySelector(`canvas[data-chart-name="${chartName}"]`);
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = `${chartName}_${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ----------------------------------------------------------------------------
// 9. 儀表板主頁
// ----------------------------------------------------------------------------
function DashboardPage({
  role
}) {
  const toast = useToast();
  const [skuData, setSkuData] = useState(genSkuData);
  const [turnoverTrend] = useState(genTurnoverTrend);
  const [shipments] = useState(genShipmentData);
  const [pickingData] = useState(genPickingData);
  const [countData] = useState(genCountData);
  const [thresholds] = useState(() => {
    const saved = localStorage.getItem("scw_thresholds");
    return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
  });
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(null);
  const alertedRef = useRef(false);
  const filteredSku = useMemo(() => {
    return skuData.filter(s => (warehouseFilter === "all" || s.warehouse === warehouseFilter) && (categoryFilter === "all" || s.category === categoryFilter) && (!statusFilter || s.status === statusFilter));
  }, [skuData, warehouseFilter, categoryFilter, statusFilter]);
  const turnoverDays = useMemo(() => calcTurnoverDays(filteredSku), [filteredSku]);
  const {
    stockout,
    stale
  } = useMemo(() => calcStockoutStaleCounts(skuData), [skuData]);
  const onTimeRate = useMemo(() => calcOnTimeRate(shipments), [shipments]);
  const pickingEfficiency = useMemo(() => calcPickingEfficiency(pickingData), [pickingData]);
  const {
    diffRate,
    lossValue
  } = useMemo(() => calcDiffLoss(countData), [countData]);
  const statusCounts = useMemo(() => {
    const c = {
      "正常": 0,
      "低庫存": 0,
      "呆滯": 0,
      "缺貨": 0
    };
    skuData.forEach(s => {
      c[s.status] = (c[s.status] || 0) + 1;
    });
    return c;
  }, [skuData]);

  // 異常門檻警示：頁面資料變動時，若超過危險門檻主動跳出提示
  useEffect(() => {
    if (alertedRef.current) return;
    if (turnoverDays >= thresholds.turnoverDanger) {
      toast(`庫存週轉天數已達 ${turnoverDays} 天，超過危險門檻 ${thresholds.turnoverDanger} 天，請盡快處理呆滯庫存！`, "error");
      alertedRef.current = true;
    } else if (diffRate >= thresholds.diffRateDanger) {
      toast(`盤差率 ${diffRate}% 超過危險門檻 ${thresholds.diffRateDanger}%，請確認盤點作業。`, "warning");
      alertedRef.current = true;
    }
  }, [turnoverDays, diffRate, thresholds]);
  const skuColumns = [{
    key: "id",
    label: "SKU編號"
  }, {
    key: "name",
    label: "品名"
  }, {
    key: "category",
    label: "分類"
  }, {
    key: "warehouse",
    label: "倉別"
  }, {
    key: "currentStock",
    label: "目前庫存"
  }, {
    key: "safetyStock",
    label: "安全庫存"
  }, {
    key: "daysOfStock",
    label: "庫存天數"
  }, {
    key: "status",
    label: "狀態",
    render: r => /*#__PURE__*/React.createElement(StatusBadge, {
      status: r.status
    })
  }, {
    key: "updatedAt",
    label: "更新時間"
  }];
  return /*#__PURE__*/React.createElement("div", {
    id: "dashboard-capture",
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4 flex flex-col sm:flex-row sm:items-center gap-3 no-print"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-slate-500 dark:text-slate-300 shrink-0"
  }, "篩選條件"), /*#__PURE__*/React.createElement("select", {
    value: warehouseFilter,
    onChange: e => setWarehouseFilter(e.target.value),
    className: "px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg"
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "所有倉別"), WAREHOUSES.map(w => /*#__PURE__*/React.createElement("option", {
    key: w,
    value: w
  }, w))), /*#__PURE__*/React.createElement("select", {
    value: categoryFilter,
    onChange: e => setCategoryFilter(e.target.value),
    className: "px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg"
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "所有分類"), CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c))), statusFilter && /*#__PURE__*/React.createElement("span", {
    className: "text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg"
  }, "狀態篩選：", statusFilter, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStatusFilter(null),
    className: "ml-2 underline"
  }, "清除")), /*#__PURE__*/React.createElement("div", {
    className: "sm:ml-auto flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => exportDashboardAsPdf("dashboard-capture", toast),
    className: "px-3 py-1.5 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-800"
  }, "📄 匯出 PDF"))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    title: "庫存週轉天數",
    value: turnoverDays,
    unit: "天",
    tone: "red",
    danger: turnoverDays >= thresholds.turnoverDanger,
    subtitle: `警戒 ${thresholds.turnoverWarn} 天 / 危險 ${thresholds.turnoverDanger} 天`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    title: "缺貨／呆滯預警",
    value: `${stockout} / ${stale}`,
    unit: "SKU",
    tone: "orange",
    danger: stockout > 5,
    subtitle: "缺貨SKU數 / 呆滯SKU數",
    onClick: () => setStatusFilter(statusFilter === "缺貨" ? null : "缺貨")
  }), /*#__PURE__*/React.createElement(KpiCard, {
    title: "出貨時效達成率",
    value: onTimeRate,
    unit: "%",
    tone: "green",
    danger: onTimeRate < thresholds.onTimeTarget,
    subtitle: `目標 ${thresholds.onTimeTarget}%`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    title: "揀貨效率",
    value: pickingEfficiency,
    unit: "單/小時",
    tone: "blue",
    subtitle: "全倉平均每人每小時揀貨量"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    title: "盤差率與損耗",
    value: diffRate,
    unit: "%",
    tone: "teal",
    danger: diffRate >= thresholds.diffRateDanger,
    subtitle: `損耗金額 $${lossValue.toLocaleString()}`
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4 lg:col-span-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200"
  }, "庫存週轉趨勢（最近7天）"), /*#__PURE__*/React.createElement("button", {
    onClick: () => exportChartAsPng("庫存週轉趨勢"),
    className: "text-xs text-blue-600 hover:underline no-print"
  }, "下載圖檔")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 240
    }
  }, /*#__PURE__*/React.createElement(TurnoverTrendChart, {
    data: turnoverTrend,
    thresholds: thresholds
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200"
  }, "庫存狀態分布"), /*#__PURE__*/React.createElement("button", {
    onClick: () => exportChartAsPng("庫存狀態分布"),
    className: "text-xs text-blue-600 hover:underline no-print"
  }, "下載圖檔")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 240
    }
  }, /*#__PURE__*/React.createElement(StatusDonutChart, {
    counts: statusCounts,
    activeStatus: statusFilter,
    onSliceClick: setStatusFilter
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4 lg:col-span-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200"
  }, "各班次揀貨效率（近7天）"), /*#__PURE__*/React.createElement("button", {
    onClick: () => exportChartAsPng("各班次揀貨效率"),
    className: "text-xs text-blue-600 hover:underline no-print"
  }, "下載圖檔")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 240
    }
  }, /*#__PURE__*/React.createElement(PickingEfficiencyChart, {
    data: pickingData
  })))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200 mb-3"
  }, "庫存明細（SKU 層級）"), /*#__PURE__*/React.createElement(DataTable, {
    columns: skuColumns,
    rows: filteredSku
  })), role === "admin" && /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4 no-print"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200 mb-3"
  }, "Excel 上傳重繪"), /*#__PURE__*/React.createElement(ExcelUploadPanel, {
    onDataLoaded: setSkuData
  })));
}

// ----------------------------------------------------------------------------
// 10. 使用者權限管理（管理員專用）
// ----------------------------------------------------------------------------
const MOCK_USERS_KEY = "scw_mock_users";
function loadMockUsers() {
  const saved = localStorage.getItem(MOCK_USERS_KEY);
  if (saved) return JSON.parse(saved);
  return [{
    id: "admin",
    name: "系統管理員",
    role: "admin",
    warehouse: "全倉",
    locked: false,
    lastLogin: "2026-07-03 09:12"
  }, {
    id: "viewer",
    name: "倉儲主管",
    role: "general",
    warehouse: "北區倉",
    locked: false,
    lastLogin: "2026-07-03 08:40"
  }, {
    id: "chen01",
    name: "陳倉管",
    role: "general",
    warehouse: "中區倉",
    locked: true,
    lastLogin: "2026-06-28 17:05"
  }, {
    id: "wu02",
    name: "吳採購",
    role: "general",
    warehouse: "南區倉",
    locked: false,
    lastLogin: "2026-07-02 14:22"
  }];
}
function UserPermissionPage() {
  const toast = useToast();
  const [users, setUsers] = useState(loadMockUsers);
  const [confirmTarget, setConfirmTarget] = useState(null);
  useEffect(() => {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }, [users]);
  function toggleLock(id) {
    setUsers(prev => prev.map(u => u.id === id ? {
      ...u,
      locked: !u.locked
    } : u));
    const u = users.find(x => x.id === id);
    toast(`帳號「${id}」已${u.locked ? "解除鎖定" : "鎖定"}。`, "success");
  }
  function changeRole(id, role) {
    setUsers(prev => prev.map(u => u.id === id ? {
      ...u,
      role
    } : u));
    toast(`帳號「${id}」權限已更新為「${role === "admin" ? "管理員" : "一般使用者"}」。`, "success");
  }
  const columns = [{
    key: "id",
    label: "帳號"
  }, {
    key: "name",
    label: "姓名"
  }, {
    key: "role",
    label: "角色權限",
    render: r => /*#__PURE__*/React.createElement("select", {
      value: r.role,
      onChange: e => changeRole(r.id, e.target.value),
      className: "text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-2 py-1"
    }, /*#__PURE__*/React.createElement("option", {
      value: "admin"
    }, "管理員"), /*#__PURE__*/React.createElement("option", {
      value: "general"
    }, "一般使用者"))
  }, {
    key: "warehouse",
    label: "所屬倉別"
  }, {
    key: "lastLogin",
    label: "最後登入時間"
  }, {
    key: "locked",
    label: "帳號狀態",
    render: r => r.locked ? /*#__PURE__*/React.createElement("span", {
      className: "px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"
    }, "已鎖定") : /*#__PURE__*/React.createElement("span", {
      className: "px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"
    }, "正常")
  }, {
    key: "action",
    label: "操作",
    sortable: false,
    render: r => /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfirmTarget(r),
      className: `text-xs px-3 py-1 rounded-lg ${r.locked ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"} text-white`
    }, r.locked ? "解除鎖定" : "鎖定帳號")
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200"
  }, "使用者權限管理"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-400"
  }, "一般使用者僅能檢視儀表板；管理員可變更資料與進階設定")), /*#__PURE__*/React.createElement(DataTable, {
    columns: columns,
    rows: users,
    pageSize: 10
  }), /*#__PURE__*/React.createElement(ConfirmModal, {
    open: !!confirmTarget,
    title: confirmTarget?.locked ? "解除鎖定確認" : "鎖定帳號確認",
    message: `確定要${confirmTarget?.locked ? "解除鎖定" : "鎖定"}帳號「${confirmTarget?.id}」嗎？`,
    onConfirm: () => {
      toggleLock(confirmTarget.id);
      setConfirmTarget(null);
    },
    onCancel: () => setConfirmTarget(null)
  }));
}

// ----------------------------------------------------------------------------
// 11. 物流儀表板設定（管理員專用）- 卡片顯示/更新頻率管理
// ----------------------------------------------------------------------------
const DASHBOARD_CARDS_KEY = "scw_dashboard_cards";
function loadDashboardCards() {
  const saved = localStorage.getItem(DASHBOARD_CARDS_KEY);
  if (saved) return JSON.parse(saved);
  return [{
    id: 1,
    name: "庫存週轉天數",
    source: "WMS 庫存主檔",
    refreshFreq: "每小時",
    visible: true,
    updatedAt: "2026-07-03 08:00"
  }, {
    id: 2,
    name: "缺貨／呆滯預警",
    source: "WMS 庫存主檔",
    refreshFreq: "每小時",
    visible: true,
    updatedAt: "2026-07-03 08:00"
  }, {
    id: 3,
    name: "出貨時效達成率",
    source: "TMS 出貨紀錄",
    refreshFreq: "每日",
    visible: true,
    updatedAt: "2026-07-03 06:00"
  }, {
    id: 4,
    name: "揀貨效率",
    source: "WMS 揀貨紀錄",
    refreshFreq: "每日",
    visible: true,
    updatedAt: "2026-07-03 06:00"
  }, {
    id: 5,
    name: "盤差率與損耗",
    source: "盤點作業紀錄",
    refreshFreq: "每週",
    visible: true,
    updatedAt: "2026-06-30 18:00"
  }];
}
function DashboardSettingsPage() {
  const toast = useToast();
  const [cards, setCards] = useState(loadDashboardCards);
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    localStorage.setItem(DASHBOARD_CARDS_KEY, JSON.stringify(cards));
  }, [cards]);
  function toggleVisible(id) {
    setCards(prev => prev.map(c => c.id === id ? {
      ...c,
      visible: !c.visible
    } : c));
  }
  function saveEdit(updated) {
    setCards(prev => prev.map(c => c.id === updated.id ? {
      ...updated,
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    } : c));
    toast(`卡片「${updated.name}」設定已更新，儀表板將同步變更。`, "success");
    setEditing(null);
  }
  function removeCard(id) {
    setCards(prev => prev.filter(c => c.id !== id));
    toast("卡片已刪除。", "success");
  }
  const columns = [{
    key: "name",
    label: "卡片名稱"
  }, {
    key: "source",
    label: "資料來源"
  }, {
    key: "refreshFreq",
    label: "更新頻率"
  }, {
    key: "visible",
    label: "顯示於儀表板",
    render: r => /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleVisible(r.id),
      className: `w-11 h-6 rounded-full relative transition ${r.visible ? "bg-green-500" : "bg-slate-300"}`
    }, /*#__PURE__*/React.createElement("span", {
      className: `absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${r.visible ? "left-5" : "left-0.5"}`
    }))
  }, {
    key: "updatedAt",
    label: "最後更新時間"
  }, {
    key: "action",
    label: "操作",
    sortable: false,
    render: r => /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setEditing(r),
      className: "text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
    }, "編輯"), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeCard(r.id),
      className: "text-xs px-3 py-1 rounded-lg bg-slate-400 hover:bg-slate-500 text-white"
    }, "刪除"))
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200 mb-3"
  }, "物流儀表板設定"), /*#__PURE__*/React.createElement(DataTable, {
    columns: columns,
    rows: cards,
    pageSize: 10,
    rowKey: "id"
  }), editing && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 z-[998] flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-bold text-slate-800 dark:text-white"
  }, "編輯卡片設定"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs text-slate-500"
  }, "卡片名稱"), /*#__PURE__*/React.createElement("input", {
    value: editing.name,
    onChange: e => setEditing({
      ...editing,
      name: e.target.value
    }),
    className: "w-full mt-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-xs text-slate-500"
  }, "更新頻率"), /*#__PURE__*/React.createElement("select", {
    value: editing.refreshFreq,
    onChange: e => setEditing({
      ...editing,
      refreshFreq: e.target.value
    }),
    className: "w-full mt-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg"
  }, /*#__PURE__*/React.createElement("option", null, "即時"), /*#__PURE__*/React.createElement("option", null, "每小時"), /*#__PURE__*/React.createElement("option", null, "每日"), /*#__PURE__*/React.createElement("option", null, "每週"))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(null),
    className: "px-4 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600"
  }, "取消"), /*#__PURE__*/React.createElement("button", {
    onClick: () => saveEdit(editing),
    className: "px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
  }, "儲存")))));
}

// ----------------------------------------------------------------------------
// 12. 系統設定（管理員專用）- 業務門檻與登入安全
// ----------------------------------------------------------------------------
function SystemSettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("scw_thresholds");
    return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
  });
  function update(key, value) {
    setForm(prev => ({
      ...prev,
      [key]: Number(value)
    }));
  }
  function save() {
    localStorage.setItem("scw_thresholds", JSON.stringify(form));
    toast("系統門檻設定已儲存，將於下次資料更新時套用。", "success");
  }
  const fields = [{
    key: "turnoverWarn",
    label: "庫存週轉天數－警戒值（天）"
  }, {
    key: "turnoverDanger",
    label: "庫存週轉天數－危險值（天）"
  }, {
    key: "staleDays",
    label: "呆滯判定天數（天）"
  }, {
    key: "onTimeTarget",
    label: "出貨時效達成率目標（%）"
  }, {
    key: "diffRateWarn",
    label: "盤差率警戒值（%）"
  }, {
    key: "diffRateDanger",
    label: "盤差率危險值（%）"
  }, {
    key: "maxLoginAttempts",
    label: "登入錯誤鎖定次數"
  }, {
    key: "lockoutMinutes",
    label: "帳號鎖定時間（分鐘）"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-slate-800 rounded-xl shadow p-4 max-w-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-semibold text-slate-600 dark:text-slate-200 mb-4"
  }, "系統設定 — 業務門檻與登入安全"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-4"
  }, fields.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.key
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-xs text-slate-500 dark:text-slate-400"
  }, f.label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: form[f.key],
    onChange: e => update(f.key, e.target.value),
    className: "w-full mt-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg"
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    className: "mt-5 px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
  }, "儲存設定"));
}

// ----------------------------------------------------------------------------
// 13. Sidebar / Topbar / App Shell
// ----------------------------------------------------------------------------
const NAV_ITEMS = [{
  key: "dashboard",
  label: "儀表板首頁",
  icon: "📊",
  roles: ["admin", "general"]
}, {
  key: "users",
  label: "使用者權限管理",
  icon: "👥",
  roles: ["admin"]
}, {
  key: "cards",
  label: "物流儀表板設定",
  icon: "⚙️",
  roles: ["admin"]
}, {
  key: "settings",
  label: "系統設定",
  icon: "🛠️",
  roles: ["admin"]
}];
function Sidebar({
  role,
  active,
  onSelect,
  mobileOpen,
  onCloseMobile
}) {
  const items = NAV_ITEMS.filter(i => i.roles.includes(role));
  return /*#__PURE__*/React.createElement(React.Fragment, null, mobileOpen && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 z-30 lg:hidden",
    onClick: onCloseMobile
  }), /*#__PURE__*/React.createElement("aside", {
    className: `fixed lg:static top-0 left-0 h-full w-64 bg-[#0f1c3f] text-white z-40 transition-transform duration-200
                          ${mobileOpen ? "translate-x-0" : "sidebar-mobile-hidden"} lg:translate-x-0`
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-5 py-5 border-b border-white/10 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xl"
  }, "📦"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "font-bold text-sm leading-tight"
  }, "供應鏈物流戰情室"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-slate-400"
  }, "War Room Console"))), /*#__PURE__*/React.createElement("nav", {
    className: "p-3 space-y-1"
  }, items.map(item => /*#__PURE__*/React.createElement("button", {
    key: item.key,
    onClick: () => {
      onSelect(item.key);
      onCloseMobile();
    },
    className: `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition ${active === item.key ? "bg-[#1c3a78] text-white" : "text-slate-300 hover:bg-white/5"}`
  }, /*#__PURE__*/React.createElement("span", null, item.icon), item.label)))));
}
function Topbar({
  session,
  darkMode,
  onToggleDark,
  onLogout,
  onOpenMobile
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);
  const timeStr = now.toISOString().slice(0, 16).replace("T", " ");
  return /*#__PURE__*/React.createElement("header", {
    className: "bg-white dark:bg-slate-800 shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-20 no-print"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onOpenMobile,
    className: "lg:hidden text-xl"
  }, "☰"), /*#__PURE__*/React.createElement("h1", {
    className: "text-base sm:text-lg font-bold text-slate-800 dark:text-white"
  }, "供應鏈與倉儲物流戰情室")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline text-slate-400 font-mono"
  }, timeStr), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleDark,
    className: "px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-xs"
  }, darkMode ? "☀️ 淺色" : "🌙 深色"), /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline text-slate-500 dark:text-slate-300"
  }, session.name, "（", session.role === "admin" ? "管理員" : "一般使用者", "）"), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    className: "px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium"
  }, "登出")));
}
function AppShell() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("scw_dark") === "1");
  useEffect(() => {
    const raw = sessionStorage.getItem("scw_session");
    if (!raw) {
      window.location.href = "index.html";
      return;
    }
    setSession(JSON.parse(raw));
    setChecked(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("scw_dark", darkMode ? "1" : "0");
  }, [darkMode]);
  function logout() {
    sessionStorage.removeItem("scw_session");
    window.location.href = "index.html";
  }

  // 一般使用者若嘗試停留在管理頁面，強制導回儀表板
  useEffect(() => {
    if (session && session.role !== "admin" && active !== "dashboard") setActive("dashboard");
  }, [session, active]);
  if (!checked || !session) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex min-h-screen"
  }, /*#__PURE__*/React.createElement(Sidebar, {
    role: session.role,
    active: active,
    onSelect: setActive,
    mobileOpen: mobileOpen,
    onCloseMobile: () => setMobileOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 flex flex-col min-w-0"
  }, /*#__PURE__*/React.createElement(Topbar, {
    session: session,
    darkMode: darkMode,
    onToggleDark: () => setDarkMode(d => !d),
    onLogout: logout,
    onOpenMobile: () => setMobileOpen(true)
  }), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 p-4 sm:p-6"
  }, active === "dashboard" && /*#__PURE__*/React.createElement(DashboardPage, {
    role: session.role
  }), active === "users" && session.role === "admin" && /*#__PURE__*/React.createElement(UserPermissionPage, null), active === "cards" && session.role === "admin" && /*#__PURE__*/React.createElement(DashboardSettingsPage, null), active === "settings" && session.role === "admin" && /*#__PURE__*/React.createElement(SystemSettingsPage, null))));
}
function App() {
  return /*#__PURE__*/React.createElement(ToastProvider, null, /*#__PURE__*/React.createElement(AppShell, null));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));