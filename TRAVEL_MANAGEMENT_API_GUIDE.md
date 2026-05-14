# Travel Management API — 상세 구현 가이드

> **상태:** API 구현 명세 (웹개발자용)  
> **작성일:** 2026-05-14  
> **담당:** 플레너 (설계), 웹개발자 (구현)

---

## 📋 목차

1. [API 개요](#1-api-개요)
2. [인증 & 권한](#2-인증--권한)
3. [Endpoint 상세 명세](#3-endpoint-상세-명세)
4. [에러 처리](#4-에러-처리)
5. [정산 알고리즘](#5-정산-알고리즘)
6. [알림 시스템](#6-알림-시스템)
7. [구현 예제](#7-구현-예제)

---

## 1. API 개요

### 1.1 기본 정보

- **기본 URL:** `https://dsc-fms-portal.vercel.app/api`
- **인증:** Supabase JWT Token (Authorization: Bearer {token})
- **요청 형식:** JSON (Content-Type: application/json)
- **응답 형식:** JSON
- **타임존:** UTC (모든 시간은 UTC 저장, 클라이언트에서 지역화)

### 1.2 Rate Limiting

| 엔드포인트 | 제한 | 기간 |
|-----------|------|------|
| GET 조회 | 100 | 1분 |
| POST 생성 | 50 | 1분 |
| PUT 수정 | 50 | 1분 |
| DELETE 삭제 | 20 | 1분 |

### 1.3 응답 형식

**성공 응답 (200, 201):**
```json
{
  "success": true,
  "data": { ... },
  "message": "작업 완료"
}
```

**에러 응답 (4xx, 5xx):**
```json
{
  "success": false,
  "error": {
    "code": "TRAVEL_NOT_FOUND",
    "message": "여행을 찾을 수 없습니다.",
    "details": { ... }
  }
}
```

---

## 2. 인증 & 권한

### 2.1 인증 플로우

```
사용자 로그인 (Supabase Auth)
   ↓
JWT Token 발급 (localStorage 저장)
   ↓
API 요청 시 Authorization 헤더에 토큰 포함
   ↓
백엔드에서 토큰 검증 (Supabase 인증)
   ↓
RLS 정책으로 데이터 접근 제한
```

### 2.2 권한 모델

**Role 타입:**
- `organizer` — 여행 생성자, 모든 권한
- `companion` — 동반자, 제한된 권한
- `guest` — 게스트, 읽기만 가능

**Permission 타입:**
- `read_only` — 조회만 가능
- `read_write` — 조회 + 편집 가능

**권한 매트릭스:**

| 액션 | Organizer | Companion (RW) | Companion (RO) | Guest |
|------|-----------|-------|--------|-------|
| 여행 조회 | ✓ | ✓ | ✓ | ✓ |
| 여행 수정 | ✓ | ✓ | ✗ | ✗ |
| 여행 삭제 | ✓ | ✗ | ✗ | ✗ |
| 멤버 관리 | ✓ | ✗ | ✗ | ✗ |
| 이벤트 추가/수정 | ✓ | ✓ | ✗ | ✗ |
| 비용 등록 | ✓ | ✓ | ✓ (자신만) | ✗ |
| 체크리스트 수정 | ✓ | ✓ | ✗ | ✗ |
| 문서 업로드 | ✓ | ✓ | ✗ | ✗ |
| 알림 설정 | ✓ | ✓ | ✓ (자신만) | ✓ (자신만) |

### 2.3 RLS 정책 (Supabase)

```sql
-- travels: 본인 또는 멤버인 여행만 조회/수정 가능
ALTER TABLE travels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or member travels"
  ON travels FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travels.id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own travels"
  ON travels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own travels"
  ON travels FOR DELETE
  USING (auth.uid() = user_id);

-- travel_members: 해당 여행에 참여한 사용자만 멤버 조회
CREATE POLICY "Members can view own travel members"
  ON travel_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members tm
      WHERE tm.travel_id = travel_members.travel_id
        AND tm.user_id = auth.uid()
    )
  );

-- travel_events, travel_costs 등: 여행 멤버만 조회/수정
-- (마찬가지 패턴)
```

---

## 3. Endpoint 상세 명세

### 3.1 여행 관리 (Travel CRUD)

#### POST /api/travels
**여행 생성**

```http
POST /api/travels
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Ho Chi Minh City",
  "start_date": "2026-05-15",
  "end_date": "2026-05-24",
  "location": "Ho Chi Minh City",
  "description": "Business trip with colleague"
}
```

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Ho Chi Minh City",
    "start_date": "2026-05-15",
    "end_date": "2026-05-24",
    "location": "Ho Chi Minh City",
    "description": "Business trip with colleague",
    "status": "upcoming",
    "created_at": "2026-05-14T10:00:00Z",
    "updated_at": "2026-05-14T10:00:00Z"
  },
  "message": "여행이 생성되었습니다."
}
```

**에러:**
- `400 Bad Request` — 필수 필드 누락, 날짜 유효성 오류
- `401 Unauthorized` — 인증 토큰 없음
- `500 Internal Server Error` — 서버 오류

**부작용:**
1. travels 테이블에 레코드 생성
2. travel_members 테이블에 organizer로 자동 추가 (user_id, role='organizer')
3. travel_notification_rules 테이블에 기본 알림 규칙 자동 생성

---

#### GET /api/travels
**여행 목록 조회**

```http
GET /api/travels?status=upcoming&sort_by=date
Authorization: Bearer {token}
```

**쿼리 파라미터:**
- `status` (선택): 'upcoming' | 'ongoing' | 'completed' (기본값: all)
- `sort_by` (선택): 'date' | 'cost' | 'name' (기본값: date)
- `limit` (선택): 기본값 20, 최대 100
- `offset` (선택): 페이지네이션 (기본값: 0)

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Ho Chi Minh City",
      "start_date": "2026-05-15",
      "end_date": "2026-05-24",
      "location": "Ho Chi Minh City",
      "member_count": 2,
      "total_cost": 148771,
      "currency": "INR",
      "status": "upcoming",
      "created_at": "2026-05-14T10:00:00Z"
    },
    // ... 더 많은 여행 ...
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### GET /api/travels/[id]
**여행 상세 조회**

```http
GET /api/travels/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Ho Chi Minh City",
    "start_date": "2026-05-15",
    "end_date": "2026-05-24",
    "location": "Ho Chi Minh City",
    "description": "Business trip",
    "status": "upcoming",
    "created_at": "2026-05-14T10:00:00Z",
    "updated_at": "2026-05-14T10:00:00Z",
    "organizer": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Na Kyeongtae",
      "email": "asdf1390a@gmail.com"
    },
    "members": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "user_id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Na Kyeongtae",
        "role": "organizer",
        "permission": "read_write"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "user_id": "550e8400-e29b-41d4-a716-446655440004",
        "name": "Huishuwo Leiyawon",
        "role": "companion",
        "permission": "read_write"
      }
    ],
    "events": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "title": "항공편 TR 779/516",
        "event_type": "flight",
        "event_date": "2026-05-15",
        "event_time": "23:50",
        "location": "Chennai → Ho Chi Minh City",
        "status": "planned"
      }
      // ... 더 많은 이벤트 ...
    ],
    "summary": {
      "total_cost": 148771,
      "currency": "INR",
      "per_person": 74385.50,
      "events_count": 5,
      "checklist_count": 32,
      "documents_count": 8
    }
  }
}
```

---

#### PUT /api/travels/[id]
**여행 정보 수정**

```http
PUT /api/travels/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Ho Chi Minh City 2026",
  "description": "Updated description",
  "status": "ongoing"
}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": { /* 수정된 여행 객체 */ },
  "message": "여행이 수정되었습니다."
}
```

**권한:**
- organizer만 가능

---

#### DELETE /api/travels/[id]
**여행 삭제**

```http
DELETE /api/travels/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": null,
  "message": "여행이 삭제되었습니다."
}
```

**부작용:**
- Cascade delete: 모든 하위 데이터 (events, costs, checklist, documents, notifications) 삭제

**권한:**
- organizer만 가능

---

### 3.2 멤버 관리

#### POST /api/travels/[id]/members
**멤버 추가**

```http
POST /api/travels/550e8400-e29b-41d4-a716-446655440000/members
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_id": "550e8400-e29b-41d4-a716-446655440004",
  "role": "companion",
  "permission": "read_write"
}
```

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "travel_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "550e8400-e29b-41d4-a716-446655440004",
    "name": "Huishuwo Leiyawon",
    "email": "huishuwo@example.com",
    "role": "companion",
    "permission": "read_write",
    "joined_at": "2026-05-14T10:30:00Z"
  },
  "message": "멤버가 추가되었습니다."
}
```

