# JEEPNEY Personal Backup App — Phase 2 설계 문서

**작성일:** 2026-05-13  
**설계 완료:** 예정  
**웹개발자 착수:** Phase 2 개발 시작

---

## 1. 자동 백업 스케줄 (Automated Backup Schedule)

### 1.1 백업 트리거 방식

#### 기본 정책
- **주 트리거:** 매일 자동 백업
- **추가 트리거:** 수동 백업 버튼 (사용자 요청 시)
- **이벤트 트리거:** Agent 상태 변경 감지 (향후 확장)

#### 백업 시간대
```
설정 기준: 한국 표준시(GMT+9) - 사용자 타임존
권장 시간: 매일 02:00 KST (인도 현지시간 18:30 IST, 보통 근무 외 시간)

선택지:
1. 고정 시간: 02:00 KST (권장, 서버 부하 최소)
2. 사용자 커스텀: profile.backup_schedule (예: 22:00-23:00)
3. Intelligent time: 마지막 agent 활동 후 30분 (향후)
```

#### 동시 실행 제어
```
Status: 문제 가능성 낮음 (개별 사용자 기준)
하지만 다중 에이전트 환경 고려:

구현 방식:
- Mutex: Redis LOCK `backup:lock:{user_id}` (선택)
- Status Check: INSERT 전 status='in_progress' 확인
- Timeout: 30분 초과 시 'failed'로 변경 (자동 정리)
- Concurrent Limit: 사용자당 최대 1개 진행중 (DB constraint 추가 검토)

코드 레벨: API create.js에서 "already in progress" 체크
```

### 1.2 스케줄링 구현 방식

#### 옵션 A: Vercel Cron (권장)
```javascript
// pages/api/backup/schedule/daily.js
// Vercel에 내장된 cron 함수 사용

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // 모든 사용자에 대해 백업 생성
  const users = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('backup_enabled', true);
  
  const results = [];
  for (const user of users.data) {
    // 중복 확인: 오늘 이미 completed 백업이 있는지
    const today = new Date().toISOString().split('T')[0];
    const existing = await supabaseAdmin
      .from('backups')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', today)
      .eq('status', 'completed');
    
    if (existing.data.length === 0) {
      // 새 백업 생성
      const backup = await createBackup(user.id);
      results.push({ user_id: user.id, backup_id: backup.id, status: 'created' });
    }
  }
  
  return res.status(200).json({ success: true, results });
}

// vercel.json에 설정
{
  "crons": [
    {
      "path": "/api/backup/schedule/daily",
      "schedule": "0 2 * * *"  // 매일 02:00 UTC (08:30 IST)
    }
  ]
}
```

#### 옵션 B: 외부 Cron Service (Upstash, EasyCron)
```javascript
// 장점: Vercel 제약 없음, 상세 모니터링
// 단점: 외부 서비스 의존성

// pages/api/backup/cron/daily.js
// POST /api/backup/cron/daily?secret={CRON_SECRET}
```

#### 옵션 C: Database-Triggered (Supabase Functions)
```sql
-- PostgreSQL function + pg_cron extension
-- 장점: 데이터베이스 내에서 완전 관리
-- 단점: Supabase 요금제에 pg_cron 포함 확인 필요
```

**최종 결정:** 옵션 A (Vercel Cron) 추천
- 기존 Vercel 환경에 자연스럽게 통합
- 추가 비용 없음
- 간단한 설정

### 1.3 백업 생성 로직

```javascript
// lib/backup/createDailyBackup.js

async function createDailyBackup(userId) {
  // 1. 진행 중인 백업 확인
  const inProgress = await supabaseAdmin
    .from('backups')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'in_progress');
  
  if (inProgress.data.length > 0) {
    throw new Error('Backup already in progress');
  }
  
  // 2. 백업 레코드 생성
  const backup = await supabaseAdmin
    .from('backups')
    .insert({
      user_id: userId,
      name: `Auto Backup ${new Date().toISOString().split('T')[0]}`,
      backup_type: 'agent_state',
      status: 'in_progress',
      created_by: userId,
      metadata: {
        trigger: 'automated_daily',
        scheduled_time: new Date().toISOString(),
      },
    })
    .select()
    .single();
  
  try {
    // 3. Agent 상태 수집 (별도 모듈)
    const agentData = await collectAgentState(userId);
    
    // 4. 파일 추가
    for (const file of agentData.files) {
      await supabaseAdmin
        .from('backup_files')
        .insert({
          backup_id: backup.id,
          file_path: file.path,
          file_type: file.type,
          file_size: file.size,
          checksum: file.checksum,
        });
    }
    
    // 5. 백업 완료 표시
    await supabaseAdmin
      .from('backups')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        size_bytes: agentData.totalSize,
        file_count: agentData.files.length,
        storage_path: `backups/${userId}/${backup.id}/`,
      })
      .eq('id', backup.id);
    
    // 6. 알림 발송 (섹션 5 참고)
    await notifyBackupSuccess(userId, backup);
    
    return backup;
  } catch (error) {
    // 실패 처리
    await supabaseAdmin
      .from('backups')
      .update({
        status: 'failed',
        notes: `Auto backup failed: ${error.message}`,
      })
      .eq('id', backup.id);
    
    await notifyBackupFailure(userId, backup, error);
    throw error;
  }
}

module.exports = { createDailyBackup };
```

---

## 2. 보관 정책 (Retention Policy)

### 2.1 보관 기간 정의

#### 권장 정책
```
기본값: 90일 (3개월)
  - 충분한 복구 기간 제공
  - 저장소 비용 균형

선택지:
┌─────────────────────────────────────────┐
│ 정책        │ 보관기간 │ 용도              │
├─────────────────────────────────────────┤
│ Basic       │ 30일    │ 기본 사용자       │
│ Standard    │ 90일    │ 기본값 (권장)     │
│ Premium     │ 180일   │ 중요 데이터      │
│ Unlimited   │ 수동    │ 중요 시스템      │
└─────────────────────────────────────────┘
```

#### 설정 저장소
```sql
-- profiles 테이블에 추가 컬럼
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS 
  backup_retention_days INT DEFAULT 90;

-- 또는 별도 설정 테이블
CREATE TABLE IF NOT EXISTS backup_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  retention_days INT DEFAULT 90,
  max_storage_gb DECIMAL DEFAULT 10,
  auto_delete_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 자동 삭제 규칙

#### 삭제 트리거
```
1. 매일 02:05 KST (백업 직후, 스케줄 지연 5분)
   - 모든 사용자의 만료 백업 일괄 정리

2. 저장소 할당량 초과 시 (dynamic)
   - 오래된 백업부터 삭제 (FIFO)
   - 경고 후 삭제 (섹션 5 참고)

3. 사용자 요청 시 (manual)
   - 특정 백업 삭제 API
```

#### 삭제 로직
```javascript
// pages/api/backup/cleanup/daily.js

