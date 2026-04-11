# Database & Storage

## 개요

이 프로젝트는 **SQLite(Prisma)** 와 **파일 시스템** 두 가지 저장소를 함께 사용합니다.

- **SQLite**: 구조화된 메타데이터 (논문 정보, 하이라이트)
- **파일 시스템**: 크거나 비정형 데이터 (PDF 원본, 분석 결과 markdown)

## Prisma 스키마

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:../data/papers.db"
}

model Paper {
  id            String      @id @default(uuid())
  title         String
  url           String?
  filePath      String
  chatSessionId String?
  createdAt     DateTime    @default(now())
  highlights    Highlight[]
}

model Highlight {
  id        String   @id @default(uuid())
  paperId   String
  paper     Paper    @relation(fields: [paperId], references: [id], onDelete: Cascade)
  page      Int
  rects     String   // JSON-encoded HighlightRect[]
  text      String   @default("")
  color     String   @default("yellow")
  memo      String?
  createdAt DateTime @default(now())
}
```

### Paper 필드 설명

- `id` (UUID) — 논문 고유 ID. 파일 시스템 디렉토리 이름으로도 사용
- `title` — 논문 제목 (URL에서 추출하거나 파일명 기반)
- `url` — arXiv 또는 다른 URL (nullable, 로컬 PDF의 경우)
- `filePath` — 로컬 PDF 경로. 빈 문자열일 수 있음 (다운로드 실패 시)
- `chatSessionId` — Claude Agent SDK 세션 ID. 첫 채팅 후 저장, 이후 resume에 사용 (nullable)
- `createdAt` — 등록 시각
- `highlights` — 1:N 관계. 논문 삭제 시 cascade

### Highlight 필드 설명

- `id` (UUID)
- `paperId` — FK
- `page` — 페이지 번호 (1부터 시작)
- `rects` — **JSON 문자열**. `HighlightRect[]`의 직렬화된 형태:
  ```json
  [{"top":45.2,"left":10.5,"width":30.0,"height":1.8}]
  ```
  Prisma가 SQLite에서 JSON 타입을 직접 지원하지 않아 문자열로 저장.
- `text` — 하이라이트된 원본 텍스트 (빈 문자열 가능)
- `color` — "yellow" | "green" | "blue" | "pink" (DB 레벨에선 string)
- `memo` — 사용자 메모 (nullable)
- `createdAt`

### 관계
- `Paper` 1 : N `Highlight`
- `onDelete: Cascade` — 논문 삭제 시 하이라이트도 자동 삭제

## Prisma 클라이언트 싱글톤

`src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

type GlobalWithPrisma = typeof globalThis & { prisma?: PrismaClient };
const globalForPrisma = globalThis as GlobalWithPrisma;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Next.js dev 모드의 hot reload 시 PrismaClient가 여러 번 인스턴스화되는 것을 방지. globalThis에 캐시.

## 파일 시스템 구조

```
paper-review-tool/
├── data/
│   └── papers.db          # SQLite
└── papers/
    └── <paper-id>/         # paper 1개당 디렉토리 1개
        ├── original.pdf    # 원본 PDF (다운로드 or 복사)
        ├── topics.json     # Phase 1: 식별된 배경지식 토픽
        ├── background/     # Phase 2: 토픽별 배경지식 문서
        │   ├── self-attention.md
        │   ├── seq2seq.md
        │   └── ...
        └── analysis.md     # Phase 3: 깊은 읽기 결과
```

### 디렉토리 생성
`src/lib/papers.ts`의 `createPaperDir()`:

```typescript
export function createPaperDir(paperId: string, root: string = PAPERS_ROOT): string {
  const dir = path.join(root, paperId);
  fs.mkdirSync(path.join(dir, "background"), { recursive: true });
  return dir;
}
```

`background/` 까지 한 번에 생성. 분석 시작 전에도 디렉토리가 이미 존재함.

### 분석 완료 판단
`paperHasAnalysis(paperId)`:
```typescript
export function paperHasAnalysis(paperId: string): boolean {
  return fs.existsSync(path.join(root, paperId, "analysis.md"));
}
```

`analysis.md` 파일 존재만으로 판단. Claude Code가 같이 읽기 워크플로우를 완료하면 이 파일을 작성합니다.

### 배경지식 토픽 목록
`listBackgroundTopics(paperId)`:
```typescript
export function listBackgroundTopics(paperId: string): string[] {
  const bgDir = path.join(root, paperId, "background");
  if (!fs.existsSync(bgDir)) return [];
  return fs.readdirSync(bgDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(".md", ""));
}
```

웹 UI에서 "분석 완료" 배너에 토픽 태그로 표시하는 데 사용.

## 초기화

### 최초 설치
```bash
npx prisma db push
```

`schema.prisma`를 기반으로 `data/papers.db`를 생성.

### 스키마 변경 시
```bash
npx prisma db push
```

Prisma가 변경사항을 SQLite에 반영. 데이터 손실 가능성이 있는 변경은 경고 후 대화형 확인.

### 환경 변수
없음. DB 경로는 `schema.prisma`에 `file:../data/papers.db`로 하드코딩되어 있습니다. 다른 경로로 바꾸려면 schema를 직접 편집하고 `npx prisma generate`를 실행하세요.

## 백업과 이식성

### 백업
- `data/papers.db` — DB 전체
- `papers/` — PDF와 분석 결과

두 디렉토리를 함께 백업하면 완전히 복원 가능. 둘 중 하나만 있으면 불완전.

### 이식성
논문 디렉토리(`papers/<id>/`)는 UUID 기반이라 이식 가능. 다른 컴퓨터로 `data/papers.db` + `papers/` 를 통째로 옮기면 그대로 작동.

### 여러 인스턴스
단일 사용자 전제. 여러 사용자가 동시 접근하려면:
- SQLite → PostgreSQL/MySQL 마이그레이션
- 파일 시스템 → S3 등 공유 스토리지

## gitignore

```
/data        # SQLite DB
/papers      # 논문별 PDF와 분석 결과
node_modules
.next
```

두 디렉토리 모두 사용자별 데이터이므로 git 추적 안 함.

## 트랜잭션

현재 API 라우트들은 단순 CRUD로 트랜잭션을 사용하지 않음. 예: 논문 등록 시 DB 생성 → 디렉토리 생성 → PDF 다운로드 → filePath 업데이트. 중간에 실패하면 DB와 파일 시스템이 불일치할 수 있음 (`filePath`가 빈 문자열인 Paper 레코드 등).

개선 여지: Prisma 트랜잭션 + 실패 시 롤백, 또는 "eventual consistency" 수용하고 불일치 정리 스크립트 제공.