**에러:**
- `400 Bad Request` — 이미 추가된 멤버
- `404 Not Found` — 사용자 또는 여행을 찾을 수 없음

**권한:**
- organizer만 가능

**부작용:**
1. travel_members 테이블에 레코드 추가
2. 새 멤버의 기본 알림 규칙 생성
3. 추가된 멤버에게 이메일/Telegram 알림 발송

---

#### DELETE /api/travels/[id]/members/[member_id]
**멤버 제거**

```http
DELETE /api/travels/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440003
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": null,
  "message": "멤버가 제거되었습니다."
}
```

**권한:**
- organizer만 가능, 또는 자신의 가입만 취소 가능

**부작용:**
1. travel_members 레코드 삭제
2. 이 멤버가 지불한 비용 정산액 재계산 (선택사항: 기존 정산 그대로 유지 vs 재계산)

---

### 3.3 일정 관리

#### POST /api/travels/[id]/events
**이벤트 추가**

```http
POST /api/travels/550e8400-e29b-41d4-a716-446655440000/events
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "항공편 TR 779/516",
  "event_type": "flight",
  "event_date": "2026-05-15",
  "event_time": "23:50",
  "location": "Chennai (CMB) → Ho Chi Minh City (SGN)",
  "description": "Departure flight",
  "details": {
    "flight_number": "TR 779/516",
    "airline": "Tirupati Airways",
    "departure_airport": "CMB",
    "arrival_airport": "SGN",
    "duration_hours": 7,
    "seat_number": "12A"
  }
}
```

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "travel_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "항공편 TR 779/516",
    "event_type": "flight",
    "event_date": "2026-05-15",
    "event_time": "23:50",
    "location": "Chennai (CMB) → Ho Chi Minh City (SGN)",
    "status": "planned",
    "created_at": "2026-05-14T10:00:00Z",
    "updated_at": "2026-05-14T10:00:00Z"
  },
  "message": "이벤트가 추가되었습니다."
}
```

**부작용:**
1. travel_events 테이블에 레코드 추가
2. 모든 여행 멤버에게 알림 규칙 자동 생성 (이벤트 1시간 전)

---

#### GET /api/travels/[id]/events
**모든 이벤트 조회**

```http
GET /api/travels/550e8400-e29b-41d4-a716-446655440000/events
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "travel_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "항공편 TR 779/516",
      "event_type": "flight",
      "event_date": "2026-05-15",
      "event_time": "23:50",
      "location": "Chennai → Ho Chi Minh City",
      "status": "planned",
      "created_at": "2026-05-14T10:00:00Z"
    },
    // ... 더 많은 이벤트 (시간순 정렬)
  ]
}
```

---

#### PUT /api/travels/[id]/events/[event_id]
**이벤트 수정**

```http
PUT /api/travels/550e8400-e29b-41d4-a716-446655440000/events/550e8400-e29b-41d4-a716-446655440010
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "completed",
  "notes": "Flight arrived on time"
}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": { /* 수정된 이벤트 */ },
  "message": "이벤트가 수정되었습니다."
}
```

---

#### DELETE /api/travels/[id]/events/[event_id]
**이벤트 삭제**

```http
DELETE /api/travels/550e8400-e29b-41d4-a716-446655440000/events/550e8400-e29b-41d4-a716-446655440010
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": null,
  "message": "이벤트가 삭제되었습니다."
}
```

---

### 3.4 비용 관리

#### POST /api/travels/[id]/costs
**비용 추가**

```http
POST /api/travels/550e8400-e29b-41d4-a716-446655440000/costs
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "항공편",
  "amount": 96050,
  "currency": "INR",
  "cost_type": "flight",
  "payer_id": "550e8400-e29b-41d4-a716-446655440001",
  "cost_date": "2026-05-15",
  "splits": [
    {
      "member_id": "550e8400-e29b-41d4-a716-446655440002",
      "amount": 48025
    },
    {
      "member_id": "550e8400-e29b-41d4-a716-446655440003",
      "amount": 48025
    }
  ],
  "payment_method": "card"
}
```

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "travel_id": "550e8400-e29b-41d4-a716-446655440000",
    "payer_id": "550e8400-e29b-41d4-a716-446655440001",
    "payer_name": "Na Kyeongtae",
    "title": "항공편",
    "amount": 96050,
    "currency": "INR",
    "cost_type": "flight",
    "payment_method": "card",
    "cost_date": "2026-05-15",
    "splits": [
      {
        "member_id": "550e8400-e29b-41d4-a716-446655440002",
        "member_name": "Na Kyeongtae",
        "amount": 48025
      },
      {
        "member_id": "550e8400-e29b-41d4-a716-446655440003",
        "member_name": "Huishuwo Leiyawon",
        "amount": 48025
      }
    ],
    "created_at": "2026-05-14T10:00:00Z"
  },
  "message": "비용이 추가되었습니다."
}
```