async function cleanupExpiredBackups() {
  const cron_secret = process.env.CRON_SECRET;
  
  // 1. 모든 사용자 정책 조회
  const policies = await supabaseAdmin
    .from('backup_policies')
    .select('user_id, retention_days, max_storage_gb')
    .eq('auto_delete_enabled', true);
  
  const results = [];
  
  for (const policy of policies.data) {
    // 2. 만료된 백업 찾기
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - policy.retention_days);
    
    const expiredBackups = await supabaseAdmin
      .from('backups')
      .select('id, name, size_bytes')
      .eq('user_id', policy.user_id)
      .lt('created_at', expiryDate.toISOString())
      .order('created_at', { ascending: true });
    
    // 3. 저장소 할당량 초과 확인
    const totalSize = await supabaseAdmin
      .from('backups')
      .select('size_bytes', { count: 'exact' })
      .eq('user_id', policy.user_id);
    
    const usedGB = (totalSize.data?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0) / (1024 ** 3);
    
    let toDelete = expiredBackups.data || [];
    
    // 4. 할당량 초과 시 추가 삭제
    if (usedGB > policy.max_storage_gb) {
      const excessBackups = await supabaseAdmin
        .from('backups')
        .select('id, name, size_bytes')
        .eq('user_id', policy.user_id)
        .order('created_at', { ascending: true });
      
      let currentSize = usedGB * (1024 ** 3);
      const maxSize = policy.max_storage_gb * (1024 ** 3);
      
      for (const backup of excessBackups.data || []) {
        if (currentSize <= maxSize) break;
        if (!toDelete.find(b => b.id === backup.id)) {
          toDelete.push(backup);
        }
        currentSize -= backup.size_bytes || 0;
      }
    }
    
    // 5. 삭제 실행
    for (const backup of toDelete) {
      try {
        // 먼저 backup_files 삭제 (cascade)
        await supabaseAdmin
          .from('backups')
          .delete()
          .eq('id', backup.id);
        
        results.push({
          user_id: policy.user_id,
          backup_id: backup.id,
          backup_name: backup.name,
          status: 'deleted',
          reason: usedGB > policy.max_storage_gb ? 'quota_exceeded' : 'expired',
        });
      } catch (error) {
        results.push({
          user_id: policy.user_id,
          backup_id: backup.id,
          status: 'failed',
          error: error.message,
        });
      }
    }
  }
  
  return results;
}

module.exports = { cleanupExpiredBackups };

// vercel.json에 추가
{
  "crons": [
    {
      "path": "/api/backup/cleanup/daily",
      "schedule": "5 2 * * *"  // 매일 02:05 UTC (08:35 IST)
    }
  ]
}
```

### 2.3 저장소 할당량 관리

#### 할당량 설정
```sql
-- backup_policies 테이블 확장
CREATE TABLE IF NOT EXISTS backup_storage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  plan_type TEXT DEFAULT 'standard',  -- basic, standard, premium, unlimited
  max_storage_bytes BIGINT,
  current_usage_bytes BIGINT DEFAULT 0,
  warning_threshold_percent INT DEFAULT 80,  -- 80% 시 경고
  last_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 각 plan의 용량
-- basic: 2GB, standard: 10GB, premium: 50GB, unlimited: NULL
```

#### 할당량 체크 API
```javascript
// pages/api/backup/quota/status.js

async function getBackupQuotaStatus(userId) {
  // 1. 사용자 할당량 조회
  const quota = await supabaseAdmin
    .from('backup_storage_quotas')
    .select('max_storage_bytes, warning_threshold_percent')
    .eq('user_id', userId)
    .single();
  
  // 2. 현재 사용량 계산
  const backups = await supabaseAdmin
    .from('backups')
    .select('size_bytes')
    .eq('user_id', userId)
    .eq('status', 'completed');
  
  const usedBytes = backups.data?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;
  
  // 3. 상태 계산
  const percentage = (usedBytes / quota.data.max_storage_bytes) * 100;
  const isWarning = percentage >= quota.data.warning_threshold_percent;
  
  return {
    max_bytes: quota.data.max_storage_bytes,
    used_bytes: usedBytes,
    available_bytes: quota.data.max_storage_bytes - usedBytes,
    percentage: Math.round(percentage * 100) / 100,
    is_warning: isWarning,
    is_exceeded: usedBytes > quota.data.max_storage_bytes,
  };
}
```

---

## 3. 저장소 전략 (Storage Strategy)

### 3.1 저장소 옵션 비교

```
┌────────────────────────────────────────────────────────────────┐
│ 옵션              │ 비용  │ 속도  │ 확장성 │ 권장도            │
├────────────────────────────────────────────────────────────────┤
│ Supabase Storage  │ $$   │ 빠름 │ 높음  │ ⭐⭐⭐ (권장)   │
│ AWS S3            │ $$   │ 빠름 │ 매우높음│⭐⭐ (향후)     │
│ 로컬 (Vercel)     │ $    │ 최빠름│ 낮음  │ ⭐ (프로토타입) │
│ Google Cloud GCS  │ $$   │ 빠름 │ 높음  │ ⭐ (대안)       │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 권장 전략: Supabase Storage

#### 이유
- 기존 Supabase 통합으로 설정 간단
- Next.js + Vercel 호환
- Row-level security (RLS) 내장
- 압축 및 암호화 지원
- 가격 경쟁력

#### 구현 방식

```javascript
// lib/backup/storage.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadBackupFile(userId, backupId, filePath, fileBuffer, metadata = {}) {
  // 1. 경로 생성
  const storagePath = `backups/${userId}/${backupId}/${filePath}`;
  
  // 2. 파일 업로드 (자동 gzip, 메타데이터 포함)
  const { data, error } = await supabase.storage
    .from('backups')
    .upload(storagePath, fileBuffer, {
      contentType: metadata.contentType || 'application/octet-stream',
      metadata: {
        originalSize: metadata.originalSize,
        uploadedAt: new Date().toISOString(),
      },
      upsert: false,
    });
  
  if (error) throw error;
  
  // 3. 공개 URL 생성
  const { data: urlData } = supabase.storage
    .from('backups')
    .getPublicUrl(storagePath);
  
  return {
    storage_url: urlData.publicUrl,
    storage_path: storagePath,
  };
}

async function downloadBackupFile(userId, backupId, filePath) {
  const { data, error } = await supabase.storage
    .from('backups')
    .download(`backups/${userId}/${backupId}/${filePath}`);
  
  if (error) throw error;
  return data;
}

async function deleteBackupFiles(userId, backupId) {
  const { data, error } = await supabase.storage
    .from('backups')
    .list(`backups/${userId}/${backupId}`);
  
  if (error) throw error;
  
  const filePaths = data.map(file => `backups/${userId}/${backupId}/${file.name}`);
  
  if (filePaths.length > 0) {
    const { error: deleteError } = await supabase.storage
      .from('backups')
      .remove(filePaths);
    
    if (deleteError) throw deleteError;
  }
}

module.exports = {
  uploadBackupFile,
  downloadBackupFile,
  deleteBackupFiles,
};
```

#### Supabase Storage 설정

```sql
-- 1. bucket 생성 (Supabase Dashboard > Storage)
-- 또는 SQL로
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false);

-- 2. RLS 정책 설정
-- 사용자는 자신의 백업만 접근 가능
CREATE POLICY "users_can_access_own_backups" ON storage.objects
  FOR ALL USING (
    (bucket_id = 'backups') AND 
    (auth.uid()::text = (storage.foldername(name))[1])
  );
```

### 3.3 압축 전략

#### 옵션 1: 개별 파일 gzip (권장)
```javascript
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

async function compressAndUpload(filePath, fileBuffer) {
  const compressed = await gzipAsync(fileBuffer, { level: 9 });
  
  // Supabase에 .gz 확장자로 업로드
  return uploadBackupFile(
    userId,
    backupId,
    filePath + '.gz',
    compressed,
    { originalSize: fileBuffer.length }
  );
}
```

