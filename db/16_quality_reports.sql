-- 품질 월보고서 자동생성 이력 테이블
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS quality_report_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_month    date NOT NULL,
  input_prev_excel_name  text,
  input_prev_ppt_name    text,
  input_data_name        text,
  output_excel_path  text,
  output_ppt_path    text,
  output_excel_name  text,
  output_ppt_name    text,
  status      text NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing','done','error')),
  error_msg   text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qrh_target_month ON quality_report_history(target_month DESC);
CREATE INDEX IF NOT EXISTS idx_qrh_created_at ON quality_report_history(created_at DESC);

ALTER TABLE quality_report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read" ON quality_report_history;
CREATE POLICY "auth_read" ON quality_report_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_insert" ON quality_report_history;
CREATE POLICY "auth_insert" ON quality_report_history
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update" ON quality_report_history;
CREATE POLICY "auth_update" ON quality_report_history
  FOR UPDATE USING (true);

-- Storage bucket (run separately if not exists):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('quality-reports','quality-reports', false)
-- ON CONFLICT (id) DO NOTHING;