**부작용:**
1. travel_costs 및 travel_cost_splits 테이블에 레코드 추가
2. 정산 계산표 자동 업데이트 (백그라운드)

---

#### GET /api/travels/[id]/costs
**모든 비용 조회**

```http
GET /api/travels/550e8400-e29b-41d4-a716-446655440000/costs
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "title": "항공편",
      "amount": 96050,
      "currency": "INR",
      "payer_name": "Na Kyeongtae",
      "cost_type": "flight",
      "cost_date": "2026-05-15",
      "splits": [ /* ... */ ]
    },
    // ... 더 많은 비용 (시간순 역정렬)
  ]
}
```

---

#### GET /api/travels/[id]/settlement
**정산 계산표 조회**

```http
GET /api/travels/550e8400-e29b-41d4-a716-446655440000/settlement
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "travel_id": "550e8400-e29b-41d4-a716-446655440000",
    "travel_name": "Ho Chi Minh City",
    "total_cost": 148771,
    "currency": "INR",
    "settlement_status": "unsettled",
    "members": [
      {
        "member_id": "550e8400-e29b-41d4-a716-446655440002",
        "member_name": "Na Kyeongtae",
        "total_paid": 148771,
        "share": 74385.50,
        "balance": -74385.50,
        "description": "받을 금액"
      },
      {
        "member_id": "550e8400-e29b-41d4-a716-446655440003",
        "member_name": "Huishuwo Leiyawon",
        "total_paid": 0,
        "share": 74385.50,
        "balance": 74385.50,
        "description": "줄 금액"
      }
    ],
    "settlement_summary": "Huishuwo Leiyawon이 Na Kyeongtae에게 ₹74,385.50을 송금해야 합니다."
  }
}
```