#### 옵션 2: 전체 백업 ZIP (다운로드용)
```javascript
import archiver from 'archiver';
import { Readable } from 'stream';

async function createBackupZip(userId, backupId) {
  // 1. backup_files 조회
  const files = await supabaseAdmin
    .from('backup_files')
    .select('*')
    .eq('backup_id', backupId);
  
  // 2. ZIP 생성
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  for (const file of files.data) {
    const content = await downloadBackupFile(userId, backupId, file.file_path);
    archive.append(content, { name: file.file_path });
  }
  
  await archive.finalize();
  return archive;
}
```

**최종 결정:** 
- 저장: 개별 gzip (Supabase Storage)
- 다운로드: ZIP 묶음 생성

### 3.4 암호화 전략

#### 옵션 1: Supabase Storage의 기본 암호화 (권장)
- AWS S3 기반으로 기본 암호화 적용
- 추가 비용 없음

#### 옵션 2: 클라이언트 측 암호화 (선택)
```javascript
import crypto from 'crypto';

function encryptBackupData(data, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
  
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return Buffer.concat([iv, encrypted]);
}

// 저장: 암호화 데이터 → Supabase Storage
// 복구: Supabase에서 다운로드 → 복호화
```

**최종 결정:** Supabase Storage 기본 암호화 (비용 효율)
- 선택: 향후 암호화 기능 toggle로 추가 가능

---

## 4. DB 마이그레이션 계획

### 4.1 Phase 1 스키마 검증

```sql
-- 현재 스키마 확인
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('backups', 'backup_files')
ORDER BY table_name, ordinal_position;
```

### 4.2 Phase 2 추가 컬럼

```sql
-- 1. backups 테이블 확장
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS
  storage_provider TEXT DEFAULT 'supabase'
  CHECK (storage_provider IN ('supabase', 's3', 'local'));

ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS
  is_compressed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS
  compression_ratio DECIMAL DEFAULT 1.0;

-- 2. backup_files 테이블 확장
ALTER TABLE public.backup_files ADD COLUMN IF NOT EXISTS
  is_compressed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.backup_files ADD COLUMN IF NOT EXISTS
  original_size_bytes BIGINT;  -- 압축 전 크기

-- 3. 보관 정책 테이블 생성
CREATE TABLE IF NOT EXISTS public.backup_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  retention_days INT DEFAULT 90
    CHECK (retention_days >= 7 AND retention_days <= 3650),
  max_storage_bytes BIGINT DEFAULT 10737418240,  -- 10GB
  auto_delete_enabled BOOLEAN DEFAULT TRUE,
  warning_threshold_percent INT DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS backup_policies_user_id_idx 
  ON backup_policies(user_id);

-- 4. 저장소 할당량 추적 테이블
CREATE TABLE IF NOT EXISTS public.backup_storage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT DEFAULT 'standard'
    CHECK (plan_type IN ('basic', 'standard', 'premium', 'unlimited')),
  max_storage_bytes BIGINT,
  current_usage_bytes BIGINT DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS backup_storage_quotas_user_id_idx 
  ON backup_storage_quotas(user_id);

-- 5. 백업 알림 로그 테이블
CREATE TABLE IF NOT EXISTS public.backup_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  backup_id UUID REFERENCES backups(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL
    CHECK (notification_type IN ('success', 'failure', 'quota_warning', 'quota_exceeded')),
  message TEXT NOT NULL,
  notification_channel TEXT DEFAULT 'email'
    CHECK (notification_channel IN ('email', 'telegram', 'in_app')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS backup_notifications_user_id_idx 
  ON backup_notifications(user_id);
CREATE INDEX IF NOT EXISTS backup_notifications_backup_id_idx 
  ON backup_notifications(backup_id);
```

### 4.3 RLS 정책 추가

```sql
-- backup_policies RLS
ALTER TABLE public.backup_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_own_policies" ON backup_policies
  FOR ALL USING (auth.uid() = user_id);

-- backup_storage_quotas RLS
ALTER TABLE public.backup_storage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_quotas" ON backup_storage_quotas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_can_update_quotas" ON backup_storage_quotas
  FOR UPDATE USING (
    (auth.uid() = user_id) OR 
    auth.jwt() ->> 'role' = 'admin'
  );

-- backup_notifications RLS
ALTER TABLE public.backup_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_notifications" ON backup_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_notifications" ON backup_notifications
  FOR UPDATE USING (auth.uid() = user_id);
```

### 4.4 마이그레이션 절차

```bash
# 1. 로컬 테스트 (development)
#    - 스크립트 실행 후 각 테이블 확인
#    - 데이터 무결성 검증

# 2. Staging 적용
#    - Vercel staging 환경에 배포
#    - Stage DB에 마이그레이션 실행
#    - API 테스트 (list, create, update)

# 3. Production 적용
#    - 백업 작성: 현재 DB snapshot
#    - 마이그레이션 실행
#    - 사후 검증: 기존 데이터 무결성

# 4. Rollback 계획
#    - 이전 버전 DB snapshot 유지
#    - 필요 시 즉시 복구 가능
```

### 4.5 데이터 무결성 검증

```sql
-- 마이그레이션 후 검증
SELECT 
  COUNT(*) as total_backups,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(size_bytes) as total_size_bytes,
  SUM(file_count) as total_files
FROM backups;

-- 고아(orphaned) 파일 확인
SELECT bf.id, bf.backup_id
FROM backup_files bf
LEFT JOIN backups b ON bf.backup_id = b.id
WHERE b.id IS NULL;  -- 결과가 없어야 함

-- 정책/할당량 설정 확인
SELECT 
  COUNT(*) as policies_created,
  AVG(retention_days) as avg_retention,
  COUNT(DISTINCT user_id) as users_with_policies
FROM backup_policies;
```

---

## 5. 모니터링 & 알림 + 감사 지표 (Monitoring, Notifications & Audit Integration)

### 5.0 감사체계 연계 (Audit System Integration) ⭐ **AI팀원 활용**

백업 메트릭을 DSC 공장의 감사 프레임워크에 통합. 매일 자동으로 비서가 수집 → 평가자가 검증 → 데이터분석가가 분석.

#### 배포 가용성 지표 (Deployment Availability)
```
지표 이름: backup_success_rate
수식: (성공한 백업 수 / 시도한 백업 수) × 100
목표값: ≥ 95%
담당: 비서(자동 수집) + 평가자(검증)

예시:
- 2026-05-13: 28/28 = 100% ✅ (배포 정상)
- 2026-05-12: 27/28 = 96% ✅ (1회 실패, 복구됨)
- 2026-05-11: 25/28 = 89% ⚠️ (3회 연속 실패 — 평가자 검증 필요)

평가자 검증 항목:
- API 응답 시간 (< 2초 통과)
- 저장소 연결 상태
- 데이터 무결성
```

#### 시스템 신뢰도 데이터 (System Reliability)
```
지표 이름: backup_storage_reliability
수식: (보관 정책 준수율 × 가용성 점수) / 2
목표값: ≥ 98%

구성:
├─ 보관 정책 준수율 (retention_compliance)
│  수식: (예정된 삭제 / 실제 삭제) × 100
│  예: 90일 경과 백업 중 100% 자동 삭제 = 100%
│
└─ 가용성 점수 (availability_score)
   수식: (24시간 중 정상 동작 시간 / 24시간) × 100
   예: 23.5시간 정상 = 97.9%

매일 집계되는 신뢰도 점수:
- 98% 이상: 녹색 (신뢰도 높음)
- 95~98%: 황색 (주의 필요)
- 95% 미만: 빨간색 (개선 필요 — 평가자 즉시 검증)
```

