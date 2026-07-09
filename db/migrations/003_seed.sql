-- ============================================================================
-- 003_seed.sql
-- 測試假資料（範例資料，不含真實個資）
-- ============================================================================
SET search_path TO supply_chain_dashboard;

-- 倉別
INSERT INTO warehouses (code, name, region) VALUES
  ('WH-N', '北區倉', '北部'),
  ('WH-C', '中區倉', '中部'),
  ('WH-S', '南區倉', '南部'),
  ('WH-TY', '桃園倉', '北部');

-- 系統門檻設定（單筆）
INSERT INTO system_thresholds (
  turnover_warn_days, turnover_danger_days, stale_days,
  on_time_target_pct, diff_rate_warn_pct, diff_rate_danger_pct,
  max_login_attempts, lockout_minutes
) VALUES (15, 20, 45, 98, 1.0, 2.0, 5, 15);

-- 測試帳號（範例帳密，正式環境請改由 CheckUserId API 驗證，密碼欄位不落地於本表）
INSERT INTO users (user_id, name, role, warehouse_id) VALUES
  ('admin',  '系統管理員', 'admin',   NULL),
  ('viewer', '倉儲主管',   'general', 1),
  ('chen01', '陳倉管',     'general', 2),
  ('wu02',   '吳採購',     'general', 3);

-- 儀表板卡片設定
INSERT INTO dashboard_cards (name, data_source, refresh_freq, is_visible) VALUES
  ('庫存週轉天數',   'WMS 庫存主檔',   '每小時', TRUE),
  ('缺貨／呆滯預警', 'WMS 庫存主檔',   '每小時', TRUE),
  ('出貨時效達成率', 'TMS 出貨紀錄',   '每日',   TRUE),
  ('揀貨效率',       'WMS 揀貨紀錄',   '每日',   TRUE),
  ('盤差率與損耗',   '盤點作業紀錄',   '每週',   TRUE);

-- SKU 庫存主檔（範例資料）
INSERT INTO sku_master (sku_code, name, category, warehouse_id, current_stock, safety_stock, avg_daily_outbound, unit_cost, days_since_last_out, days_of_stock, status) VALUES
  ('SKU0001', 'USB-C充電線', '3C配件',   1, 855, 67,  9.5, 120, 50, 90.0, '呆滯'),
  ('SKU0002', '藍牙耳機',   '家用五金', 2, 74,  97,  14.0, 350, 2, 5.3, '低庫存'),
  ('SKU0003', '無線滑鼠',   '食品飲料', 3, 233, 128, 18.3, 280, 1, 12.7, '正常'),
  ('SKU0004', '螺絲起子組', '服飾配件', 4, 12,  90,  12.9, 210, 3, 0.9, '缺貨'),
  ('SKU0005', 'LED燈泡',    '生鮮冷藏', 1, 620, 55,  7.9,  60, 4, 78.5, '呆滯');

-- 出貨紀錄（範例資料）
INSERT INTO shipment_records (order_id, warehouse_id, promised_hours, actual_hours, is_on_time, shipped_at) VALUES
  ('SO20260601', 1, 24, 18, TRUE,  '2026-06-01'),
  ('SO20260602', 2, 24, 30, FALSE, '2026-06-02'),
  ('SO20260603', 3, 24, 20, TRUE,  '2026-06-03'),
  ('SO20260604', 4, 24, 22, TRUE,  '2026-06-04');

-- 揀貨紀錄（範例資料）
INSERT INTO picking_records (warehouse_id, work_date, shift, picked_qty, work_hours, efficiency) VALUES
  (1, '2026-06-29', '早班', 920, 8, 115),
  (1, '2026-06-29', '中班', 880, 8, 110),
  (1, '2026-06-29', '晚班', 780, 8, 97.5);

-- 盤點紀錄（範例資料）
INSERT INTO inventory_count_records (sku_id, warehouse_id, book_qty, actual_qty, diff_qty, unit_cost, loss_value, counted_at)
SELECT id, warehouse_id, 500, 486, -14, unit_cost, 14 * unit_cost, '2026-06-30'
FROM sku_master WHERE sku_code = 'SKU0001';
