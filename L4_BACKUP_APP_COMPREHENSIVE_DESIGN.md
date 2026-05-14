# L4 데이터 백업 앱 — 종합 설계서

> **상태:** 설계 완료 (구현 준비 단계)  
> **작성일:** 2026-05-13  
> **담당:** 플레너 (Web App Designer)  
> **대상:** 웹개발자 (구현 담당)  
> **범위:** L4 다운로드 + 복원 + 관리 기능  
> **예상 개발 기간:** 2-3주

---

## 📋 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [L3/L4 페이지 구조](#2-l3l4-페이지-구조)
3. [다운로드 기능 설계](#3-다운로드-기능-설계)
4. [복원 기능 설계](#4-복원-기능-설계)
5. [API 엔드포인트 명세](#5-api-엔드포인트-명세)
6. [컴포넌트 아키텍처](#6-컴포넌트-아키텍처)
7. [보안 & 무결성 검증](#7-보안--무결성-검증)
8. [성능 최적화](#8-성능-최적화)
9. [에러 처리 전략](#9-에러-처리-전략)
10. [테스트 시나리오](#10-테스트-시나리오)
11. [마이그레이션 계획](#11-마이그레이션-계획)

---

## 1. 아키텍처 개요

### 1.1 JEEPNEY 내 위치

```
JEEPNEY Portal (/)
│
├── 🏠 Home
├── 📋 개인이력 (L2)
│   ├── Timeline
│   ├── Companies
│   ├── Projects
│   └── Achievements
│
├── 🏭 DSC HUB (기존)
│
└── 💾 백업 관리 (L2) ← NEW
    │
    ├── L3: 백업 관리 허브
    │   ├── 백업 목록 개요
    │   ├── 저장소 상태
    │   └── 최근 활동
    │
    └── L4: 데이터 백업 앱 ← THIS
        ├── 백업 목록 + 상세 보기
        ├── 다운로드 기능
        ├── 복원 기능
        ├── 설정 관리
        └── 통계 대시보드
```

### 1.2 기본 개념

**L3 (Hub):** 백업 관리 네비게이션 + 빠른 현황
- 백업 목록 카드 뷰 (3개 최신)
- 저장소 사용량 게이지
- 빠른 액션 (백업, 설정)

**L4 (상세 앱):** 완전한 백업 관리
- 전체 백업 목록 (페이지네이션)
- 백업 상세 정보 + 메타데이터
- 다운로드 (ZIP 생성 + 스트리밍)
- 복원 (ZIP 업로드 + 검증 + 실행)
- 설정 (자동 백업, 보관 정책, 알림)
- 통계 (성공률, 용량 추이)

### 1.3 데이터 흐름

```
┌─────────────────────────────────────────────────────┐
│  사용자 액션                                         │
└────────────┬────────────────────────────────────────┘
             │
    ┌────────▼──────────┐
    │ 다운로드 요청        │
    └────────┬───────────┘
             │
    ┌────────▼────────────────────────────────┐
    │ GET /api/backup/[id]/download            │
    │ (ZIP 생성 + 메타데이터 검증)              │
    └────────┬─────────────────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ Supabase Storage 읽기      │
    │ (backup_files 순회)        │
    └────────┬───────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ 스트리밍 ZIP 다운로드          │
    │ (메모리 효율, 진행률)          │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────┐
    │ 브라우저 ZIP 저장          │
    └───────────────────────────┘

---

    ┌────────────────────────────────────┐
    │ 복원 요청 (ZIP 업로드)              │
    └────────┬─────────────────────────────┘
             │
    ┌────────▼──────────────────────────┐
    │ POST /api/backup/[id]/restore      │
    │ (ZIP 검증 + 메타데이터 확인)       │
    └────────┬────────────────────────────┘
             │
    ┌────────▼─────────────────────┐
    │ ZIP 무결성 검증               │
    │ (checksum 비교)              │
    └────────┬──────────────────────┘
             │
    ┌────────▼────────────────────────────┐
    │ 덮어쓰기 확인 (사용자)               │
    └────────┬─────────────────────────────┘
             │
    ┌────────▼──────────────────────────┐
    │ 복원 실행                          │
    │ (Supabase Storage에 복원)          │
    └────────┬───────────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ backup 메타데이터 업데이트    │
    │ (status='restored')            │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ 사용자 알림                    │
    │ (Toast + Email)               │
    └───────────────────────────────┘
```

---

## 2. L3/L4 페이지 구조

### 2.1 L3 백업 관리 허브 (/jeepney-personal/backup-management)

**목적:** 백업 상태의 빠른 개요 + 일반적 작업 네비게이션

```
┌───────────────────────────────────────────────────────┐
│ 🔐 백업 관리 (Backup Management Hub)                   │
├───────────────────────────────────────────────────────┤
│                                                        │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 📊 저장소 상태 요약                               │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ [████████░░░░░░░░░░░░░░] 8.4 / 10 GB (84%)      │  │
│ │ 만료 예정: 2개 (5일 후)                          │  │
│ └─────────────────────────────────────────────────┘  │
│                                                        │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 🎯 빠른 액션                                     │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ [💾 지금 백업하기] [⚙️ 설정] [📈 통계]          │  │
│ └─────────────────────────────────────────────────┘  │
│                                                        │
│ 📋 최근 백업 (3개)                                     │
│ ├─────────────────────────────────────────────────┤  │
│ │ ┌──────────────────────────────────────────┐    │  │
│ │ │ 📦 2026-05-13 (자동 백업)    완료        │    │  │
│ │ │ 크기: 1.2 GB | 파일: 245개              │    │  │
│ │ │ [보기] [다운로드] [삭제]                │    │  │
│ │ └──────────────────────────────────────────┘    │  │
│ │                                                    │  │
│ │ ┌──────────────────────────────────────────┐    │  │
│ │ │ 📦 2026-05-12 (자동 백업)    완료        │    │  │
│ │ │ 크기: 1.1 GB | 파일: 240개              │    │  │
│ │ │ [보기] [다운로드] [삭제]                │    │  │
│ │ └──────────────────────────────────────────┘    │  │
│ │                                                    │  │
│ │ ┌──────────────────────────────────────────┐    │  │
│ │ │ 📦 2026-05-11 (자동 백업)    완료        │    │  │
│ │ │ 크기: 1.3 GB | 파일: 250개              │    │  │
│ │ │ [보기] [다운로드] [삭제]                │    │  │
│ │ └──────────────────────────────────────────┘    │  │
│ └─────────────────────────────────────────────────┘  │
│                                                        │
│ [🔗 모든 백업 보기 →]                                │
│                                                        │
├───────────────────────────────────────────────────────┤
│ BottomNav (Personal [활성] | ...)                     │
└───────────────────────────────────────────────────────┘
```

**컴포넌트:**
- `BackupManagementHub` — 메인 컨테이너
- `StorageStatusCard` — 저장소 사용량 게이지
- `QuickActionBar` — 빠른 액션 버튼
- `RecentBackupCards` — 최근 백업 카드 (3개)
- `StorageWarning` — 할당량 경고 (조건부)

**API 호출:**
- `GET /api/backup/list?limit=3` — 최근 3개 백업
- `GET /api/backup/quota/status` — 저장소 상태

---

### 2.2 L4 데이터 백업 앱 메인 (/jeepney-personal/backup-app)

**목적:** 전체 백업 관리 (조회, 다운로드, 복원, 설정)

```
┌────────────────────────────────────────────────────────┐
│ 💾 데이터 백업 앱 (Data Backup Application)             │
├────────────────────────────────────────────────────────┤
│ [📋 목록] [⚙️ 설정] [📈 통계]                         │  ← 탭
├────────────────────────────────────────────────────────┤
│                                                         │
│ 📋 백업 목록 탭                                          │
│ ├────────────────────────────────────────────────────┤ │
│ │ [Search...] [정렬 ▼] [+ 새 백업]                    │ │
│ │                                                      │ │
│ │ ┌──────────────────────────────────────────────┐  │ │
│ │ │ 📦 2026-05-13 (Auto Backup)    ✅ 완료      │  │ │
│ │ │                                              │  │ │
│ │ │ 크기: 1.2 GB | 파일: 245개                  │  │ │
│ │ │ Type: agent_state | Saved: 02:00            │  │ │
│ │ │                                              │  │ │
│ │ │ [👁 상세보기] [⬇ 다운로드] [↩️ 복원] [🗑 삭제]│ │
│ │ └──────────────────────────────────────────────┘  │ │
│ │                                                      │ │
│ │ ┌──────────────────────────────────────────────┐  │ │
│ │ │ 📦 2026-05-12 (Manual Backup)   ✅ 완료     │  │ │
│ │ │ 크기: 1.1 GB | 파일: 240개                  │  │ │
│ │ │ Type: manual | Saved: 15:30                 │  │ │
│ │ │ [👁 상세보기] [⬇ 다운로드] [↩️ 복원] [🗑 삭제]│ │
│ │ └──────────────────────────────────────────────┘  │ │
│ │                                                      │ │
│ │ [이전] [1] [2] [3] [다음]     ← 페이지네이션       │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
├────────────────────────────────────────────────────────┤
│ BottomNav                                               │
└────────────────────────────────────────────────────────┘
```

**탭 콘텐츠:**

#### 2.2.1 탭 1: 백업 목록 (List Tab)

**뷰:**
- 검색 바 (이름, 날짜)
- 정렬 옵션 (최신순, 크기순, 상태순)
- 백업 카드 목록
- 페이지네이션 (10개/페이지)

**백업 카드 필드:**
- 이름 + 상태 배지 (✅ 완료 / ⏳ 진행중 / ❌ 실패)
- 크기 + 파일 수
- 백업 타입 + 생성 시간
- 액션 버튼: 상세보기, 다운로드, 복원, 삭제

---

#### 2.2.2 탭 2: 설정 (Settings Tab)

```
┌────────────────────────────────────────────────────────┐
│ ⚙️ 설정                                                  │
├────────────────────────────────────────────────────────┤
│                                                         │
│ 🔄 자동 백업                                             │
│ ├────────────────────────────────────────────────────┤ │
│ │ [☑] 자동 백업 활성화                                │ │
│ │                                                      │ │
│ │ 시간: [02:00] (한국 표준시 GMT+9)                 │ │
│ │ 간격: [매일]                                        │ │
│ │                                                      │ │
│ │ [✓ 저장]                                            │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ 💾 보관 정책                                             │
│ ├────────────────────────────────────────────────────┤ │
│ │ 보관 기간: [90일]                                   │ │
│ │ 할당량: [10 GB]                                     │ │
│ │ 경고 임계값: [80%]                                  │ │
│ │ [☑] 자동 삭제 활성화                                │ │
│ │                                                      │ │
│ │ [✓ 저장]                                            │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ 🔔 알림 설정                                             │
│ ├────────────────────────────────────────────────────┤ │
│ │ [☑] 이메일 알림                                     │ │
│ │ [☑] Telegram 알림                                  │ │
│ │ [☑] 인앱 알림                                       │ │
│ │                                                      │ │
│ │ [✓ 저장]                                            │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**설정 항목:**
- **자동 백업:** 활성화, 시간, 간격
- **보관 정책:** 보관 기간, 할당량, 임계값, 자동 삭제
- **알림:** 이메일, Telegram, 인앱

---

#### 2.2.3 탭 3: 통계 (Statistics Tab)

```
┌────────────────────────────────────────────────────────┐
│ 📈 통계                                                  │
├────────────────────────────────────────────────────────┤
│                                                         │
│ [7일] [30일] [90일] ← 기간 선택                         │
│                                                         │
│ ┌───────────────┐  ┌────────────────┐                 │
│ │ 성공률        │  │ 전체 백업      │                 │
│ │ ✅ 98%       │  │ 📦 28개       │                 │
│ └───────────────┘  └────────────────┘                 │
│                                                         │
│ ┌───────────────┐  ┌────────────────┐                 │
│ │ 실패          │  │ 저장 용량      │                 │
│ │ ❌ 0개       │  │ 💾 8.4 GB     │                 │
│ └───────────────┘  └────────────────┘                 │
│                                                         │
│ 📊 성공률 추이 (30일)                                   │
│ ├────────────────────────────────────────────────────┤ │
│ │ 100%┤        ┌─                                     │ │
│ │  90%┤  ┌─┐  ┌┘ └─┐                                │ │
│ │  80%┤  │ │  │   │                                │ │
│ │     └──┴─┴──┴───┴─ 날짜                           │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**통계 항목:**
- KPI 카드: 성공률, 전체 백업 수, 실패 수, 저장 용량
- 추이 그래프: 성공률 변화 (선형 또는 막대)
- 기간 선택: 7일, 30일, 90일

---

### 2.3 상세 보기 모달 (Detail Modal)

**트리거:** 백업 카드의 "상세보기" 버튼 클릭

```
┌────────────────────────────────────────────────────────┐
│ 백업 상세 정보                              [×]         │
├────────────────────────────────────────────────────────┤
│                                                         │
│ 기본 정보                                                │
│ ├────────────────────────────────────────────────────┤ │
│ │ 이름:        2026-05-13 (Auto Backup)             │ │
│ │ ID:          550e8400-e29b-41d4-a716-446655440000│ │
│ │ 상태:        ✅ 완료                               │ │
│ │ 크기:        1.2 GB                               │ │
│ │ 파일 수:     245개                                 │ │
│ │ 유형:        agent_state                          │ │
│ │ 생성 시간:   2026-05-13 02:00:15 KST              │ │
│ │ 완료 시간:   2026-05-13 02:05:42 KST              │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ 저장소 경로                                              │
│ ├────────────────────────────────────────────────────┤ │
│ │ backups/user-123/550e8400.../                     │ │
│ │ (Supabase Storage)                                │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ 메타데이터                                               │
│ ├────────────────────────────────────────────────────┤ │
│ │ Agent List: [agent-1, agent-2, ...]              │ │
│ │ Environment: production                           │ │
│ │ Tags: [daily, auto, production]                   │ │
│ │ Trigger: automated_schedule                       │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ 파일 목록 (처음 10개 표시)                              │
│ ├────────────────────────────────────────────────────┤ │
│ │ 📄 agents/agent-1.json           (45 KB)          │ │
│ │ 📄 agents/agent-2.json           (38 KB)          │ │
│ │ 📄 configs/env.json              (12 KB)          │ │
│ │ ... (나머지 242개 파일)                            │ │
│ │                                                      │ │
│ │ [📋 모든 파일 보기]                                 │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ 사용자 노트                                              │
│ ├────────────────────────────────────────────────────┤ │
│ │ "Production 배포 전 백업"                          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ├────────────────────────────────────────────────────┤ │
│ │ [⬇ 다운로드] [↩️ 복원] [🗑 삭제] [닫기]            │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**컴포넌트:**
- `BackupDetailHeader` — 제목 + 상태
- `BackupInfoSection` — 기본 정보 테이블
- `FileListSection` — 파일 목록
- `NotesSection` — 사용자 노트
- `ActionButtons` — 다운로드, 복원, 삭제

---

## 3. 다운로드 기능 설계

### 3.1 사용자 흐름

```
1. 사용자가 백업 상세 모달에서 "⬇ 다운로드" 클릭
   ↓
2. 클라이언트: 확인 메시지 표시
   "ZIP 파일 생성 중... (이 작업은 1-2분 소요될 수 있습니다)"
   ↓
3. 클라이언트: POST /api/backup/[id]/download 호출
   ↓
4. 서버: 
   a) 백업 소유권 검증 (RLS)
   b) backup_files 조회
   c) 체크섬 검증
   d) ZIP 생성 (메모리 효율)
   e) 스트리밍 시작
   ↓
5. 클라이언트: 
   a) 다운로드 진행률 표시
   b) 파일명: backup_{id}_{date}.zip
   c) 완료 시 저장
   ↓
6. 사용자: ZIP 파일 수신 (브라우저 다운로드 폴더)
```

### 3.2 ZIP 생성 방식

**목표:** 메모리 효율, 스트림 처리, 진행률 표시

**구현 방식:**

```javascript
// pages/api/backup/[id]/download.js

import { createReadStream, createWriteStream } from 'fs';
import archiver from 'archiver';
import { pipeline } from 'stream/promises';

export default async function handler(req, res) {
  const { id } = req.query;
  const user = await auth.getUser(req); // Bearer token
  
  // 1. 권한 검증
  const backup = await supabaseAdmin
    .from('backups')
    .select('id, user_id, name, created_at, size_bytes')
    .eq('id', id)
    .eq('user_id', user.id)  // RLS 강제
    .single();
  
  if (!backup.data) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  
  // 2. 파일 목록 조회
  const files = await supabaseAdmin
    .from('backup_files')
    .select('id, file_path, file_size, checksum')
    .eq('backup_id', id)
    .order('file_path', { ascending: true });
  
  // 3. ZIP 헤더 설정
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="backup_${id}_${backup.data.created_at.split('T')[0]}.zip"`
  );
  res.setHeader('Transfer-Encoding', 'chunked');
  
  // 4. ZIP 생성 및 스트리밍
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  archive.on('error', (err) => {
    console.error('Archiver error:', err);
    res.status(500).json({ error: 'ZIP generation failed' });
  });
  
  archive.pipe(res);
  
  // 5. 파일 추가
  for (const file of files.data) {
    try {
      // Supabase Storage에서 다운로드
      const { data, error } = await supabase.storage
        .from('backups')
        .download(`backups/${user.id}/${id}/${file.file_path}`);
      
      if (error) throw error;
      
      // ZIP에 추가
      archive.append(data, { 
        name: file.file_path,
        comment: `Checksum: ${file.checksum}` 
      });
      
    } catch (error) {
      console.error(`Failed to add ${file.file_path}:`, error);
      // 실패한 파일 로깅, 계속 진행
    }
  }
  
  // 6. 메타데이터 파일 추가
  const metadata = {
    backup_id: backup.data.id,
    name: backup.data.name,
    created_at: backup.data.created_at,
    file_count: files.data.length,
    total_size: backup.data.size_bytes,
    manifest: files.data.map(f => ({
      path: f.file_path,
      size: f.file_size,
      checksum: f.checksum
    }))
  };
  
  archive.append(JSON.stringify(metadata, null, 2), {
    name: 'backup_manifest.json'
  });
  
  await archive.finalize();
}
```

### 3.3 진행률 표시 (선택)

**고급 기능:** 클라이언트에서 진행률 실시간 표시

```javascript
// components/backup/BackupDownloadButton.js

export function BackupDownloadButton({ backupId }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleDownload = async () => {
    setIsDownloading(true);
    setProgress(0);
    
    try {
      const response = await fetch(`/api/backup/${backupId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const contentLength = response.headers.get('content-length');
      const reader = response.body.getReader();
      
      let receivedLength = 0;
      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // 진행률 계산
        if (contentLength) {
          const percentage = (receivedLength / parseInt(contentLength)) * 100;
          setProgress(Math.round(percentage));
        }
      }
      
      // ZIP 파일 저장
      const blob = new Blob(chunks, { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${backupId}.zip`;
      a.click();
      
      showToast('다운로드 완료', 'success');
    } catch (error) {
      showToast(`다운로드 실패: ${error.message}`, 'error');
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };
  
  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="btn btn-primary"
      >
        {isDownloading ? `다운로드 중... ${progress}%` : '⬇ 다운로드'}
      </button>
      {isDownloading && (
        <ProgressBar value={progress} max={100} />
      )}
    </div>
  );
}
```

### 3.4 체크섬 검증

**목표:** 다운로드된 ZIP 무결성 검증

```javascript
// lib/backup/validateDownload.js

import crypto from 'crypto';

export async function validateBackupZip(zipFile, manifest) {
  // 1. ZIP 파일의 전체 해시 계산
  const zipHash = await calculateFileHash(zipFile);
  
  // 2. 메타데이터의 개별 파일 체크섬과 비교
  for (const file of manifest.manifest) {
    const fileEntry = await getZipEntry(zipFile, file.path);
    const fileHash = await calculateHash(fileEntry);
    
    if (fileHash !== file.checksum) {
      throw new Error(`Checksum mismatch: ${file.path}`);
    }
  }
  
  return { valid: true, fileCount: manifest.manifest.length };
}

async function calculateHash(data) {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}
```

**클라이언트 검증 (선택):**
```javascript
// 다운로드 후 체크섬 검증 UI
<BackupIntegrityChecker 
  zipFile={downloadedFile}
  manifest={backupManifest}
/>
```

---

## 4. 복원 기능 설계

### 4.1 사용자 흐름

```
1. 사용자가 백업 상세 모달에서 "↩️ 복원" 클릭
   ↓
2. 확인 다이얼로그 표시:
   "이 백업으로 복원하시겠습니까?"
   "현재 데이터가 덮어쓰기됩니다."
   [취소] [계속]
   ↓
3. 사용자 "계속" 선택
   ↓
4. 복원 방식 선택:
   a) "ZIP 파일에서 복원" (업로드 선택)
   b) "이 백업에서 직접 복원"
   ↓
5. (선택지 a) ZIP 업로드 폼 표시
   - 파일 드래그 & 드롭
   - 또는 파일 선택
   ↓
6. 서버:
   a) ZIP 무결성 검증 (메타데이터 확인)
   b) 메니페스트 비교 (현재 vs 백업)
   c) 복원 전 스냅샷 생성 (롤백 가능)
   d) 파일 복원 (Supabase Storage)
   e) backup 레코드 업데이트 (status='restored')
   ↓
7. 사용자 알림:
   "✅ 복원 완료"
   "복원된 파일: 245개"
   ↓
8. 페이지 새로고침 또는 리다이렉트
```

### 4.2 ZIP 업로드 폼

**UI:**

```
┌────────────────────────────────────────────┐
│ 백업 복원                            [×]    │
├────────────────────────────────────────────┤
│                                            │
│ 복원 방법 선택:                             │
│ ○ 현재 백업에서 직접 복원                  │
│ ● ZIP 파일 업로드 (고급)                  │
│                                            │
│ ┌──────────────────────────────────────┐  │
│ │ 📁 ZIP 파일 선택                     │  │
│ │                                      │  │
│ │ [파일 선택] 또는 드래그 & 드롭       │  │
│ │                                      │  │
│ │ 선택된 파일: backup_550e8400.zip    │  │
│ │ 크기: 1.2 GB | 파일 수: 245개      │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ 복원 옵션:                                  │
│ [☑] 덮어쓰기 경고 표시                     │
│ [☐] 기존 파일 백업 생성                    │
│                                            │
│ ⚠️ 주의:                                   │
│ 현재 데이터가 모두 덮어쓰기됩니다.         │
│                                            │
│ [취소] [↩️ 복원]                          │
└────────────────────────────────────────────┘
```

**컴포넌트:**
- `RestoreMethodSelect` — 복원 방법 선택 라디오
- `FileUploadZone` — 드래그 & 드롭 + 파일 선택
- `RestoreOptions` — 옵션 체크박스
- `ConfirmationWarning` — 경고 배너

### 4.3 ZIP 파일 검증 및 복원 로직

```javascript
// pages/api/backup/[id]/restore.js

export default async function handler(req, res) {
  const { id, method } = req.query;
  const user = await auth.getUser(req);
  
  if (req.method === 'POST') {
    // 1. 권한 검증
    const backup = await supabaseAdmin
      .from('backups')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (!backup.data) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    try {
      let filesToRestore = [];
      let metadata = null;
      
      if (method === 'upload') {
        // 2a. ZIP 파일 업로드된 경우: 검증
        const { zipBuffer, manifest } = await parseUploadedZip(req);
        
        // 메타데이터 검증
        if (!manifest || !manifest.backup_id) {
          return res.status(400).json({ 
            error: 'Invalid backup ZIP: missing manifest' 
          });
        }
        
        // 체크섬 검증
        for (const file of manifest.manifest) {
          const fileData = await extractZipEntry(zipBuffer, file.path);
          const hash = await calculateHash(fileData);
          
          if (hash !== file.checksum) {
            return res.status(400).json({ 
              error: `File corrupted: ${file.path}` 
            });
          }
        }
        
        filesToRestore = manifest.manifest;
        metadata = manifest;
        
      } else if (method === 'direct') {
        // 2b. 직접 복원: backup_files 사용
        const files = await supabaseAdmin
          .from('backup_files')
          .select('*')
          .eq('backup_id', id);
        
        filesToRestore = files.data;
      }
      
      // 3. 복원 전 스냅샷 (선택)
      if (req.body.createSnapshot) {
        await createRestoreSnapshot(user.id, backup.data);
      }
      
      // 4. 파일 복원 (Supabase Storage)
      const restoreResults = [];
      
      for (const file of filesToRestore) {
        try {
          let fileContent;
          
          if (method === 'upload') {
            fileContent = await extractZipEntry(zipBuffer, file.path);
          } else {
            fileContent = await supabase.storage
              .from('backups')
              .download(`backups/${user.id}/${id}/${file.file_path}`);
          }
          
          // 기존 파일 덮어쓰기
          await supabase.storage
            .from('backups')
            .upload(`backups/${user.id}/${backup.data.id}/${file.file_path}`, 
              fileContent,
              { upsert: true }
            );
          
          restoreResults.push({
            path: file.file_path,
            status: 'success'
          });
          
        } catch (error) {
          restoreResults.push({
            path: file.file_path,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // 5. 복원 완료: backup 레코드 업데이트
      await supabaseAdmin
        .from('backups')
        .update({
          status: 'restored',
          notes: `Restored at ${new Date().toISOString()}`,
          metadata: {
            ...backup.data.metadata,
            restored_from: method,
            restored_at: new Date().toISOString(),
          }
        })
        .eq('id', id);
      
      // 6. 알림 발송
      await notifyRestoreCompletion(user.id, backup.data, restoreResults);
      
      return res.status(200).json({
        success: true,
        restored_count: restoreResults.filter(r => r.status === 'success').length,
        failed_count: restoreResults.filter(r => r.status === 'failed').length,
        details: restoreResults
      });
      
    } catch (error) {
      console.error('Restore failed:', error);
      
      // 실패 로그
      await supabaseAdmin
        .from('backups')
        .update({
          status: 'restore_failed',
          notes: `Restore failed: ${error.message}`
        })
        .eq('id', id);
      
      return res.status(500).json({ 
        error: 'Restore failed', 
        details: error.message 
      });
    }
  }
}
```

### 4.4 복원 결과 표시

**성공 케이스:**

```
┌────────────────────────────────────────┐
│ ✅ 복원 완료                            │
├────────────────────────────────────────┤
│                                         │
│ 복원된 파일: 245개                       │
│ 실패한 파일: 0개                        │
│                                         │
│ 메시지:                                 │
│ "백업이 성공적으로 복원되었습니다."     │
│                                         │
│ [👁 상세 보기] [닫기]                  │
└────────────────────────────────────────┘
```

**부분 실패 케이스:**

```
┌────────────────────────────────────────┐
│ ⚠️ 복원 부분 완료                      │
├────────────────────────────────────────┤
│                                         │
│ 복원된 파일: 240개                       │
│ 실패한 파일: 5개                        │
│                                         │
│ 실패 목록:                              │
│ • configs/old-env.json                 │
│ • logs/archive-2024.log                │
│ ...                                     │
│                                         │
│ [📋 상세 로그 다운로드] [닫기]          │
└────────────────────────────────────────┘
```

---

## 5. API 엔드포인트 명세

### 5.1 다운로드 API

**엔드포인트:** `GET /api/backup/[id]/download`

**인증:** Bearer token (Authorization 헤더)

**응답:**
- Content-Type: `application/zip`
- Content-Disposition: `attachment; filename="backup_{id}_{date}.zip"`
- 스트리밍 바이너리 데이터

**내부 처리:**
1. 백업 소유권 검증
2. backup_files 조회
3. 체크섬 검증
4. ZIP 생성 (archiver)
5. 메타데이터 포함 (backup_manifest.json)
6. 스트리밍 응답

**에러 응답:**
- 404: Backup not found
- 401: Unauthorized
- 500: ZIP generation failed

**예제:**
```bash
curl -X GET "https://dsc-fms-portal.vercel.app/api/backup/550e8400/download" \
  -H "Authorization: Bearer ${token}" \
  -o backup_550e8400_2026-05-13.zip
```

---

### 5.2 복원 API

**엔드포인트:** `POST /api/backup/[id]/restore`

**인증:** Bearer token

**쿼리 파라미터:**
- `method` — "upload" | "direct" (기본값: "direct")

**요청 본문 (multipart/form-data):**
```json
{
  "zipFile": "<binary ZIP file>",  // method=upload일 때만
  "createSnapshot": true            // 선택
}
```

**응답:**
```json
{
  "success": true,
  "restored_count": 245,
  "failed_count": 0,
  "details": [
    { "path": "agents/agent-1.json", "status": "success" },
    { "path": "agents/agent-2.json", "status": "success" }
  ]
}
```

**에러 응답:**
```json
{
  "error": "Invalid backup ZIP: missing manifest"
}
```

**내부 처리:**
1. 백업 소유권 검증
2. ZIP 검증 (메타데이터, 체크섬)
3. 파일 복원 (Supabase Storage)
4. backup 레코드 업데이트
5. 알림 발송

---

### 5.3 검증 API

**엔드포인트:** `POST /api/backup/[id]/validate`

**목적:** 백업 무결성 사전 검증

**요청:**
```json
{
  "zipFile": "<binary ZIP file>"
}
```

**응답:**
```json
{
  "valid": true,
  "file_count": 245,
  "total_size": 1258291200,
  "errors": []
}
```

**검증 항목:**
- 메타데이터 존재 확인
- 파일 체크섬 검증
- 파일 경로 유효성 검증
- ZIP 구조 검증

---

### 5.4 기존 API 확장

#### 목록 API (GET /api/backup/list)

**새로운 쿼리 파라미터:**
```
?limit=10&offset=0&sort=date_desc&status=completed&search=auto
```

**응답에 추가될 필드:**
```json
{
  "id": "uuid",
  "name": "Auto Backup 2026-05-13",
  "can_download": true,
  "can_restore": true,
  "download_size_bytes": 1258291200,
  ...
}
```

#### 상세 API (GET /api/backup/[id])

**응답에 추가될 필드:**
```json
{
  ...
  "files": [
    {
      "path": "agents/agent-1.json",
      "size": 45056,
      "checksum": "sha256-...",
      "type": "json"
    }
  ],
  "can_download": true,
  "can_restore": true
}
```

---

## 6. 컴포넌트 아키텍처

### 6.1 신규 컴포넌트 목록

```
components/backup/
├── BackupManagementHub.js          # L3 메인 페이지
├── BackupListTab.js                # L4 탭 1: 목록
├── BackupSettingsTab.js            # L4 탭 2: 설정
├── BackupStatisticsTab.js          # L4 탭 3: 통계
├── BackupDetailModal.js            # 상세 정보 모달 (기존, 확장)
├── 
├── Download/
│   ├── BackupDownloadButton.js    # 다운로드 버튼 + 진행률
│   ├── DownloadProgressModal.js   # 진행률 표시
│   └── IntegrityChecker.js        # 체크섬 검증
├── 
├── Restore/
│   ├── RestoreButton.js            # 복원 버튼
│   ├── RestoreModal.js             # 복원 모달
│   ├── FileUploadZone.js           # 파일 업로드 (드래그 & 드롭)
│   ├── RestoreConfirmation.js      # 확인 다이얼로그
│   └── RestoreResultModal.js       # 복원 결과
├── 
├── Settings/
│   ├── AutoBackupSettings.js       # 자동 백업 설정
│   ├── RetentionPolicyForm.js      # 보관 정책
│   └── NotificationSettings.js     # 알림 설정
├── 
└── Statistics/
    ├── MetricsCards.js             # KPI 카드
    ├── SuccessRateChart.js         # 성공률 그래프
    └── StorageBreakdown.js         # 저장소 사용량
```

### 6.2 상세 컴포넌트 명세

#### 1. BackupDownloadButton

**Props:**
```typescript
interface BackupDownloadButtonProps {
  backupId: string;
  backupName: string;
  size_bytes: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}
```

**상태:**
- idle: 초기 상태
- downloading: 다운로드 중 (진행률 표시)
- success: 완료
- error: 실패

**이벤트:**
- onClick: 다운로드 시작
- onProgress: 진행률 업데이트
- onComplete: 완료

---

#### 2. RestoreModal

**Props:**
```typescript
interface RestoreModalProps {
  isOpen: boolean;
  backupId: string;
  onClose: () => void;
  onRestoreComplete?: () => void;
}
```

**상태 머신:**
```
초기 → 방법선택 → (ZIP업로드 OR 직접복원)
                  ↓
            검증 중
            ↓ (성공)
            확인 다이얼로그
            ↓
            복원 중 (진행률)
            ↓
            결과 표시
```

---

#### 3. FileUploadZone

**Features:**
- 드래그 & 드롭
- 파일 선택 클릭
- 파일 크기 검증
- 파일 타입 검증 (.zip)
- 실시간 검증 피드백

---

### 6.3 페이지 구조

```
pages/jeepney-personal/backup-management/
├── index.js                    # L3 허브
└── [page].js                   # 동적 (미래 확장)

pages/jeepney-personal/backup-app/
├── index.js                    # L4 메인 (탭 1,2,3)
├── [id]/                       # 동적 상세 (미래)
│   └── index.js
└── api/
    ├── download/[id].js        # POST /api/backup/[id]/download
    ├── restore/[id].js         # POST /api/backup/[id]/restore
    └── validate/[id].js        # POST /api/backup/[id]/validate
```

---

## 7. 보안 & 무결성 검증

### 7.1 RLS (Row-Level Security) 강제

**정책:**
```sql
-- users cannot access other users' backups
CREATE POLICY "users_read_own_backups" ON backups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_backups" ON backups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_backups" ON backups
  FOR DELETE USING (auth.uid() = user_id);

-- backup_files inherit from backups via cascade
```

**API 레벨 강제:**
```javascript
// 모든 API에서
const backup = await supabaseAdmin
  .from('backups')
  .select('*')
  .eq('id', backupId)
  .eq('user_id', user.id)  // ← 필수
  .single();

if (!backup.data) return res.status(404).json({ error: 'Not found' });
```

---

### 7.2 파일 무결성 검증

**체크섬 방식:**
- 알고리즘: SHA-256
- 저장 위치: backup_files.checksum
- 검증 시점: 
  1. 업로드 시 (ZIP 검증)
  2. 다운로드 시 (ZIP 메니페스트 포함)
  3. 복원 시 (파일별 확인)

**메니페스트 (backup_manifest.json):**
```json
{
  "backup_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Auto Backup 2026-05-13",
  "created_at": "2026-05-13T02:00:15Z",
  "file_count": 245,
  "total_size": 1258291200,
  "manifest": [
    {
      "path": "agents/agent-1.json",
      "size": 45056,
      "checksum": "sha256-abc123..."
    },
    ...
  ]
}
```

---

### 7.3 ZIP 파일 검증

**검증 체크리스트:**

| 항목 | 검증 방법 | 실패 시 처리 |
|-----|---------|-----------|
| 메타데이터 존재 | backup_manifest.json 필수 | 400 에러 반환 |
| 파일 체크섬 | SHA-256 비교 | 파일 건너뛰기 + 로깅 |
| 파일 경로 | ../.. 방지 (보안) | 경로 거부 |
| ZIP 구조 | 손상 여부 확인 | 전체 복원 실패 |
| 크기 제한 | 최대 50GB | 업로드 거부 |

---

### 7.4 토큰 & 인증

**Bearer Token 검증:**
```javascript
async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Missing authorization token');
  }
  
  const { data, error } = await supabaseAdmin.auth
    .getUser(token);
  
  if (error || !data) {
    throw new Error('Invalid token');
  }
  
  return data.user;
}
```

---

## 8. 성능 최적화

### 8.1 스트리밍 다운로드

**문제:** 큰 백업을 메모리에 모두 로드하면 서버 부하 증가

**해결:** 스트림 기반 처리
```javascript
const archive = archiver('zip', { zlib: { level: 9 } });
archive.pipe(res);  // 메모리에 버퍼링하지 않음

// 파일 추가할 때도 스트림 사용
archive.append(readStream, { name: filename });
```

**효과:**
- 메모리 사용: O(1) (상수)
- 다운로드 시간: 파일 크기에 선형
- 동시 다운로드: 여러 사용자 지원

---

### 8.2 청킹된 업로드

**문제:** 큰 ZIP 파일 업로드 시 타임아웃 또는 메모리 초과

**해결:** 분할 업로드 (선택)
```javascript
// 클라이언트: 10MB 청크로 분할
const chunkSize = 10 * 1024 * 1024;
for (let i = 0; i < file.size; i += chunkSize) {
  const chunk = file.slice(i, i + chunkSize);
  await uploadChunk(chunk, i / chunkSize);
}

// 서버: 청크 병합
const mergedBuffer = Buffer.concat(chunks);
```

**제약:**
- Vercel 함수 타임아웃: 30초 (Pro)
- 최대 바디 크기: 50MB
→ 청크 방식 권장 (대용량 백업용)

---

### 8.3 캐싱 전략

**CDN 캐싱 (다운로드):**
- ZIP 파일: 예상 불가능 → 캐시 안 함
- 메타데이터: 자주 변경 → 캐시 최소화

**데이터베이스 캐싱:**
- backup 목록: 5분 (사용자당 자주 조회)
- 메트릭 통계: 1시간 (집계 비용 높음)

---

## 9. 에러 처리 전략

### 9.1 백업 단계별 에러

| 단계 | 에러 | 처리 방법 | 사용자 메시지 |
|-----|------|---------|-------------|
| **다운로드** | ZIP 생성 실패 | 로깅 + 재시도 | "생성 실패, 다시 시도하세요" |
| | 파일 읽기 실패 | 파일 건너뛰기 | "일부 파일 누락" |
| | 타임아웃 (30초 초과) | 자동 중단 | "다운로드 시간 초과" |
| **복원** | ZIP 검증 실패 | 거부 + 에러 로깅 | "잘못된 백업 파일" |
| | 체크섬 불일치 | 개별 파일 거부 | "파일 손상: {경로}" |
| | 저장 실패 | 롤백 (스냅샷) | "복원 실패, 롤백됨" |

### 9.2 UI 에러 표현

**Toast 메시지:**
```javascript
// 성공
showToast('다운로드 완료', 'success');

// 경고
showToast('일부 파일 실패 (5개)', 'warning');

// 에러
showToast('다운로드 실패: 네트워크 오류', 'error');

// 정보
showToast('다운로드 중... 1/100', 'info');
```

**모달 에러:**
```jsx
<ErrorModal
  title="복원 실패"
  message="ZIP 파일이 손상되었습니다"
  details={[
    "체크섬 불일치: agents/agent-1.json",
    "유효하지 않은 경로: ../config.json"
  ]}
  action={[
    { label: '다시 시도', onClick: retry },
    { label: '닫기', onClick: close }
  ]}
/>
```

### 9.3 데이터 없을 때

```
상황: 아직 백업이 없음
UI:
  - 빈 상태 메시지
  - 아이콘: 📦
  - 텍스트: "아직 백업이 없습니다"
  - 액션: [지금 백업하기] 버튼
```

---

## 10. 테스트 시나리오

### 10.1 다운로드 테스트

```
시나리오 1: 정상 다운로드
├─ Given: 완료된 백업 존재
├─ When: 다운로드 버튼 클릭
├─ Then:
│  ├─ ZIP 파일 생성됨
│  ├─ 메타데이터 포함됨
│  ├─ 진행률 표시됨 (선택)
│  └─ 브라우저 다운로드 시작

시나리오 2: 큰 백업 다운로드
├─ Given: 10GB 이상 백업
├─ When: 다운로드 시작
├─ Then:
│  ├─ 메모리 사용량 일정 유지
│  ├─ 타임아웃 없음
│  └─ 5분 이내 완료

시나리오 3: 다운로드 실패 처리
├─ Given: 네트워크 오류 발생
├─ When: 다운로드 진행 중 중단
├─ Then:
│  ├─ 에러 메시지 표시
│  ├─ 재시도 옵션 제공
│  └─ 부분 다운로드 안내
```

### 10.2 복원 테스트

```
시나리오 1: 정상 복원
├─ Given: 유효한 ZIP 파일
├─ When: 파일 업로드 + 복원 클릭
├─ Then:
│  ├─ ZIP 검증 성공
│  ├─ 확인 다이얼로그 표시
│  ├─ 복원 실행
│  ├─ 진행률 표시
│  └─ 완료 알림

시나리오 2: 손상된 ZIP 복원 시도
├─ Given: 체크섬 불일치 파일
├─ When: 파일 업로드
├─ Then:
│  ├─ 검증 실패 에러
│  ├─ 상세 에러 메시지
│  └─ 복원 거부

시나리오 3: 부분 실패 복원
├─ Given: 일부 파일만 손상
├─ When: 복원 실행
├─ Then:
│  ├─ 정상 파일만 복원
│  ├─ 손상 파일 목록 표시
│  └─ 부분 성공 알림
```

### 10.3 권한 테스트

```
시나리오 1: 다른 사용자의 백업 접근
├─ When: /api/backup/{other_user_id}/download 호출
├─ Then: 404 또는 403 응답

시나리오 2: 토큰 없이 접근
├─ When: Authorization 헤더 없이 호출
├─ Then: 401 응답

시나리오 3: 만료된 토큰
├─ When: 유효기간 초과 토큰으로 호출
├─ Then: 401 응답
```

### 10.4 성능 테스트

| 테스트 | 목표 | 측정 도구 |
|-------|-----|---------|
| 다운로드 (1GB) | < 5분 | 시계 + 로깅 |
| 복원 (1GB) | < 10분 | 시계 + 로깅 |
| 페이지 로드 | < 2초 | Lighthouse |
| 메모리 사용 | < 200MB | Node.js profiler |

---

## 11. 마이그레이션 계획

### 11.1 DB 스키마 변경 (필요시)

```sql
-- 기존 backup_files 확장
ALTER TABLE backup_files ADD COLUMN IF NOT EXISTS
  compression_ratio DECIMAL DEFAULT 1.0,
  original_size_bytes BIGINT,
  download_count INT DEFAULT 0;

-- 다운로드 이벤트 로그
CREATE TABLE IF NOT EXISTS backup_download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  backup_id UUID REFERENCES backups(id),
  status TEXT CHECK (status IN ('success', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  file_size_bytes BIGINT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 복원 이벤트 로그
CREATE TABLE IF NOT EXISTS backup_restore_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  backup_id UUID REFERENCES backups(id),
  method TEXT CHECK (method IN ('direct', 'upload')),
  status TEXT CHECK (status IN ('in_progress', 'success', 'partial', 'failed')),
  file_count INT,
  failed_count INT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_download_logs_user_date 
  ON backup_download_logs(user_id, created_at DESC);

CREATE INDEX idx_restore_logs_user_date 
  ON backup_restore_logs(user_id, created_at DESC);
```

### 11.2 배포 순서

1. **Phase 1 검증** (이미 완료)
   - 기본 백업 CRUD ✅
   - 목록 보기 ✅
   - 상세 모달 ✅

2. **Phase 2 다운로드 (1주)**
   - API: GET /api/backup/[id]/download
   - UI: 다운로드 버튼
   - 테스트 + 배포

3. **Phase 2 복원 (1.5주)**
   - API: POST /api/backup/[id]/restore
   - API: POST /api/backup/[id]/validate
   - UI: 복원 모달 + 파일 업로드
   - 테스트 + 배포

4. **L3 허브 (0.5주)**
   - BackupManagementHub 페이지
   - 저장소 상태 위젯
   - 빠른 액션 바

5. **설정 + 통계 (1주, 향후)**
   - 탭 2, 3 구현
   - Cron 자동화
   - 메트릭 수집

---

## 최종 체크리스트

### 설계 검수 (이 문서)
- [x] 아키텍처 정의
- [x] 페이지 구조 설계
- [x] 컴포넌트 명세
- [x] API 엔드포인트 정의
- [x] 보안 전략
- [x] 에러 처리 전략

### 개발 검수 (웹개발자)
- [ ] API 구현 및 테스트
- [ ] UI 컴포넌트 구현
- [ ] RLS 정책 설정
- [ ] 권한 검증
- [ ] 에러 처리
- [ ] 모바일 반응형

### 품질 검수 (평가자)
- [ ] 기능 테스트
- [ ] 보안 테스트 (RLS, CSRF)
- [ ] 성능 테스트 (로드 타임)
- [ ] 접근성 테스트 (axe)
- [ ] 통합 테스트 (E2E)
- [ ] 최종 승인

---

**문서 버전:** 1.0  
**작성일:** 2026-05-13  
**담당:** 플레너 (Web App Designer)  
**다음 단계:** 웹개발자 착수 → L4 다운로드 & 복원 기능 개발