#### 비서 자동화 작업 (Secretary Auto Tasks)
```javascript
// lib/audit/collectBackupMetrics.js

매일 자동 실행 (03:30 KST):
1. backup_metrics 조회 → summary 계산
2. backup_notifications 조회 → 실패율 계산
3. backup_policies 조회 → 준수율 계산
4. backup_notifications에 audit_metrics 추가

출력:
{
  date: '2026-05-13',
  success_rate: 96.0,
  retention_compliance: 100.0,
  availability_score: 99.2,
  reliability_score: 99.6,
  status: 'healthy',  // healthy | warning | critical
  evaluator_required: false
}

→ 평가자가 매일 아침 review
```

#### 평가자 검증 체크리스트 (Evaluator Validation)
```
Daily Standup (매일 아침):
□ 어제 백업 성공률 확인 (< 95% 시 원인 분석)
□ API 응답 시간 확인 (SLA: < 2초)
□ 저장소 연결 상태 테스트 (manual validation)
□ 데이터 무결성 샘플 확인 (매주 1회 복구 테스트)

Weekly Review (매주 금요일):
□ 주간 reliability_score 추이 (7일 평균)
□ 실패 백업 근본 원인 분석
□ 복구 테스트 통과율 (target: 100%)
□ 저장소 품질 지표 (압축률, 중복제거율)

Monthly Audit (매월 말):
□ 월간 SLA 준수율 (target: 99.6%)
□ 비용 최적화 검토 (저장소 사용량)
□ 성능 추이 분석
□ 개선안 수립
```

#### 데이터분석가 분석 작업 (Data Analyst Tasks)
```javascript
// lib/audit/analyzeBackupTrends.js

매일 자동 실행 (04:00 KST):
분석 목표:
1. 일일 백업 크기 추이 (Daily Backup Size Trends)
2. 저장소 할당량 변화 (Storage Quota Changes)
3. 압축 효율 분석 (Compression Efficiency)
4. 사용 패턴 분석 (Usage Patterns)

**1. 백업 크기 추이 분석:**

쿼리:
SELECT
  DATE(created_at) as backup_date,
  COUNT(*) as daily_count,
  SUM(size_bytes) / (1024^3) as total_gb,
  AVG(size_bytes) / (1024^3) as avg_backup_gb,
  MAX(size_bytes) / (1024^3) as max_backup_gb,
  MIN(size_bytes) / (1024^3) as min_backup_gb
FROM backups
WHERE user_id = '${userId}'
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY backup_date DESC;

메트릭 저장 (backup_metrics):
{
  user_id: '${userId}',
  metric_date: '2026-05-15',
  daily_backup_count: 28,
  total_size_gb: 45.3,
  avg_backup_size_gb: 1.62,
  max_backup_size_gb: 3.2,
  min_backup_size_gb: 0.8,
  size_growth_percent: 2.3,  // 전일 대비 증감율
  trend: 'stable' | 'increasing' | 'decreasing'
}
```

**2. 저장소 할당량 변화 분석:**

쿼리:
SELECT
  DATE(last_calculated_at) as calc_date,
  current_usage_bytes / (1024^3) as current_gb,
  max_storage_bytes / (1024^3) as max_gb,
  (current_usage_bytes / max_storage_bytes) * 100 as usage_percent,
  (current_usage_bytes / max_storage_bytes) * 100 - LAG((current_usage_bytes / max_storage_bytes) * 100) 
    OVER (ORDER BY last_calculated_at) as daily_change_percent
FROM backup_storage_quotas
WHERE user_id = '${userId}'
ORDER BY last_calculated_at DESC
LIMIT 90;

데이터분석가 리포트:
{
  date: '2026-05-15',
  current_usage: { gb: 18.5, percent: 46.3 },
  quota_trend: {
    7day_avg_growth: 0.26,  // % per day
    projected_full_date: '2026-10-22',  // 현재 속도면 풀 찰 예상일
    recommendation: 'stable' | 'upgrade_recommended' | 'urgent'
  },
  daily_changes: [
    { date: '2026-05-15', usage_gb: 18.5, change_percent: 0.3 },
    { date: '2026-05-14', usage_gb: 18.4, change_percent: 0.4 },
    // ...
  ]
}

→ 주간 리포트에 "할당량 초과 예상일" 자동 포함
→ 월간 "저장소 계획 검토" 보고서 작성
```

**3. 압축 효율 분석 (Compression Analysis):**

```javascript
// 백업 파일 메타데이터에 압축 정보 추가
{
  original_size_bytes: 2147483648,    // 2 GB
  compressed_size_bytes: 536870912,   // 512 MB
  compression_ratio: 0.25,            // 25% 압축율
  compression_algorithm: 'gzip',      // gzip 기본
  compression_time_seconds: 45,
  decompression_time_seconds: 38
}

분석:
- 평균 압축율: (일반적으로 50~70%)
- 최대 압축율: 파일 유형별 분석
- 압축 성능: 백업당 소요시간 추이
- 권장사항: 압축 레벨 조정 필요 여부
```

**4. 주간/월간 보고서 (Weekly & Monthly Reports):**

주간 분석 리포트 (매주 금요일):
```
📊 백업 주간 분석 리포트 (2026-05-08 ~ 2026-05-14)

1️⃣ 크기 추이
   - 주간 평균: 44.8 GB
   - 일일 평균 변화: +0.26 GB/일
   - 추이: 안정적 상승 ⬆️

2️⃣ 저장소 상태
   - 현재 사용: 18.5 GB / 40 GB (46.3%)
   - 일주일 전: 17.9 GB (44.8%)
   - 예상 풀 채우는 날: 2026-10-22 (157일)
   - 상태: 🟡 경고 (50% 도달 예상 2026-08-15)

3️⃣ 압축 효율
   - 평균 압축율: 58.2%
   - 최고 효율 백업: backup_20260514_1 (72%)
   - 최저 효율 백업: backup_20260510_2 (42%)

4️⃣ 패턴 분석
   - 가장 많은 백업: 목요일 (28회)
   - 평균 백업 크기: 1.62 GB
   - 피크 시간: 02:00 KST (자동 백업)

5️⃣ 권장사항
   - 저장소 할당량 증가 검토 (6개월 내)
   - 압축 설정 최적화 검토
   - 오래된 백업(30일+) 자동 삭제 정책 검토
```

월간 종합 분석 (매월 말):
```
📈 백업 월간 종합 분석 리포트 (2026-05-01 ~ 2026-05-31)

1️⃣ 월간 성과
   - 총 백업 수: 810회 (일평균 27회)
   - 성공률: 96.3%
   - 총 용량: 526 GB (평균 17.5 GB/일)

2️⃣ 신뢰도 분석
   - 가용성 점수: 99.2% ✅
   - 압축 신뢰도: 99.8% ✅
   - 저장소 접근성: 99.9% ✅
   - 종합 신뢰도: 99.6% ⭐

3️⃣ 비용 최적화
   - Supabase Storage 비용: $X/월
   - 압축으로 절약: $Y/월 (25%)
   - 예상 연간 비용: $Z (현 추이 기반)

4️⃣ 개선안 제시
   - 현재 패턴: 안정적 상승 추이
   - 리스크: 저장소 고갈 위험 (6개월)
   - 대책: 할당량 증가 또는 오래 백업 자동 삭제 정책
   - ROI: 월 $Y 절약 예상

5️⃣ 차월 계획
   - 저장소 증설 검토 (2026-06-15까지 결정)
   - 압축 알고리즘 성능 벤치마크
   - 사용자 피드백 수집
```

API 엔드포인트 (데이터분석가용):
```javascript
// GET /api/backup/analytics/trends?user_id=${userId}&days=90
응답: { daily_data, weekly_summary, monthly_summary, forecasts }

