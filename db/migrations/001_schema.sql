-- ============================================================================
-- 001_schema.sql
-- 建立專案獨立 Schema：supply_chain_dashboard
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS supply_chain_dashboard;

COMMENT ON SCHEMA supply_chain_dashboard IS '供應鏈與倉儲物流戰情室 - 專案獨立 Schema（不使用 public）';
