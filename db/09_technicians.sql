-- ====================================================
-- DDL: technicians 테이블
-- Source: 만누르법인 기술/보전 업무분장 (2026-02-24)
-- 총 27명 (주재원 1 / 정규직 23 / 계약직 3)
-- ====================================================

DROP TABLE IF EXISTS technicians CASCADE;

CREATE TABLE technicians (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  name_en     text,
  role        text,
  department  text,
  notes       text,
  is_expat    boolean     DEFAULT false,
  emp_type    text        DEFAULT 'regular' CHECK (emp_type IN ('regular','contract')),
  doj         date,
  is_active   boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technicians_dept   ON technicians(department);
CREATE INDEX IF NOT EXISTS idx_technicians_active ON technicians(is_active);

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users read technicians"   ON technicians FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth users insert technicians" ON technicians FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth users update technicians" ON technicians FOR UPDATE USING (auth.role() = 'authenticated');

-- ====================================================
-- DATA: 전체 팀원 27명 (2026-02-24 조직도 NEW 기준)
-- ====================================================
INSERT INTO technicians (name, name_en, role, department, notes, is_expat, emp_type, doj) VALUES

-- 총괄
('나경태',           'MR. NA',              'CTO / 기술팀장',    '기술팀 총괄', '기술/보전팀 총괄 (생산·기술·보전·생산관리)', true,  'regular', '2021-05-01'),
('K. SRINIVASAN',   'K. SRINIVASAN',       'AGM / HOD',         '기술팀 총괄', '전 부서 현지 총괄; kakao: srinidsc',          false, 'regular', '2009-05-20'),

-- 보전팀 (MAINTENANCE)
('R. RANJITH',      'R. RANJITH',          'Manager',           '보전팀', 'Plant Maintenance-A; kakao: ranjithdc',            false, 'regular', '2009-07-27'),
('G. SATHEESH MANI','G. SATHEESH MANI',    'Manager',           '보전팀', 'Plant Maintenance-B; kakao: satheesh',             false, 'regular', '2010-03-05'),
('R. SABARI NATHAN','R. SABARI NATHAN',    'Sr. Engineer',      '보전팀', 'MAIN DIRECT-A',                                   false, 'regular', '2017-05-10'),
('S. HARI KRISHAN', 'S. HARI KRISHAN',     'Technician',        '보전팀', 'MAIN DIRECT-B (2조)',                             false, 'regular', '2007-12-11'),
('G. SARAVANARAJ',  'G. SARAVANARAJ',      'Technician',        '보전팀', 'MAIN DIRECT-B (1조)',                             false, 'regular', '2008-09-05'),
('G. ARAVIND',      'G. ARAVIND',          'Jr. Engineer',      '보전팀', 'MAIN DIRECT-A (2조)',                             false, 'regular', '2023-08-23'),

-- 지그팀 (PED JIG)
('J. BALAJI',       'J. BALAJI',           'Manager',           '지그팀', 'Jig Team Management; kakao: balajidsc',            false, 'regular', '2012-07-05'),
('M. JESURAJ',      'M. JESURAJ',          'Asst. Manager',     '지그팀', 'JIG DIRECT-A',                                    false, 'regular', '2011-02-01'),
('K. MANIKUMAR',    'K. MANIKUMAR',        'Sr. Engineer',      '지그팀', 'JIG DIRECT-A (2조)',                              false, 'regular', '2011-02-09'),
('ME. SURESH',      'ME. SURESH',          'Technician',        '지그팀', 'JIG DIRECT-A (1조)',                              false, 'regular', '2008-04-01'),
('T. ELUMALAI',     'T. ELUMALAI',         'Technician',        '지그팀', 'JIG DIRECT-B (2조)',                              false, 'regular', '2007-12-26'),
('P. SATHISH KUMAR','P. SATHISH KUMAR',    'Jr. Engineer',      '지그팀', 'JIG DIRECT-A (3조)',                              false, 'regular', '2021-07-01'),

-- 금형팀 (PED TOOL)
('TAHIR NIZAMUDHIN','TAHIR NIZAMUDHIN',    'Manager',           '금형팀', 'Mould Management; kakao: nizamdsc',                false, 'regular', '2011-11-23'),
('S. JAYAKUMAR',    'S. JAYAKUMAR',        'Sr. Engineer',      '금형팀', 'TOOL DIRECT-A',                                   false, 'regular', '2011-12-07'),
('J. PRABHU',       'J. PRABHU',           'Engineer',          '금형팀', 'TOOL DIRECT-A (2조)',                             false, 'regular', '2015-06-24'),
('M. PRAVEEN',      'M. PRAVEEN',          'Sr. Engineer',      '금형팀', 'TOOL DIRECT-A (1조)',                             false, 'regular', '2010-02-08'),
('S. KANNAN',       'S. KANNAN',           'Jr. Engineer',      '금형팀', 'TOOL DIRECT-B (2조)',                             false, 'regular', '2021-07-22'),
('P. GANAPATHYRAMAN','P. GANAPATHYRAMAN',  'Engineer',          '금형팀', 'TOOL DIRECT-A (1조); 입사 2025-07',               false, 'regular', '2025-07-09'),

-- 생산기술팀 (PROCESS / TECH)
('C. VELU',         'C. VELU',             'Manager',           '생산기술팀', 'Process Improvement; kakao: veludsc',          false, 'regular', '2007-02-01'),
('PS. ASHOK KUMAR', 'PS. ASHOK KUMAR',     'Technician',        '생산기술팀', 'TECH DIRECT-A',                               false, 'regular', '2008-02-07'),
('AP. AJAY KANNAN', 'AP. AJAY KANNAN',     'Jr. Engineer (GET)','생산기술팀', 'Graduate Engineer Trainee',                    false, 'regular', '2021-06-17'),

-- 소모품창고 (STORES)
('S. ARUNKUMAR',    'S. ARUNKUMAR',        'Technician',        '소모품창고', '소모품 출입 관리',                             false, 'regular', '2007-11-12'),

-- 공무팀 FAB (계약직 CL)
('V. SURESH',       'V. SURESH',           'Contract Worker',   '공무팀 (FAB)', 'FAB DIRECT-A (CL)',                         false, 'contract', '2007-07-02'),
('V. MURUGAN',      'V. MURUGAN',          'Contract Worker',   '공무팀 (FAB)', 'FAB DIRECT-A (CL)',                         false, 'contract', '2011-10-12'),
('SAMAL',           'SAMAL',               'Contract Worker',   '공무팀 (FAB)', 'FAB DIRECT-A (CL)',                         false, 'contract', '2012-06-12');