// GET /api/backup/analytics/storage-quota?user_id=${userId}
응답: { current_usage, quota_history, projections, recommendations }

// GET /api/backup/analytics/compression?user_id=${userId}&days=30
응답: { compression_ratio, efficiency_metrics, algorithm_analysis }

// GET /api/backup/analytics/patterns?user_id=${userId}&days=30
응답: { hourly_distribution, daily_distribution, usage_patterns, recommendations }
```
```

### 5.1 백업 성공/실패 알림

#### 알림 채널
```
1. Email (기본, 모든 사용자)
2. Telegram (선택, 기존 설정 활용)
3. In-App (대시보드에 표시)
```

#### 이메일 템플릿

**성공 알림:**
```html
Subject: ✅ Backup Completed - ${date}

Hi ${userName},

Your backup has been completed successfully.

Details:
- Backup ID: ${backupId}
- Size: ${fileSize}
- Files: ${fileCount}
- Completed at: ${completedTime}
- Type: ${backupType}

Manage backups: https://dsc-fms-portal.vercel.app/jeepney-personal/backup-app

Stay safe!
JEEPNEY Team
```

**실패 알림:**
```html
Subject: ❌ Backup Failed - ${date}

Hi ${userName},

Your automated backup failed to complete.

Error: ${errorMessage}
Attempted at: ${attemptedTime}

Action: Please check the backup logs in the management panel.
Retry: Manual backup can be triggered immediately.

Manage backups: https://dsc-fms-portal.vercel.app/jeepney-personal/backup-app

Need help? Contact support.
JEEPNEY Team
```

**할당량 경고:**
```html
Subject: ⚠️ Backup Storage Warning

Hi ${userName},

Your backup storage is ${usagePercent}% full.

Current usage: ${usedGB} / ${maxGB}
Action: Older backups will be automatically deleted when quota is exceeded.

Current plan: ${planType}
Upgrade options: [Premium, Unlimited] (if available)

Manage settings: https://dsc-fms-portal.vercel.app/jeepney-personal/backup-app/settings

JEEPNEY Team
```

#### 알림 발송 구현

```javascript
// lib/backup/notifications.js

async function sendBackupNotification(userId, backupId, type, details = {}) {
  const user = await supabaseAdmin
    .from('profiles')
    .select('email, telegram_user_id, notification_settings')
    .eq('id', userId)
    .single();
  
  const settings = user.data.notification_settings || {};
  
  // 1. 데이터베이스에 알림 로그 저장
  await supabaseAdmin
    .from('backup_notifications')
    .insert({
      user_id: userId,
      backup_id: backupId,
      notification_type: type,
      message: generateMessage(type, details),
      notification_channel: settings.preferred_channel || 'email',
    });
  
  // 2. 채널별 발송
  if (settings.email_enabled !== false && user.data.email) {
    await sendEmail(user.data.email, type, details);
  }
  
  if (settings.telegram_enabled && user.data.telegram_user_id) {
    await sendTelegram(user.data.telegram_user_id, type, details);
  }
}

async function sendEmail(email, type, details) {
  // Nodemailer, SendGrid, 또는 AWS SES 사용
  const template = getEmailTemplate(type, details);
  
  // 이메일 발송 구현 (외부 서비스 연동)
  await emailProvider.send({
    to: email,
    subject: template.subject,
    html: template.html,
  });
}

async function sendTelegram(telegramUserId, type, details) {
  // 기존 Telegram bot 연동 (JEEPNEY에 통합)
  const message = getTelegramMessage(type, details);
  
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text: message,
      parse_mode: 'HTML',
    }),
  });
}

module.exports = { sendBackupNotification, sendEmail, sendTelegram };
```

### 5.2 저장소 사용량 추적

#### 정기 업데이트 (매일 03:00 KST)

```javascript
// pages/api/backup/metrics/update-usage.js

async function updateStorageUsage() {
  const policies = await supabaseAdmin
    .from('backup_policies')
    .select('user_id');
  
  for (const policy of policies.data) {
    // 1. 현재 사용량 계산
    const backups = await supabaseAdmin
      .from('backups')
      .select('size_bytes')
      .eq('user_id', policy.user_id)
      .eq('status', 'completed');
    
    const totalBytes = backups.data?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;
    
    // 2. 할당량 조회
    const quota = await supabaseAdmin
      .from('backup_storage_quotas')
      .select('max_storage_bytes, warning_threshold_percent')
      .eq('user_id', policy.user_id)
      .single();
    
    // 3. 업데이트
    await supabaseAdmin
      .from('backup_storage_quotas')
      .update({
        current_usage_bytes: totalBytes,
        last_calculated_at: new Date().toISOString(),
      })
      .eq('user_id', policy.user_id);
    
    // 4. 경고 체크
    const percentage = (totalBytes / quota.data.max_storage_bytes) * 100;
    
    if (percentage >= quota.data.warning_threshold_percent) {
      await sendBackupNotification(
        policy.user_id,
        null,
        'quota_warning',
        {
          usagePercent: Math.round(percentage),
          usedGB: (totalBytes / (1024 ** 3)).toFixed(2),
          maxGB: (quota.data.max_storage_bytes / (1024 ** 3)).toFixed(2),
        }
      );
    }
    
    if (totalBytes > quota.data.max_storage_bytes) {
      await sendBackupNotification(
        policy.user_id,
        null,
        'quota_exceeded',
        { ... }
      );
    }
  }
}

// vercel.json
{
  "crons": [
    {
      "path": "/api/backup/metrics/update-usage",
      "schedule": "0 3 * * *"  // 매일 03:00 UTC (08:30 IST)
    }
  ]
}
```

### 5.3 백업 성공률 대시보드

#### 메트릭 저장소

```sql
-- 시간별 백업 통계 테이블
CREATE TABLE IF NOT EXISTS public.backup_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  total_backups INT DEFAULT 0,
  successful_backups INT DEFAULT 0,
  failed_backups INT DEFAULT 0,
  skipped_backups INT DEFAULT 0,  -- 이미 존재하는 경우
  total_size_bytes BIGINT DEFAULT 0,
  average_duration_seconds INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, metric_date)
);

CREATE INDEX IF NOT EXISTS backup_metrics_user_date_idx 
  ON backup_metrics(user_id, metric_date DESC);
```

#### 대시보드 API

```javascript
// pages/api/backup/metrics/summary.js

async function getBackupMetricsSummary(userId, days = 30) {
  // 1. 최근 N일 메트릭 조회
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const metrics = await supabaseAdmin
    .from('backup_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('metric_date', startDate.toISOString().split('T')[0])
    .order('metric_date', { ascending: false });
  
  // 2. 통계 계산
  const summary = {
    period_days: days,
    total_backups: 0,
    successful: 0,
    failed: 0,
    success_rate: 0,
    total_size_gb: 0,
    avg_daily_size_gb: 0,
    largest_backup_gb: 0,
  };
  
  metrics.data?.forEach(m => {
    summary.total_backups += m.total_backups;
    summary.successful += m.successful_backups;
    summary.failed += m.failed_backups;
    summary.total_size_gb += m.total_size_bytes / (1024 ** 3);
  });
  
  summary.success_rate = summary.total_backups > 0
    ? Math.round((summary.successful / summary.total_backups) * 100)
    : 0;
  
  summary.avg_daily_size_gb = summary.total_size_gb / days;
  
  // 3. 최근 백업 조회 (크기 확인)
  const backups = await supabaseAdmin
    .from('backups')
    .select('size_bytes')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('size_bytes', { ascending: false })
    .limit(1);
  
  if (backups.data?.length > 0) {
    summary.largest_backup_gb = (backups.data[0].size_bytes || 0) / (1024 ** 3);
  }
  
  return summary;
}

module.exports = { getBackupMetricsSummary };
```

