-- ============================================================================
-- 002_init.sql
-- 供應鏈與倉儲物流戰情室 - 資料表結構
-- ============================================================================
SET search_path TO supply_chain_dashboard;

-- ----------------------------------------------------------------------------
-- 1. 倉別主檔
-- ----------------------------------------------------------------------------
CREATE TABLE warehouses (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,          -- [INTERNAL] 使用者於本系統自行維護
  name          TEXT NOT NULL,                 -- [INTERNAL] 使用者於本系統自行維護
  region        TEXT,                          -- [INTERNAL] 使用者於本系統自行維護
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. 使用者帳號（角色權限 / 登入鎖定機制）
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR(15) NOT NULL UNIQUE,   -- [EXTERNAL] 來源系統：FME-AasApi CheckUserId（帳號驗證）
  name              TEXT NOT NULL,                 -- [INTERNAL] 使用者於本系統自行維護
  role              TEXT NOT NULL DEFAULT 'general' CHECK (role IN ('admin', 'general')), -- [INTERNAL]
  warehouse_id      INTEGER REFERENCES warehouses(id),                                     -- [INTERNAL]
  failed_attempts   INTEGER NOT NULL DEFAULT 0,    -- [COMPUTED] 公式：登入失敗時 +1，登入成功或解鎖時歸零
  locked_until      TIMESTAMPTZ,                   -- [COMPUTED] 公式：failed_attempts 達到系統設定門檻時 = NOW() + 鎖定分鐘數
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_user_id ON users (user_id);

-- ----------------------------------------------------------------------------
-- 3. SKU 庫存主檔（支援 Excel 上傳重繪）
-- ----------------------------------------------------------------------------
CREATE TABLE sku_master (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code              TEXT NOT NULL,             -- [INTERNAL] 使用者於本系統自行維護（Excel 上傳／手動輸入）
  name                  TEXT NOT NULL,             -- [INTERNAL]
  category              TEXT NOT NULL,             -- [INTERNAL]
  warehouse_id          INTEGER REFERENCES warehouses(id),  -- [INTERNAL]
  current_stock         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- [INTERNAL]
  safety_stock          NUMERIC(12,2) NOT NULL DEFAULT 0,   -- [INTERNAL]
  avg_daily_outbound    NUMERIC(12,2) NOT NULL DEFAULT 0,   -- [INTERNAL]
  unit_cost             NUMERIC(12,2) NOT NULL DEFAULT 0,   -- [INTERNAL]
  days_since_last_out   INTEGER NOT NULL DEFAULT 0,         -- [INTERNAL]
  days_of_stock         NUMERIC(8,2),              -- [COMPUTED] 公式：current_stock / avg_daily_outbound（避免除以0時為0）
  status                TEXT,                      -- [COMPUTED] 公式：
                                                    --   current_stock <= safety_stock*0.3            → '缺貨'
                                                    --   days_since_last_out > staleDays 或 daysOfStock > 60 → '呆滯'
                                                    --   current_stock <= safety_stock                 → '低庫存'
                                                    --   其餘                                           → '正常'
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sku_code, warehouse_id)
);
CREATE INDEX idx_sku_master_warehouse ON sku_master (warehouse_id);
CREATE INDEX idx_sku_master_status ON sku_master (status);
CREATE INDEX idx_sku_master_category ON sku_master (category);

-- ----------------------------------------------------------------------------
-- 4. 出貨紀錄（供 出貨時效達成率 計算）
-- ----------------------------------------------------------------------------
CREATE TABLE shipment_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          TEXT NOT NULL,               -- [EXTERNAL] 來源系統：TMS-出貨管理（待確認實際程式代號）
  warehouse_id      INTEGER REFERENCES warehouses(id),
  promised_hours    NUMERIC(8,2) NOT NULL,       -- [EXTERNAL]
  actual_hours      NUMERIC(8,2) NOT NULL,       -- [EXTERNAL]
  is_on_time        BOOLEAN,                     -- [COMPUTED] 公式：actual_hours <= promised_hours
  shipped_at        DATE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_shipment_records_date ON shipment_records (shipped_at);