**계산 방식:**
```
balance = total_paid - share
- balance > 0 : 받을 금액
- balance < 0 : 줄 금액
- balance = 0 : 정산 완료
```

---

### 3.5 체크리스트 관리

#### POST /api/travels/[id]/checklist
**체크리스트 항목 추가**

```http
POST /api/travels/550e8400-e29b-41d4-a716-446655440000/checklist
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "여권 확인",
  "category": "documents",
  "priority": "high"
}
```

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440030",
    "travel_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "여권 확인",
    "category": "documents",
    "is_completed": false,
    "priority": "high",
    "created_by": "550e8400-e29b-41d4-a716-446655440001",
    "created_at": "2026-05-14T10:00:00Z"
  },
  "message": "항목이 추가되었습니다."
}
```

---

#### GET /api/travels/[id]/checklist
**체크리스트 조회 (카테고리별 정렬)**

```http
GET /api/travels/550e8400-e29b-41d4-a716-446655440000/checklist
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 32,
    "completed": 18,
    "progress": 0.5625,
    "categories": {
      "documents": {
        "total": 4,
        "completed": 4,
        "items": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440030",
            "title": "여권 확인",
            "is_completed": true,
            "priority": "high",
            "notes": "여권 유효기간 확인됨"
          },
          // ...
        ]
      },
      "clothing": {
        "total": 7,
        "completed": 2,
        "items": [ /* ... */ ]
      }
      // ... 더 많은 카테고리
    }
  }
}
```

---

#### PUT /api/travels/[id]/checklist/[item_id]
**체크리스트 항목 수정**

```http
PUT /api/travels/550e8400-e29b-41d4-a716-446655440000/checklist/550e8400-e29b-41d4-a716-446655440030
Authorization: Bearer {token}
Content-Type: application/json