#### 대시보드 UI 컴포넌트

```javascript
// pages/jeepney-personal/backup-app/metrics.js

export default function BackupMetrics({ userId }) {
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState(30);
  
  useEffect(() => {
    fetchMetrics();
  }, [period]);
  
  const fetchMetrics = async () => {
    const res = await fetch(`/api/backup/metrics/summary?user_id=${userId}&days=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMetrics(data);
  };
  
  return (
    <div className="backup-metrics">
      <h2>백업 통계</h2>
      
      <div className="metric-cards">
        <MetricCard
          label="성공률"
          value={`${metrics?.success_rate || 0}%`}
          icon="✅"
          color={metrics?.success_rate >= 95 ? 'green' : 'yellow'}
        />
        <MetricCard
          label="전체 백업"
          value={metrics?.total_backups || 0}
          icon="📦"
        />
        <MetricCard
          label="실패"
          value={metrics?.failed || 0}
          icon="❌"
          color={metrics?.failed > 0 ? 'red' : 'gray'}
        />
        <MetricCard
          label="저장 용량"
          value={`${(metrics?.total_size_gb || 0).toFixed(2)} GB`}
          icon="💾"
        />
      </div>
      
      <div className="period-selector">
        <button onClick={() => setPeriod(7)}>7일</button>
        <button onClick={() => setPeriod(30)}>30일</button>
        <button onClick={() => setPeriod(90)}>90일</button>
      </div>
    </div>
  );
}
```

---

## 6. UI/UX 추가 기능 정의

### 6.1 자동 백업 관리 화면

```
┌─────────────────────────────────────────────┐
│ 백업 관리 > 자동 백업 설정                    │
├─────────────────────────────────────────────┤
│                                              │
│ 🔄 자동 백업                                 │
│ ───────────────────────────────────────────│
│ ☑ 자동 백업 활성화                           │
│                                              │
│ 시간: [ 02:00 ▼ ]   (한국 표준시)            │
│ 간격: [ 매일 ▼ ]                            │
│ 보관기간: [ 90일 ▼ ]                        │
│                                              │
│ ✓ 저장                                       │
│                                              │
│ 📋 최근 자동 백업                             │
│ ───────────────────────────────────────────│
│ 📦 2026-05-13 02:00   완료   (1.2 GB)      │
│ 📦 2026-05-12 02:00   완료   (1.1 GB)      │
│ 📦 2026-05-11 02:00   완료   (1.3 GB)      │
│                                              │
└─────────────────────────────────────────────┘
```

**컴포넌트:**
- `AutoBackupSettings` — 설정 폼
- `BackupScheduleCard` — 스케줄 표시
- `BackupHistoryList` — 최근 백업 목록

### 6.2 저장소 관리 화면

```
┌─────────────────────────────────────────────┐
│ 백업 관리 > 저장소 관리                       │
├─────────────────────────────────────────────┤
│                                              │
│ 📊 저장소 사용량                              │
│ ───────────────────────────────────────────│
│ [████████░░░░░░░░░░░] 8.4 / 10 GB (84%)    │
│                                              │
│ 상세:                                        │
│ ├─ 활성 백업: 7개 (7.2 GB)                   │
│ ├─ 만료 예정: 2개 (1.2 GB, 5일 후 삭제)     │
│ └─ 스킵된 백업: 1개 (0.0 GB)                │
│                                              │
│ 📋 삭제 정책                                 │
│ ───────────────────────────────────────────│
│ 보관기간: [ 90일 ▼ ]                       │
│ 할당량: [ 10 GB ▼ ]                        │
│ 자동 삭제: [ ☑ 활성화 ]                     │
│ 경고 임계값: [ 80% ▼ ]                     │
│                                              │
│ ✓ 저장                                       │
│                                              │
│ ⚠️ 다음 백업은 불가능합니다.                  │
│    이전 백업을 삭제하거나 할당량을 늘리세요.   │
│    [수동 삭제] [업그레이드]                   │
│                                              │
└─────────────────────────────────────────────┘
```

**컴포넌트:**
- `StorageUsageBar` — 사용량 게이지
- `StorageBreakdown` — 항목별 사용량
- `RetentionPolicyForm` — 정책 설정
- `QuotaWarning` — 초과 경고

### 6.3 백업 통계 대시보드

```
┌─────────────────────────────────────────────┐
│ 백업 관리 > 통계                              │
├─────────────────────────────────────────────┤
│                                              │
│ [7일 ▼] [30일] [90일]                        │
│                                              │
│ ┌─────────────┐  ┌─────────────┐            │
│ │ 성공률      │  │ 전체 백업    │            │
│ │ ✅ 98%     │  │ 📦 28개    │            │
│ └─────────────┘  └─────────────┘            │
│                                              │
│ ┌─────────────┐  ┌─────────────┐            │
│ │ 실패        │  │ 저장 용량    │            │
│ │ ❌ 0개     │  │ 💾 8.4 GB  │            │
│ └─────────────┘  └─────────────┘            │
│                                              │
│ 📈 7일 간 성공률 추이                         │
│ ───────────────────────────────────────────│
│ 100%┤        ┌─                             │
│  90%┤  ┌─┐  ┌┘ └─┐                         │
│  80%┤  │ │  │   │                         │
│     └──┴─┴──┴───┴─ 날짜                    │
│                                              │
│ 🔍 백업별 상세 보기                          │
│ ───────────────────────────────────────────│
│ 날짜         │ 상태   │ 크기   │ 소요시간   │
│ 2026-05-13  │ ✅    │ 1.2GB │ 5분     │
│ 2026-05-12  │ ✅    │ 1.1GB │ 4분     │
│ 2026-05-11  │ ✅    │ 1.3GB │ 6분     │
│                                              │
└─────────────────────────────────────────────┘
```

**컴포넌트:**
- `BackupMetricsCards` — KPI 표시
- `SuccessRateChart` — 성공률 추이 그래프
- `DetailedBackupTable` — 상세 테이블

### 6.4 알림 설정 화면

```
┌─────────────────────────────────────────────┐
│ 백업 관리 > 알림 설정                         │
├─────────────────────────────────────────────┤
│                                              │
│ ✉️ 이메일 알림                               │
│ ───────────────────────────────────────────│
│ ☑ 백업 완료 알림                             │
│ ☑ 백업 실패 알림                             │
│ ☑ 저장소 경고 알림                           │
│ ☑ 저장소 초과 알림                           │
│                                              │
│ 📱 Telegram 알림                             │
│ ───────────────────────────────────────────│
│ ☑ Telegram 활성화                          │
│ 계정: @telegram_username                    │
│ [계정 변경]  [연결 해제]                      │
│                                              │
│ 🔔 인앱 알림                                 │
│ ───────────────────────────────────────────│
│ ☑ 인앱 알림 활성화                           │
│                                              │
│ ✓ 저장                                       │
│                                              │
│ 📝 알림 히스토리                              │
│ ───────────────────────────────────────────│
│ ✅ 2026-05-13 02:15   Backup Completed    │
│ ✅ 2026-05-12 02:10   Backup Completed    │
│ ⚠️ 2026-05-11 18:00   Storage Warning     │
│                                              │
└─────────────────────────────────────────────┘
```

**컴포닌트:**
- `NotificationSettings` — 알림 토글
- `TelegramConnection` — Telegram 연동
- `NotificationHistory` — 알림 로그

---

## 6.5 초기 로드 성능 최적화 (Performance)

### 병렬 데이터 로드 (Promise.all)

Dashboard 진입 시 4개 API를 순차 호출하면 느림. 반드시 Promise.all()을 사용하여 병렬화:

**❌ 피해야 할 코드 (순차 호출 — 느림):**
```javascript
// pages/backup/index.js (X 잘못된 방식)