CREATE INDEX idx_shipment_records_warehouse ON shipment_records (warehouse_id);

-- ----------------------------------------------------------------------------
-- 5. 揀貨紀錄（供 揀貨效率 計算）
-- ----------------------------------------------------------------------------
CREATE TABLE picking_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id      INTEGER REFERENCES warehouses(id),
  work_date         DATE NOT NULL,               -- [INTERNAL] 使用者於本系統自行維護／WMS 匯入
  shift             TEXT NOT NULL CHECK (shift IN ('早班', '中班', '晚班')),
  picked_qty        INTEGER NOT NULL DEFAULT 0,  -- [INTERNAL]
  work_hours        NUMERIC(6,2) NOT NULL DEFAULT 8, -- [INTERNAL]
  efficiency        NUMERIC(8,2),                -- [COMPUTED] 公式：picked_qty / work_hours
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_picking_records_date ON picking_records (work_date);

-- ----------------------------------------------------------------------------
-- 6. 盤點紀錄（供 盤差率與損耗 計算）
-- ----------------------------------------------------------------------------
CREATE TABLE inventory_count_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id            UUID REFERENCES sku_master(id),
  warehouse_id      INTEGER REFERENCES warehouses(id),
  book_qty          NUMERIC(12,2) NOT NULL,      -- [INTERNAL] 帳面庫存
  actual_qty        NUMERIC(12,2) NOT NULL,      -- [INTERNAL] 實盤庫存
  diff_qty          NUMERIC(12,2),               -- [COMPUTED] 公式：actual_qty - book_qty
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  loss_value        NUMERIC(14,2),               -- [COMPUTED] 公式：diff_qty < 0 ? abs(diff_qty)*unit_cost : 0
  counted_at        DATE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_count_records_date ON inventory_count_records (counted_at);

-- ----------------------------------------------------------------------------
-- 7. 儀表板卡片設定（管理員可調整顯示/更新頻率）
-- ----------------------------------------------------------------------------
CREATE TABLE dashboard_cards (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,               -- [INTERNAL]
  data_source       TEXT,                        -- [INTERNAL] 說明文字，如「WMS 庫存主檔」
  refresh_freq      TEXT NOT NULL DEFAULT '每日', -- [INTERNAL]
  is_visible        BOOLEAN NOT NULL DEFAULT TRUE,-- [INTERNAL]
  updated_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. 系統門檻設定（單筆設定表，供業務門檻異常警示使用）
-- ----------------------------------------------------------------------------
CREATE TABLE system_thresholds (
  id                    SERIAL PRIMARY KEY,
  turnover_warn_days    NUMERIC(6,2) NOT NULL DEFAULT 15,   -- [INTERNAL]
  turnover_danger_days  NUMERIC(6,2) NOT NULL DEFAULT 20,   -- [INTERNAL]
  stale_days            INTEGER NOT NULL DEFAULT 45,        -- [INTERNAL]
  on_time_target_pct    NUMERIC(5,2) NOT NULL DEFAULT 98,   -- [INTERNAL]
  diff_rate_warn_pct    NUMERIC(5,2) NOT NULL DEFAULT 1.0,  -- [INTERNAL]
  diff_rate_danger_pct  NUMERIC(5,2) NOT NULL DEFAULT 2.0,  -- [INTERNAL]
  max_login_attempts    INTEGER NOT NULL DEFAULT 5,         -- [INTERNAL]
  lockout_minutes       INTEGER NOT NULL DEFAULT 15,        -- [INTERNAL]
  updated_by            UUID REFERENCES users(id),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. Excel 上傳紀錄（稽核用途）
-- ----------------------------------------------------------------------------
CREATE TABLE excel_upload_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by        UUID REFERENCES users(id),
  file_name          TEXT NOT NULL,
  row_count          INTEGER NOT NULL DEFAULT 0,
  warning_count      INTEGER NOT NULL DEFAULT 0,   -- [COMPUTED] 公式：解析時格式錯誤或欄位缺漏的列數
  status             TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  message            TEXT,
  uploaded_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_excel_upload_logs_uploaded_at ON excel_upload_logs (uploaded_at);