{
  "is_completed": true,
  "notes": "여권 유효기간 확인됨"
}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": { /* 수정된 항목 */ },
  "message": "항목이 업데이트되었습니다."
}
```

---

#### DELETE /api/travels/[id]/checklist/[item_id]
**체크리스트 항목 삭제**

```http
DELETE /api/travels/550e8400-e29b-41d4-a716-446655440000/checklist/550e8400-e29b-41d4-a716-446655440030
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": null,
  "message": "항목이 삭제되었습니다."
}
```

---

### 3.6 문서 관리

#### POST /api/travels/[id]/documents (파일 업로드)
**파일 업로드**

```http
POST /api/travels/550e8400-e29b-41d4-a716-446655440000/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: <파일>
document_type: "visa"
description: "베트남 비자 허가서"
```

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "travel_id": "550e8400-e29b-41d4-a716-446655440000",
    "file_name": "vietnam_visa_approval.pdf",
    "file_path": "travels/550e8400-e29b-41d4-a716-446655440000/documents/vietnam_visa_approval.pdf",
    "file_size": 2097152,
    "file_type": "application/pdf",
    "document_type": "visa",
    "uploaded_by": "550e8400-e29b-41d4-a716-446655440001",
    "uploaded_at": "2026-05-14T10:00:00Z"
  },
  "message": "파일이 업로드되었습니다."
}
```

**제한사항:**
- 파일 크기: 최대 50MB
- 허용 형식: PDF, 이미지 (JPG, PNG, GIF)
- 저장소 총 용량: 사용자당 1GB (또는 여행당 100MB)

---

#### GET /api/travels/[id]/documents
**모든 문서 조회**

```http
GET /api/travels/550e8400-e29b-41d4-a716-446655440000/documents
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 8,
    "storage_used_mb": 10.2,
    "storage_limit_mb": 100,
    "folders": {
      "visa": {
        "count": 3,
        "documents": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440040",
            "file_name": "vietnam_visa_approval.pdf",
            "file_size": 2097152,
            "document_type": "visa",
            "uploaded_at": "2026-05-14T10:00:00Z",
            "download_url": "https://...supabase-storage-signed-url...",
            "preview_url": "https://...preview..."
          }
        ]
      },
      // ... 더 많은 폴더
    }
  }
}
```

---

#### DELETE /api/travels/[id]/documents/[doc_id]
**문서 삭제**

```http
DELETE /api/travels/550e8400-e29b-41d4-a716-446655440000/documents/550e8400-e29b-41d4-a716-446655440040
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": null,
  "message": "파일이 삭제되었습니다."
}
```

---

### 3.7 알림 관리

#### GET /api/travels/[id]/notifications
**여행의 모든 알림 조회**