const policy = await fetch('/api/backup/schedule/configure').then(r => r.json());
const quota = await fetch('/api/backup/quota/status').then(r => r.json());
const metrics = await fetch('/api/backup/metrics/summary').then(r => r.json());
const notifications = await fetch('/api/backup/notifications/list').then(r => r.json());
// 총 소요시간: 800ms + 600ms + 700ms + 500ms = ~2600ms (느림!)
```

**✅ 권장 코드 (병렬 호출 — 빠름):**
```javascript
// pages/backup/index.js (O 권장 방식)

const [policy, quota, metrics, notifications] = await Promise.all([
  fetch('/api/backup/schedule/configure').then(r => r.json()),
  fetch('/api/backup/quota/status').then(r => r.json()),
  fetch('/api/backup/metrics/summary').then(r => r.json()),
  fetch('/api/backup/notifications/list').then(r => r.json())
]);
// 총 소요시간: 약 800ms (병렬 처리로 최대값만 소요)
```

**React 컴포넌트에서 사용:**
```javascript
import { useEffect, useState } from 'react';

export default function BackupDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policyRes, quotaRes, metricsRes, notificationsRes] = await Promise.all([
          fetch('/api/backup/schedule/configure', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/backup/quota/status', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/backup/metrics/summary', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/backup/notifications/list', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const [policy, quota, metrics, notifications] = await Promise.all([
          policyRes.json(),
          quotaRes.json(),
          metricsRes.json(),
          notificationsRes.json()
        ]);

        setData({ policy, quota, metrics, notifications });
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>Error loading data</div>;

  return (
    <div>
      <AutoBackupSettings policy={data.policy} />
      <StorageManagement quota={data.quota} />
      <BackupMetrics metrics={data.metrics} />
      <NotificationSettings notifications={data.notifications} />
    </div>
  );
}
```

### 모바일 반응형 디자인 (Responsive Breakpoints)

```
기본 breakpoint 정의:
┌────────────────────────────────────────┐
│ 모바일 (Mobile)        < 640px          │ 1열 레이아웃
│ 태블릿 (Tablet)  640px ~ 1024px       │ 2열 레이아웃
│ 데스크탑 (Desktop)    > 1024px         │ 3-4열 레이아웃
└────────────────────────────────────────┘
```

**Tailwind CSS 예시:**
```html
<!-- 모바일: 1열, 태블릿: 2열, 데스크탑: 3열 -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <AutoBackupSettings />
  <StorageManagement />
  <BackupMetrics />
