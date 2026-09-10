# Paper Review Tool

논문을 읽을 때 Codex와 함께 배경지식을 쌓고 깊게 이해하는 로컬 도구입니다.
Codex 세션이 논문 분석부터 웹 UI 실행까지 수행하고, 웹 채팅과 분석 보강도 Codex SDK로 실행합니다.

## 설치와 첫 실행

Node.js 22 이상과 npm이 필요합니다. Linux/WSL에서 검증했습니다. 전체 분석에는 파일·shell·웹 검색을 사용할 수 있는 Codex 세션이 필요하며, 병렬 조사 기능이 없으면 순차로 진행합니다.

```bash
git clone https://github.com/suholee0/paper-review-assistant.git
cd paper-review-assistant
npm ci
npx prisma db push
npx --no-install codex login
npx --no-install codex login status
npx --no-install codex
```

`npm ci`는 lockfile에 고정된 의존성과 Codex CLI를 설치합니다. `prisma db push`는 로컬 SQLite DB를 초기화합니다. 두 초기 설정 명령은 `bash scripts/setup.sh`로도 실행할 수 있습니다. 기존 DB를 초기화하기 위해 reset할 필요는 없습니다.

인증은 웹 서버를 실행하는 **같은 OS 사용자**로 진행하세요. 이미 로그인했다면 login은 생략하고 status로 확인하면 됩니다. 앱에서 별도의 API 키를 입력할 필요는 없으며, 사용할 수 있는 모델과 사용량은 Codex 인증 환경을 따릅니다.

Codex 세션에서 다음과 같이 요청합니다:

```text
이 논문 같이 읽자: https://arxiv.org/abs/1706.03762
```

Codex가 [AGENTS.md](AGENTS.md)와 `skills/*.md`를 읽고 논문을 분석한 뒤 웹 접속 URL을 제공합니다. 스킬을 별도로 설치할 필요는 없습니다. 웹 UI만 실행하려면 별도 터미널에서 `npm run paper:serve`를 사용하세요. 웹 UI 자체는 전체 분석 workflow를 시작하지 않습니다.

### 선택 설정

Next.js 웹 runtime 설정은 `.env.example`을 참고해 `.env.local`에 작성할 수 있습니다.

| 설정 | 기본 동작 |
| --- | --- |
| `CODEX_MODEL` | 생략 시 로컬 Codex 모델 설정 사용 |
| `CODEX_PATH` | 생략 시 SDK와 함께 설치된 Codex 실행 파일 사용 |

앱은 Codex 인증 정보를 브라우저에 전달하지 않습니다. 인증·thread·sandbox 세부 동작은 [AI 연동 문서](docs/ai-integration.md)에 설명되어 있습니다. 이 앱은 개인 로컬 사용을 전제로 하며 공개 서비스용 사용자 인증을 제공하지 않습니다.

## 핵심 workflow

```text
논문 URL/로컬 PDF 입력
  → 논문 등록 (SQLite + original.pdf)
  → 원문 전체 skim
  → topics.json 생성
  → 토픽별 병렬 웹 조사
  → background/<topic>.md 생성 및 검토
  → 모든 background를 읽고 원문을 섹션별로 재독
  → analysis.md 생성 및 검토
  → 웹 UI 실행, 접속 URL 안내
```

- 병렬 작업 수는 현재 환경의 한도를 따릅니다. 메인 에이전트를 제외한 작업자 슬롯으로 토픽을 나누어 처리하고 모두 완료한 뒤 deep read를 시작합니다.
- PDF는 설치된 PDF.js로 페이지별 텍스트를 추출합니다. 표·그림·수식은 필요한 페이지를 이미지로 렌더링하여 확인합니다. 별도 PDF CLI 설치는 필요하지 않습니다.
- 기존 완성된 분석은 재사용합니다. 불완전한 결과는 사용자의 편집을 보존하면서 누락 단계부터 이어갑니다.
- 모든 연구 결과는 한국어 Markdown으로 저장하고 확인한 출처를 링크합니다.
- 검색 요약이나 PDF 추출 성공을 전체 정독 완료로 취급하지 않습니다.

분석 실행 주체는 Codex 세션입니다. 웹앱이나 등록 스크립트가 분석 파이프라인을 자동 실행하는 구조는 아닙니다.

## CLI

저장소 루트에서 실행합니다. 경로에 공백이 있으면 따옴표로 감싸세요.

```bash
# 논문 등록: 로컬 PDF, arXiv abs/pdf, 직접 PDF URL
node --import tsx scripts/register-paper.ts <url-or-filepath> [title]

# 등록된 논문과 기존 분석 상태
node --import tsx scripts/list-papers.ts

# 모든 PDF 페이지의 텍스트 및 페이지 인덱스 추출
node scripts/read-paper.mjs papers/<id>

# 그림·표·수식을 확인할 페이지 이미지 생성
node scripts/read-paper.mjs papers/<id> --render 1,3,5

# 토픽별 문서 누락·출처 링크 검사
node --import tsx scripts/check-paper.ts papers/<id> --backgrounds

# analysis.md 구조까지 검사 (정확성·정독 여부는 Codex가 별도 검토)
node --import tsx scripts/check-paper.ts papers/<id>

# 서버 준비 및 HTTP 응답 확인 후 접속 URL 출력
node --import tsx scripts/serve.ts <id>

# GUI 브라우저를 열려는 경우에만
node --import tsx scripts/serve.ts <id> --open
```