```http
GET /api/travels/550e8400-e29b-41d4-a716-446655440000/notifications
Authorization: Bearer {token}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440050",
        "rule_type": "days_before_departure",
        "rule_config": {
          "days": 7,
          "channels": ["in_app", "email", "telegram"]
        },
        "is_enabled": true,
        "description": "출발 7일 전 알림"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440051",
        "rule_type": "days_before_departure",
        "rule_config": {
          "days": 1,
          "channels": ["in_app", "email"]
        },
        "is_enabled": true,
        "description": "출발 1일 전 알림"
      }
      // ... 더 많은 규칙
    ],
    "pending_notifications": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440060",
        "title": "여행 준비 알림",
        "message": "Ho Chi Minh City 여행까지 7일 남았습니다.",
        "trigger_date": "2026-05-08",
        "trigger_time": "09:00",
        "channels": ["in_app", "email", "telegram"],
        "is_sent": false
      }
      // ... 더 많은 대기 중인 알림
    ]
  }
}
```

---

#### PUT /api/travels/[id]/notifications/rules/[rule_id]
**알림 규칙 활성화/비활성화**

```http
PUT /api/travels/550e8400-e29b-41d4-a716-446655440000/notifications/rules/550e8400-e29b-41d4-a716-446655440050
Authorization: Bearer {token}
Content-Type: application/json

{
  "is_enabled": false
}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": { /* 수정된 규칙 */ },
  "message": "알림 규칙이 업데이트되었습니다."
}
```

---

## 4. 에러 처리

### 4.1 HTTP 상태 코드

| 상태 | 의미 | 예시 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 204 | No Content | 삭제 성공 (응답 본문 없음) |
| 400 | Bad Request | 필수 필드 누락, 유효성 오류 |
| 401 | Unauthorized | 인증 토큰 없음 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 중복 (예: 이미 추가된 멤버) |
| 413 | Payload Too Large | 파일 크기 초과 |
| 429 | Too Many Requests | Rate limit 초과 |
| 500 | Internal Server Error | 서버 오류 |

### 4.2 에러 응답 예시

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "유효성 검증 실패",
    "details": {
      "end_date": "종료일이 시작일보다 이전일 수 없습니다."
    }
  }
}
```

### 4.3 에러 코드 목록

| 코드 | HTTP | 설명 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 필드 유효성 오류 |
| `UNAUTHORIZED` | 401 | 인증 토큰 없음 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `TRAVEL_NOT_FOUND` | 404 | 여행을 찾을 수 없음 |
| `DUPLICATE_MEMBER` | 409 | 이미 추가된 멤버 |
| `FILE_TOO_LARGE` | 413 | 파일 크기 초과 |
| `STORAGE_EXCEEDED` | 413 | 저장소 한계 도달 |
| `RATE_LIMIT_EXCEEDED` | 429 | 요청 빈도 초과 |
| `INTERNAL_ERROR` | 500 | 서버 오류 |

---

## 5. 정산 알고리즘

### 5.1 균등 분할 (Equal Split)

**예시:**
- 총 비용: ₹148,771
- 멤버: 2명
- 1인당 몫: ₹148,771 ÷ 2 = ₹74,385.50

**계산:**
```
member1_balance = member1_paid - member1_share
                = ₹148,771 - ₹74,385.50
                = ₹74,385.50 (받을 금액)

member2_balance = member2_paid - member2_share
                = ₹0 - ₹74,385.50
                = -₹74,385.50 (줄 금액)