</div>
```

### 진행률 바 색상 규약 (Progress Bar Color Scheme)

```
저장소 사용량:
┌─────────────────────────────────────────┐
│ 0% ~ 70%  → 초록색 (Safe)               │ #10b981 (emerald-500)
│ 70% ~ 90% → 주황색 (Warning)            │ #f59e0b (amber-500)
│ 90% ~ 100% → 빨간색 (Danger)            │ #ef4444 (red-500)
└─────────────────────────────────────────┘
```

**React 컴포넌트:**
```javascript
export function StorageProgressBar({ used, max }) {
  const percentage = (used / max) * 100;
  
  const getColor = () => {
    if (percentage < 70) return 'bg-emerald-500';
    if (percentage < 90) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${getColor()}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}
```

---

## 7. API 엔드포인트 추가 사항

### 7.1 자동 백업 관련

```
POST /api/backup/schedule/configure
  요청: { enabled, time, interval, retention_days, max_storage_bytes }
  응답: { success, policy_id, schedule }
  
GET /api/backup/schedule/status
  응답: { is_enabled, next_run_at, last_run_at, last_status }
  
POST /api/backup/schedule/trigger
  설명: 수동 백업 즉시 트리거
  응답: { backup_id, status }
```

### 7.2 저장소 관리 관련

```
GET /api/backup/quota/status
  응답: { used_bytes, max_bytes, percentage, is_warning, is_exceeded }
  
PUT /api/backup/quota/update
  요청: { max_storage_bytes, warning_threshold_percent }
  응답: { success, quota }
  
POST /api/backup/quota/upgrade
  설명: 저장소 할당량 업그레이드
  요청: { new_plan }
  응답: { success, new_quota }
```

### 7.3 모니터링 관련

```
GET /api/backup/metrics/summary
  쿼리: ?days=30&user_id={userId}
  응답: { success_rate, total_backups, failed_backups, total_size_gb, ... }
  
GET /api/backup/metrics/daily
  쿼리: ?start_date=2026-05-01&end_date=2026-05-13
  응답: [{ date, successful, failed, size_bytes }, ...]
  
GET /api/backup/notifications/list
  쿼리: ?limit=50&type=success|failure|quota_warning
  응답: [{ id, type, message, created_at, read_at }, ...]
  
PUT /api/backup/notifications/[id]/read
  응답: { success }
```

### 7.4 정리 작업 관련 (내부)

```
POST /api/backup/cleanup/daily
  설명: 만료된 백업 자동 삭제 (Cron)
  응답: { deleted_count, freed_bytes, errors }
  
POST /api/backup/cleanup/manual
  설명: 특정 백업 수동 삭제
  요청: { backup_ids: [] }
  응답: { deleted_count, success }
```

---

## 8. 컴포넌트 구조 (Component Architecture)

### 8.1 신규 컴포넌트

```
components/
├── BackupApp/
│   ├── AutoBackupSettings.js         # 자동 백업 설정 폼
│   ├── StorageManagement.js          # 저장소 관리 화면
│   ├── BackupMetrics.js              # 통계 대시보드
│   ├── NotificationSettings.js       # 알림 설정
│   ├── StorageUsageBar.js            # 용량 게이지
│   ├── RetentionPolicyForm.js        # 보관 정책 폼
│   ├── BackupMetricsCards.js         # KPI 카드
│   ├── SuccessRateChart.js           # 성공률 그래프
│   ├── NotificationHistory.js        # 알림 로그
│   └── QuotaWarning.js               # 초과 경고
│
└── Common/
    ├── MetricCard.js                 # 지표 카드 (재사용)
    └── ProgressBar.js                # 진행률 바 (재사용)
```

### 8.2 수정 컴포넌트

```
pages/jeepney-personal/backup-app/
├── index.js                         # 메인 페이지 (리팩토링)
│   ├── + AutoBackupSettings 통합
│   ├── + StorageMetrics 표시
│   └── + 탭 네비게이션
│
└── settings.js                      # 새로운 설정 페이지
    ├── AutoBackupSettings
    ├── StorageManagement
    └── NotificationSettings
```

### 8.3 라이브러리 모듈

```
lib/backup/
├── createDailyBackup.js             # 매일 백업 생성
├── cleanupExpired.js                # 만료 백업 삭제
├── storage.js                       # Supabase Storage 연동
├── notifications.js                 # 알림 발송
├── metrics.js                       # 메트릭 수집/계산
└── validation.js                    # 데이터 검증
```

---

## 9. 엣지 케이스 & 에러 처리

### 9.1 데이터 없을 때

```
상황: 아직 백업이 없음
처리:
  - Empty state 메시지 표시: "아직 백업이 없습니다. [지금 백업하기]"
  - 자동 백업 활성화 권장
  - 기본값 표시 (할당량: 10GB, 보관기간: 90일)
```

### 9.2 에러 처리

```
상황: 백업 생성 실패
처리:
  1. API 에러 로그 기록
  2. 사용자에게 토스트 메시지: "백업 생성 실패: {reason}"
  3. Retry 버튼 제공
  4. Admin에게 알림 (fail count > 3)

상황: 저장소 할당량 초과
처리:
  1. 빨간 경고 배너 표시
  2. "저장소 부족" 메시지
  3. 액션:
     - [오래된 백업 삭제]
     - [할당량 증가 요청]
     - [충분할 때까지 자동 백업 일시 중지]

상황: Supabase Storage 연결 불가
처리:
  1. 폴백: DB에만 메타데이터 저장 (status: 'pending_upload')
  2. 재시도 큐: background job
  3. 사용자: "저장소 연결 중입니다..."
```

### 9.3 권한 문제

```
상황: 다른 사용자의 백업 접근 시도
처리:
  1. RLS 정책으로 차단 (DB 레벨)
  2. API: 404 응답 (일관성 유지)
  3. 로그: audit log에 시도 기록
```

### 9.4 동시성 문제

```
상황: 자동 백업 + 수동 백업 동시 실행
처리:
  1. 검증: "이미 진행 중인 백업 있음" 에러
  2. 사용자: 진행중 상태 표시 + 대기 안내
  3. 설정: 사용자당 동시 백업 최대 1개 (DB constraint)
```

### 9.5 타임아웃

```
상황: 백업 생성이 30분 초과
처리:
  1. 자동으로 status='failed'로 변경
  2. 에러 로그 기록
  3. 사용자 알림: "백업 시간초과. 다시 시도하세요."
  4. 관리자: 시스템 상태 확인
```

---

## 10. 테스트 체크리스트 (Phase 2)

### 10.1 DB 마이그레이션 테스트

- [ ] 모든 새 테이블 생성 확인
- [ ] 인덱스 생성 확인
- [ ] RLS 정책 적용 확인
- [ ] 기존 데이터 무결성 검증
- [ ] 외래키 관계 검증

### 10.2 자동 백업 테스트

- [ ] Vercel Cron 트리거 작동
- [ ] 매일 정시에 백업 생성
- [ ] 진행 중 상태 중복 방지
- [ ] 동시 실행 제어 작동
- [ ] 예약 시간 변경 기능

### 10.3 보관 정책 테스트

- [ ] 90일 경과 백업 자동 삭제
- [ ] 할당량 초과 시 오래된 항목부터 삭제
- [ ] 사용자 정책 설정 저장/조회
- [ ] 예외: unlimited 백업은 미삭제

### 10.4 저장소 테스트

- [ ] Supabase Storage 업로드 성공
- [ ] gzip 압축 정상 작동
- [ ] 파일 다운로드 정상 작동
- [ ] 저장소 할당량 정확히 계산
- [ ] 저장 경로 및 URL 생성 정상

### 10.5 알림 테스트

- [ ] 이메일 발송 (성공/실패)
- [ ] Telegram 발송 (설정된 경우)
- [ ] 알림 로그 저장
- [ ] 할당량 경고 정확 표시
- [ ] 초과 경고 정확 표시

### 10.6 메트릭 & 대시보드 테스트

- [ ] 일일 메트릭 정확히 계산
- [ ] 성공률 계산 정확
- [ ] 그래프 렌더링 정상
- [ ] 기간별 조회 (7/30/90일) 작동
- [ ] 페이지 로드 성능 (< 3초)

### 10.7 UI/UX 테스트

- [ ] 자동 백업 설정 화면 렌더링
- [ ] 저장소 관리 화면 렌더링
- [ ] 통계 대시보드 렌더링
- [ ] 알림 설정 화면 렌더링
- [ ] 모든 입력 폼 검증
- [ ] 모바일 반응형 확인

### 10.8 보안 테스트

- [ ] RLS 정책 검증 (다른 사용자 데이터 접근 불가)
- [ ] API 인증 검증 (Bearer token)
- [ ] CSRF 토큰 검증
- [ ] SQL Injection 방지 (Supabase 클라이언트 사용)
- [ ] 민감 정보 로깅 금지 (비밀번호, 토큰 등)

---

## 11. 마이그레이션 체크리스트

### Phase 1 완료 (현재)
- [x] DB 스키마 설계 & 생성
- [x] API CRUD 구현
- [x] 기본 UI (List, Detail Modal)
- [x] RLS 정책

### Phase 2 진행
- [ ] DB 확장 (보관 정책, 할당량, 알림 테이블)
- [ ] 자동 백업 스케줄 구현 (Vercel Cron)
- [ ] 보관 정책 실행 (cleanup cron)
- [ ] 저장소 연동 (Supabase Storage)
- [ ] 알림 시스템 (Email, Telegram)
- [ ] 메트릭 수집 및 대시보드
- [ ] 설정 UI (AutoBackup, Storage, Notifications)
- [ ] 통계 UI (Metrics, Charts)
- [ ] 포괄적 테스트

### Phase 3 (향후)
- [ ] S3 지원 (대용량 백업)
- [ ] Client-side 암호화
- [ ] 변경 이력 추적 (diff 비교)
- [ ] 롤백 그래프 시각화
- [ ] 멀티 테넌트 지원
- [ ] SLA 모니터링

---

## 12. 개발 순서 (Web-Builder 진행 순서)

```
Week 1:
  └─ DB 마이그레이션 (22_backup_module_phase2.sql)
     ├─ 새 테이블 생성
     ├─ RLS 정책 추가
     └─ 인덱스 최적화
  
  └─ API 구현
     ├─ /schedule/configure (자동 백업 설정)
     ├─ /quota/status (할당량 조회)
     ├─ /metrics/summary (통계)
     └─ /notifications/list (알림 목록)
  
  └─ 자동화 스크립트
     ├─ /schedule/daily (매일 자동 백업)
     ├─ /cleanup/daily (만료 백업 삭제)
     └─ /metrics/update-usage (저장소 사용량 업데이트)

Week 2:
  └─ 알림 시스템
     ├─ Email 템플릿 및 발송
     ├─ Telegram 연동
     └─ 알림 로그 기록
  
  └─ UI 컴포넌트
     ├─ AutoBackupSettings
     ├─ StorageManagement
     ├─ BackupMetrics
     └─ NotificationSettings

Week 3:
  └─ 페이지 통합
     ├─ backup-app/index.js 리팩토링
     ├─ backup-app/settings.js 추가
     └─ 탭 네비게이션 구현
  
  └─ 테스트 & 배포
     ├─ Unit 테스트
     ├─ E2E 테스트
     ├─ Staging 배포
     └─ Production 배포
```

---

## 13. 최종 검증 체크리스트

### Go-Live 전 확인사항

- [ ] 모든 API 엔드포인트 테스트 완료
- [ ] DB 마이그레이션 성공 및 검증
- [ ] 자동 백업 Cron 정상 작동 (테스트 실행)
- [ ] 이메일/Telegram 알림 정상 발송
- [ ] UI 모바일 반응형 확인
- [ ] 성능 테스트 (페이지 로드 < 3초)
- [ ] 보안 감시 (RLS, CSRF, SQL Injection)
- [ ] 에러 핸들링 모든 엣지 케이스 확인
- [ ] 문서화 완료 (API Docs, User Guide)
- [ ] 사용자 교육 및 알림

---

**작성:** Planner Agent (Web App Designer)  
**다음 단계:** Web-Builder에 전달 후 Phase 2 개발 시작