`paper:register`, `paper:list`, `paper:read`, `paper:check`, `paper:serve` npm 명령도 사용할 수 있습니다. 예: `npm run paper:read -- papers/<id>`.

서버는 기본적으로 `127.0.0.1:3000`에 바인딩합니다. 포트는 `PORT`로 지정하며 이미 사용 중인 포트의 서버를 자동 종료하지 않습니다. Codex는 장기 실행 shell 세션으로 서버를 유지하고 URL을 전달합니다. 원격 개발 환경에서는 해당 환경의 포트 포워딩을 사용하세요.

## 웹 UI

- 등록 논문 목록 및 PDF / 분석 / 배경지식 탭
- PDF 연속 스크롤, 줌, 인용 정보 패널
- 하이라이트와 메모
- Markdown·LaTeX 수식 렌더링
- 선택 문맥으로 질문하기, 스트리밍 채팅, 분석 보강

**웹 채팅과 분석 보강도 공식 `@openai/codex-sdk`를 사용합니다.** 웹 서버를 실행하는 OS 사용자 환경에서 Codex에 로그인하세요 (`npx --no-install codex login`, 확인: `npx --no-install codex login status`). SDK는 로컬 인증을 사용하며 앱이 인증 토큰을 읽어 프런트엔드에 전달하지 않습니다.

모델 선택 기본값은 로컬 Codex 설정을 따릅니다. 서버 환경 변수 `CODEX_MODEL`로 모델을 지정하거나, `CODEX_PATH`로 사용할 Codex 실행 파일을 지정할 수 있습니다. `.env.example`과 [AI 통합 문서](docs/ai-integration.md)를 참고하세요.

기존 다른 runtime의 채팅 세션 ID는 재사용하지 않습니다. 첫 성공 응답부터 `codex:<thread-id>`로 교체하며, 브라우저에 저장된 이전 메시지와 논문 파일은 보존합니다. 이전 runtime의 대화 맥락은 새 thread로 자동 이관되지 않습니다.

웹 채팅은 read-only + 웹 검색, 분석 보강은 논문 디렉토리를 작업 경로로 지정한 workspace-write 설정입니다. `analysis.md`만 수정하라는 지침을 주지만 sandbox가 단일 파일만 허용하는 것은 아닙니다. SSE 이벤트는 기존 형식을 유지하며 SDK가 완료한 메시지 단위로 텍스트를 전달합니다.

## 구조

```text
AGENTS.md                  # Codex 진입 지침
skills/                    # 원문 읽기, skim, 병렬 background, deep read 지침
scripts/                   # 등록, PDF 추출, 검사, 목록, 서버 실행
src/app/                   # Next.js 페이지 및 API
src/components/            # PDF·문서 뷰어, 하이라이트, 채팅
src/lib/                   # 파일 접근, 산출물 검사, DB, 웹 채팅 provider
prisma/schema.prisma       # Paper 및 Highlight 모델
papers/<id>/
  original.pdf
  source/index.json        # PDF 해시·페이지 수·텍스트 추출 상태
  source/pages/*.txt       # 모든 페이지의 텍스트
  source/images/*.png      # 요청한 페이지 이미지
  source/reading-notes.md  # Codex가 기록하는 읽기 범위·섹션 메모
  topics.json
  background/*.md
  analysis.md
data/papers.db             # SQLite 메타데이터
```

Next.js 15, React 19, TypeScript, Tailwind CSS, react-pdf/PDF.js, Prisma/SQLite, react-markdown/KaTeX를 사용합니다. 논문과 생성 문서는 로컬 파일이고 메타데이터·하이라이트는 SQLite에 저장합니다.

## 테스트와 빌드

설치 후 다음 검사는 Codex 로그인이나 실제 모델 요청 없이 실행할 수 있습니다.

```bash
npm test
npm run build
```

테스트는 SDK·DB를 모킹해 provider 이벤트, thread ID 전환, API/SSE, UI 오류 처리와 파일 검사 동작을 확인합니다. 빌드는 로컬 DB를 초기화한 환경에서 실행하세요.

### 실제 Codex smoke test (선택)

```bash
npx --no-install codex login status
npm run test:codex
```

실제 모델 요청 **3회**로 임시 파일 읽기, 같은 thread의 대화 재개, 문서 보강을 확인합니다. 사용량이 발생하므로 기본 테스트에 포함되지 않습니다. 기존 논문·DB는 수정하지 않고 임시 논문 디렉토리를 정리합니다. 재개 검증에 사용한 thread 기록은 Codex 세션 저장소에 남습니다.

smoke test는 shell 환경 변수를 사용하며 `.env.local`을 자동으로 읽지 않습니다. 웹과 같은 `CODEX_MODEL`/`CODEX_PATH`를 시험하려면 해당 값을 shell에도 설정하세요. 인증·세션 저장소 쓰기나 모델 연결이 막힌 환경에서는 실패할 수 있으며 오류가 출력됩니다.

프로덕션 빌드를 로컬에서 실행하려면 `npm run start -- --hostname 127.0.0.1`을 사용하세요.

## 상세 문서

- [Architecture](docs/architecture.md)
- [Read Together workflow](docs/read-together-workflow.md)
- [웹 UI](docs/web-ui.md)
- [하이라이트](docs/highlights.md)
- [웹 채팅](docs/chat.md)
- [웹 채팅 AI 통합](docs/ai-integration.md)
- [데이터베이스](docs/database.md)
- [개발 환경](docs/development.md)

## 라이선스

MIT — [LICENSE](LICENSE)