```

### 5.2 비율 분할 (Ratio Split)

**예시:** 숙소 비용을 1:2 비율로 분담
```
member1_share = ₹47,721 × (1/3) = ₹15,907
member2_share = ₹47,721 × (2/3) = ₹31,814
```

### 5.3 커스텀 분할 (Custom Split)

**예시:** 각 멤버별 정확한 금액 지정
```
{
  "splits": [
    {"member_id": "uuid1", "amount": 100000},
    {"member_id": "uuid2", "amount": 48771}
  ]
}
```

### 5.4 간단한 정산 (Simple Settlement)

**알고리즘:** 그리디 정산 (최소 이체 횟수)

```python
def calculate_settlement(members):
    """
    members: [
      {"id": "m1", "balance": 74385.50},  # 받을 금액
      {"id": "m2", "balance": -74385.50}, # 줄 금액
    ]
    
    결과: [{"from": "m2", "to": "m1", "amount": 74385.50}]
    """
    
    # 1. 음수(줄 금액)와 양수(받을 금액) 분리
    debtors = [m for m in members if m["balance"] < 0]
    creditors = [m for m in members if m["balance"] > 0]
    
    # 2. 절댓값으로 정렬
    debtors.sort(key=lambda m: m["balance"])
    creditors.sort(key=lambda m: m["balance"], reverse=True)
    
    # 3. 그리디 매칭
    transactions = []
    debtor_idx, creditor_idx = 0, 0
    
    while debtor_idx < len(debtors) and creditor_idx < len(creditors):
        debtor = debtors[debtor_idx]
        creditor = creditors[creditor_idx]
        
        amount = min(abs(debtor["balance"]), creditor["balance"])
        
        transactions.append({
            "from": debtor["id"],
            "to": creditor["id"],
            "amount": amount
        })
        
        debtor["balance"] += amount  # 음수이므로 더해서 0에 가까움
        creditor["balance"] -= amount
        
        if debtor["balance"] == 0:
            debtor_idx += 1
        if creditor["balance"] == 0:
            creditor_idx += 1
    
    return transactions
```

---

## 6. 알림 시스템

### 6.1 자동 알림 규칙

**여행 생성 시 자동 생성:**

```
규칙 1: 출발 7일 전 (자정 기준)
  - 트리거: travel.start_date - 7일
  - 시간: 09:00 (사용자 타임존)
  - 채널: [in_app, email, telegram]
  - 메시지: "여행까지 7일 남았습니다. 준비를 시작하세요."

규칙 2: 출발 1일 전
  - 트리거: travel.start_date - 1일
  - 시간: 18:00
  - 채널: [in_app, email]
  - 메시지: "내일 출발입니다. 짐을 준비하세요."

규칙 3: 출발 24시간 전
  - 트리거: travel.start_date - 24시간
  - 시간: 정확한 시간
  - 채널: [in_app]
  - 메시지: "24시간 후 출발합니다."

규칙 4: 출발 6시간 전
  - 트리거: travel.start_date - 6시간
  - 시간: 정확한 시간
  - 채널: [in_app]
  - 메시지: "공항으로 출발할 시간입니다!"

규칙 5: 각 이벤트 1시간 전
  - 트리거: event.event_date + event.event_time - 1시간
  - 채널: [in_app, email]
  - 메시지: "이벤트 '${event.title}'가 1시간 후입니다."

규칙 6: 체크아웃 1일 전
  - 트리거: travel.end_date - 1일
  - 시간: 18:00
  - 채널: [in_app, email]
  - 메시지: "내일 체크아웃입니다. 짐을 정리하세요."
```

### 6.2 알림 발송 파이프라인

```
Cron Job (매일 자정 UTC)
  ↓
travel_notification_rules 조회
  ↓
각 규칙별 트리거 시간 계산
  ↓
해당하는 travel_notifications 생성
  ↓
각 채널별 발송
  ├─ 인앱: notification 테이블 저장 → 프론트엔드에서 폴링
  ├─ 이메일: SendGrid / Resend 호출
  └─ Telegram: Telegram Bot API 호출
  ↓
발송 완료 → is_sent = true, sent_at = NOW()
```

### 6.3 알림 채널별 구현

#### 인앱 알림
```javascript
// travel_notifications 테이블에 저장
// 프론트엔드에서 실시간 또는 주기적으로 폴링
GET /api/notifications?unread=true
```

#### 이메일
```
SendGrid 또는 Resend API
Subject: "[DSC Travel] 여행 준비 알림 - Ho Chi Minh City"
Template: travel_notification_email.html
Variables:
  - travel_name
  - message
  - action_url: https://dsc-fms-portal.vercel.app/travel/[id]
