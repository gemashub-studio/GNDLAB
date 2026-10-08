-- Terbitkan versi dataset hasil seed sebagai versi aktif (ADR-002: PUBLISHED = immutable).
-- Dijalankan sekali setelah seed.sql. Aman diulang.
UPDATE dataset_version
   SET status = 'PUBLISHED', published_at = now(), is_active = true
 WHERE status = 'DRAFT'
   AND NOT EXISTS (SELECT 1 FROM dataset_version WHERE is_active);
