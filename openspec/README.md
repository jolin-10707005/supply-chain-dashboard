# 供應鏈與倉儲物流戰情室

聚焦庫存週轉天數、缺貨／呆滯預警、出貨時效達成率、揀貨效率、盤差率與損耗五大 KPI 的物流管理儀表板。

## 核心功能

- 🔐 登入頁：帳號驗證（串接 FME CheckUserId API 規範）、連續錯誤鎖定機制、記住帳號
- 👥 角色權限：管理員／一般使用者分權限，一般使用者僅能檢視
- 📊 五大 KPI 卡片：庫存週轉天數、缺貨／呆滯預警、出貨時效達成率、揀貨效率、盤差率與損耗
- 📈 互動圖表：庫存週轉趨勢（門檻色帶）、庫存狀態分布（可點擊聯動篩選）、各班次揀貨效率
- 🔍 互動式資料表：搜尋、排序、分頁
- 📤 Excel 上傳重繪：管理員可上傳庫存 Excel，即時重新繪製圖表與資料表，具備格式防呆與錯誤提示
- ⚠️ 業務門檻異常警示：超過設定門檻時卡片變色並跳出 Toast 警示
- 📄 匯出：儀表板 PDF 報告匯出、圖表 PNG 圖檔下載
- 🌗 深色模式、📱 RWD 響應式版面（手機／平板／桌機）
- ⚙️ 管理後台：使用者權限管理、物流儀表板設定（卡片顯示/更新頻率）、系統設定（業務門檻／登入安全參數）

## 專案結構

```
supply-chain-dashboard/
├── index.html              # 登入頁（進入點）
├── dashboard.html          # 主儀表板頁面
├── app.jsx                 # 前端核心邏輯原始碼（React + JSX，可讀性版本，含業務計算 function）
├── script.js               # app.jsx 編譯後的純 JS（dashboard.html 實際載入此檔，瀏覽器端不執行 Babel）
├── style.css                # 共用樣式
├── openspec/
│   ├── SDD.md               # 系統技術規格書
│   ├── README.md            # 本文件
│   └── api-interface.json   # 前後端 API 介接格式
└── db/migrations/
    ├── 001_schema.sql
    ├── 002_init.sql
    └── 003_seed.sql
```

### 修改邏輯後如何重新編譯

`script.js` 是由 `app.jsx` 預編譯而成（classic JSX runtime），**請勿直接編輯 `script.js`**，修改 `app.jsx` 後執行：

```bash
npm install --no-save @babel/core @babel/preset-react
node -e "
const babel = require('@babel/core');
const presetReact = require('@babel/preset-react');
const fs = require('fs');
const result = babel.transformFileSync('app.jsx', { presets: [[presetReact, { runtime: 'classic' }]], babelrc: false, configFile: false });
fs.writeFileSync('script.js', result.code, 'utf8');
"
```

## 快速開始（前端原型預覽）

目前所有資料皆為前端 Mock Data，可直接以任一靜態伺服器開啟：

```bash
npx serve .
# 瀏覽器開啟 index.html
```

Demo 測試帳號：
- 管理員：`admin` / `admin123`
- 一般使用者：`viewer` / `viewer123`

## 給 IT 工程師的快速導讀

1. `app.jsx` 內業務計算邏輯已封裝為獨立 function（如 `calcTurnoverDays`、`calcOnTimeRate`），可直接對應後端服務改寫。
2. 登入邏輯位於 `index.html` 的 `checkUserId()` function，已標註 `// TODO` 待串接正式後端代理 API；`DEMO_MODE` 與 `DEMO_USERS` 為前端展示用假帳號，正式上線前必須移除。
3. Excel 上傳解析邏輯位於 `app.jsx` 的 `parseSkuExcel()`，前端已完成欄位驗證與 10MB 檔案大小限制，後端串接時建議伺服器端也需再次驗證。
4. 資料庫請依 `db/migrations/` 依序執行，Schema 固定為 `supply_chain_dashboard`。
5. API 介接格式請參考 `openspec/api-interface.json`，目前為前端 Mock，尚未實際發送請求。
6. 詳細功能規格與計算公式請見 `openspec/SDD.md`。

## 資安注意事項

- 正式環境請勿於前端直接呼叫 CheckUserId API，避免帳密外洩與 CORS 問題，需由後端代理轉發。
- 密碼欄位不落地儲存於資料庫（`users` 表不含密碼欄位）。
- Excel 上傳僅接受 `.xlsx` / `.xls`，限制檔案大小 10MB 以內，並於前端與後端皆需進行欄位格式驗證。
- 目前角色權限（管理員／一般使用者）僅為前端 UI 呈現層級判斷，可被瀏覽器 DevTools 竄改繞過；正式串接後端後，**所有管理端 API 都必須在伺服器端重新驗證角色權限**，不可僅信任前端傳來的角色欄位。
- 登入錯誤鎖定機制目前僅存於瀏覽器 `localStorage`，可被清除繞過，僅供 UI 展示；正式環境請將 `failed_attempts` / `locked_until` 存於後端資料庫（已於 `users` 表預留欄位）並由伺服器端強制執行。
- 詳細掃描結果請見專案根目錄 `security-report-*.docx`。