```

#### Telegram
```
Telegram Bot Token (env 변수)
Chat ID: user의 telegram_chat_id (users 테이블 저장)
Message: formatted text + 인라인 버튼 (View Travel)
```

---

## 7. 구현 예제

### 7.1 Node.js 클라이언트 예제

```javascript
// lib/travel-api.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// 여행 생성
export async function createTravel(data) {
  const response = await fetch("/api/travels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return response.json();
}

// 여행 목록 조회
export async function fetchTravels(filters) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/travels?${params}`);
  return response.json();
}

// 여행 상세 조회
export async function fetchTravelDetail(id) {
  const response = await fetch(`/api/travels/${id}`);
  return response.json();
}

// 비용 추가
export async function addCost(travelId, data) {
  const response = await fetch(`/api/travels/${travelId}/costs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return response.json();
}

// 정산 계산표 조회
export async function fetchSettlement(travelId) {
  const response = await fetch(`/api/travels/${travelId}/settlement`);
  return response.json();
}
```

### 7.2 React 컴포넌트 예제

```jsx
// components/TravelCosts.tsx

import { useState, useEffect } from "react";
import { fetchTravelDetail, addCost, fetchSettlement } from "@/lib/travel-api";

export default function TravelCosts({ travelId }) {
  const [costs, setCosts] = useState([]);
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const travel = await fetchTravelDetail(travelId);
      setCosts(travel.data.costs || []);

      const settle = await fetchSettlement(travelId);
      setSettlement(settle.data);

      setLoading(false);
    }

    load();
  }, [travelId]);

  const handleAddCost = async (formData) => {
    const result = await addCost(travelId, formData);
    if (result.success) {
      setCosts([...costs, result.data]);
      // Re-fetch settlement
      const settle = await fetchSettlement(travelId);
      setSettlement(settle.data);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>💰 경비 요약</h2>
      <div className="summary-card">
        <p>총 비용: ₹{settlement.total_cost}</p>
        <p>1인당 평균: ₹{settlement.members[0]?.share}</p>
      </div>

      <h3>💳 비용 항목</h3>
      {costs.map((cost) => (
        <div key={cost.id} className="cost-item">
          <p>{cost.title}: ₹{cost.amount}</p>
          <p>결제자: {cost.payer_name}</p>
        </div>
      ))}

      <h3>📊 정산 계산표</h3>
      <table>
        <thead>
          <tr>
            <th>동반자</th>
            <th>지출</th>
            <th>정산액</th>
          </tr>
        </thead>
        <tbody>
          {settlement.members.map((member) => (
            <tr key={member.member_id}>
              <td>{member.member_name}</td>
              <td>₹{member.total_paid}</td>
              <td>₹{member.balance}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <CostForm onSubmit={handleAddCost} />
    </div>
  );
}
```

### 7.3 Supabase SQL 마이그레이션

```sql
-- File: db/migrations/001_create_travel_tables.sql

CREATE TABLE travels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_dates CHECK (end_date >= start_date)
);

CREATE TABLE travel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role VARCHAR(50) DEFAULT 'companion',
  permission VARCHAR(50) DEFAULT 'read_write',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(travel_id, user_id)
);

-- ... (더 많은 테이블)

-- 인덱스 생성
CREATE INDEX idx_travels_user_id ON travels(user_id);
CREATE INDEX idx_travel_members_travel_id ON travel_members(travel_id);
CREATE INDEX idx_travel_costs_travel_id ON travel_costs(travel_id);

-- RLS 활성화
ALTER TABLE travels ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_members ENABLE ROW LEVEL SECURITY;
-- ... (더 많은 RLS)

-- 정책 설정
CREATE POLICY "Users can view own travels"
  ON travels FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM travel_members
    WHERE travel_members.travel_id = travels.id
    AND travel_members.user_id = auth.uid()
  ));
```

---

**작성자:** 플레너  
**상태:** API 구현 명세 (웹개발자 구현 대기)  
**마지막 수정:** 2026-05-14
