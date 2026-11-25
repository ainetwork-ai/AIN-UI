# AIN-UI: A2UI 1.0 전환과 플레이그라운드 기능 적용 계획

작성 2026-11-25. 기준: [a2ui.open.bot](https://a2ui.open.bot/) (CopilotKit의 A2UI 플레이그라운드)의 기능을
AIN-UI에 모두 적용하고, 같은 기능의 데모 사이트를 `ainui.ainetwork.xyz` 에 올린다.

## 1. 확인한 사실

| 항목 | 내용 |
| --- | --- |
| A2UI 1.0 | a2ui.org 에 "Current" 로 공개된 실제 명세. v0.9 / v0.9.1 은 "previous". |
| AIN-UI 현재 | 0.3.0, `@a2ui/react` 0.11.1 + `@a2ui/web_core` 0.11.0 고정, 메시지에 `"version": "v0.9"`. 소스 약 2,700줄. |
| 공식 패키지 | `@a2ui/web_core` 0.16.1 에 `./v1_0` 진입점이 있다. `@a2ui/react` 0.16.1 에는 `./v0_8`, `./v0_9` 만 있다. |
| 플레이그라운드 렌더러 | CopilotKit 자체 렌더러(`@copilotkit/react-core` 1.85.0). `@a2ui/react` 와 다른 라이브러리. |
| Express 형식 | 컴포넌트당 한 줄. Google `@a2ui/agent`(npm 최신 0.2.1)가 JSON 으로 컴파일. |
| 플레이그라운드 자체 평가 | 유효 렌더율 Express 67~83%, JSON 100% (2026-10-29, 요청 12건). |

확인하지 못한 것: 플레이그라운드 소스의 라이선스, 1.0 액션·기능 협상 메시지의 전체 JSON, Express 정식 문법,
`web_core` 1.0 API 의 실제 모양. 각 단계 착수 때 명세 원문과 패키지 소스로 확인한다.

## 2. 플레이그라운드 기능과 AIN-UI 의 격차

| 플레이그라운드 | AIN-UI 현재 | 할 일 |
| --- | --- | --- |
| A2UI 1.0 메시지 | v0.9 | 3단계 |
| 브라우저가 카탈로그를 실행마다 보냄 | 고정 카탈로그 ID + `X-AINUI: 1` 옵트인 | 5단계 |
| 표준 컴포넌트 69개 | 기본 카탈로그 + AIN 고유 11개 | 5단계 |
| 매크로 3개 (서버에서 펼침) | 없음 | 5단계 |
| `render_ui` 도구 자동 부착 | 생산자 함수(`ainuiFolder` 등)를 호스트가 직접 호출 | 6단계 |
| Express + JSON 대체 | JSON 만 | 6단계 |
| 스킬 내려받기 (`/api/skills`) | 없음 | 6단계 |
| 평가 페이지 (`/evals`) | 없음 | 6단계 |
| 클릭 → 에이전트 → 같은 화면 갱신 | 액션 전달은 있음, 제자리 갱신은 호스트 몫 | 4단계 |
| 디자인 시스템 고르기 | 단일 스타일 | 5단계 |
| 데모 사이트 | 없음 | 7단계 |

## 3. 프로토콜 1.0 전환 (AIN-UI 1.0.0)

- `"version": "1.0"`. `createSurface` 에 `components`, `dataModel` 을 함께 싣는 형태 지원. `theme` 제거.
- 바인딩: `{path}` → `{"@path"}`, `call` → `@call`, `checks` → `@checks`, `accessibility` → `@accessibility`.
  명세가 일괄 치환을 금지한다(`updateDataModel.path`, 템플릿 `path` 는 그대로). 위치별 변환기를 만든다.
- `updateDataModel.value` 필수, `null` 이 삭제. 같은 `surfaceId` 재생성은 `deleteSurface` 없이는 오류.
- MIME `application/a2ui+json`.
- 카탈로그를 1.0 형식으로 다시 쓴다: `protocolVersion: "1.0"`, 함수는 이름 맵, `allowedParents`/`allowedChildren`,
  컴포넌트별 `instructions`. 기존 ID(`https://aindrive.ainetwork.ai/ainui/v1/catalog.json`)는 v0.9 용으로 유지하고
  v2 ID 를 새로 발급한다.
- 기본 컴포넌트 변경 반영: `Text.variant` 축소(제목은 마크다운), `TextField` 검증은 `@checks`, `TextField.value` 필수.
- v0.9 → 1.0 변환기(`upgradeMessages`)를 넣어 기존 생산자의 메시지도 그려지게 한다.

완료 기준: 기존 테스트(`test/*.test.ts`)가 1.0 메시지로 통과하고, v0.9 고정 입력이 변환기를 거쳐 같은 화면을 낸다.

## 4. 렌더러

- React: `@a2ui/web_core` 0.16.1 `./v1_0` 처리기 위에 React 바인딩을 직접 얹는다. 공식 `@a2ui/react` 가 1.0 을 내면
  교체할 수 있게 경계를 얇게 둔다.
- DOM 렌더러(`src/renderer.js`)도 같은 1.0 처리로 맞춘다.
- 액션 왕복: 클릭 → `action` → 에이전트 → `updateComponents`/`updateDataModel` 로 같은 화면 갱신.
- 1.0 의 함수 호출 메시지(`callRendererFunction`, `rendererFunctionResponse`, `callAgentFunction`,
  `agentFunctionResponse`)는 처리기를 넣고, 카탈로그 함수는 필요한 것부터 연다.

위험: React 1.0 바인딩이 가장 큰 미지수다. 3단계 전에 하루짜리 시제품으로 `web_core` 1.0 API 를 확인한다.

## 5. 카탈로그

- 렌더러가 지원 카탈로그 ID 와 인라인 카탈로그를 알리고, 에이전트는 그 안에서만 UI 를 짠다.
  `X-AINUI: 1`, `forwardedProps.ainui`, `metadata.ainui` 옵트인은 호환용으로 남긴다.
- 표준 69개 전부를 이름·속성까지 맞춘다(그쪽 에이전트 출력도 그릴 수 있게). 순서:
  1. Table, Tabs, Modal, Form 입력류, Markdown/Code, Badge, Link
  2. Carousel, Citation, LinkCard, FollowUp, EntityCard, ImageGrid, Popover, Tooltip
  3. Chart, Map, Math, Svg, HtmlView (외부 라이브러리가 필요한 것)
- AIN 고유 컴포넌트(Toolbar, Grid, Tile, FileView, Breadcrumbs, Segmented, FileUpload, X402Payment, FolderChat,
  FilePicker, AgentPicker)를 1.0 스키마로 옮긴다. `{$asset}` 참조와 x402 흐름은 그대로 둔다.
- 매크로: `defineMacro({name, props, events, expand})`. 첫 매크로는 FileCard, PaymentCard, AgentCard.
- 스타일을 토큰화해 같은 카탈로그를 여러 디자인 시스템으로 그린다(AIN 기본 + 1개 이상).
- `exportCatalog()` 로 1.0 카탈로그 문서를 내보낸다(`dist/catalog.json`).

## 6. 에이전트 쪽

- `render_ui` 도구: 요청에 카탈로그가 실려 오면 도구와 카탈로그 안내문을 실행에 붙인다. ainize 호스팅 에이전트
  런타임(ainize-node)에 넣는다.
- Express: `@a2ui/agent` 로 컴파일, 재시도 후에도 실패하면 JSON 으로 다시 받는다.
- 스킬 내보내기: 카탈로그에서 에이전트용 스킬 파일 생성(Express 판, JSON 판).
- 평가: 요청 12건 이상 × 모델(GLM-5.3-Flash, Qwen3.8-Flash-Next) × 형식(Express, JSON). 유효 렌더율과 컴포넌트
  선택 정확도를 잰다. 기본 형식은 이 결과로 정하고, 그 전까지는 JSON.

## 7. 데모 사이트 — ainui.ainetwork.xyz

기능은 플레이그라운드와 같게 하고, 화면과 브랜드는 AIN 것으로 한다(CopilotKit 의 디자인·문구를 복제하지 않는다).

| 경로 | 내용 |
| --- | --- |
| `/` | 채팅으로 UI 요청 → 렌더. 옆 창에 Express/JSON 원문과 소요 시간. 모델·형식·디자인 시스템 선택, `?embed=1`. |
| `/components` | 컴포넌트별 문서와 실제 렌더 예시, 매크로 페이지. |
| `/start` | 자기 앱에 붙이는 설치 안내. |
| `/evals` | 6단계 평가 결과. |
| `/watch` | 녹화된 실행을 모델 호출 없이 재생. |
| `/catalog.json` | A2UI 1.0 카탈로그. |
| `/api/skills` | 스킬 내려받기 (`?format=express|json&download=1`). |
| `/api/run` | 에이전트 실행(AG-UI 스트림). |

AIN 고유 시연: 파일 그리드, 업로드, x402 결제 화면(모의 결제).

한도: 실행당 모델 호출 4회, 시간·일 단위 실행 예산, 요청당 컴포넌트 1,000개.

### 배포: 저장소의 `ainize.json`

데모는 이 저장소의 `demo/` 에 두고, 저장소 루트의 `ainize.json` 으로 배포한다. GitHub Actions 는 쓰지 않는다.
`checks` 가 CI 를 대신한다. GitHub `main` → AinDrive 동기화 → ainize 배포.

```json
{
  "name": "ainui",
  "kind": "service",
  "build": { "dockerfile": "demo/Dockerfile.ainize", "context": ".", "timeoutMinutes": 20 },
  "port": 3000,
  "healthcheck": { "path": "/api/health", "status": [200], "timeoutSeconds": 180 },
  "access": "public",
  "env": {
    "NODE_ENV": "production",
    "AINUI_PUBLIC_URL": "https://ainui.ainetwork.xyz",
    "AINUI_MODEL": "GLM-5.3-Flash",
    "AINUI_SMALL_MODEL": "Qwen3.8-Flash-Next",
    "AINUI_MAX_MODEL_CALLS": "4"
  },
  "secrets": ["AINIZE_API_KEY"],
  "requiredSecrets": ["AINIZE_API_KEY"],
  "allowedHosts": ["ainize.ai"],
  "resources": { "memory": "1g", "cpus": 1, "pids": 256 },
  "checks": [
    { "name": "build", "command": ["npm", "--prefix", "/app", "run", "build"], "timeoutSeconds": 600 },
    { "name": "tests", "command": ["npm", "--prefix", "/app", "test"], "timeoutSeconds": 900 }
  ]
}
```

- 모델 호출은 `ainize` SDK 와 이 프로젝트 전용 키(`AINIZE_API_KEY`, 프로젝트 비밀값)로 한다.
- 도메인 `ainui.ainetwork.xyz` 는 프로젝트 설정에서 연결한다.
- 필드 이름은 기존 프로젝트(AINHarness, AIN Proj)의 `ainize.json` 을 따랐다. 착수 때 ainize 문서로 다시 확인한다.

## 8. 기존 사용처 이전

- aindrive, ainmem: AIN-UI 1.0 으로 올리고 v0.9 변환기가 켜진 상태에서 화면이 같은지 확인한 뒤 생산자를 1.0 으로 바꾼다.
- ainize 호스팅 에이전트의 A2UI 출력(동아 기사 리뷰 등), AIN Teams 표시: 어느 버전을 쓰는지 아직 대조하지 않았다.
  이 단계의 첫 작업으로 조사한다.

## 9. 순서

1. React 1.0 시제품 (하루)
2. 3단계 프로토콜 → 4단계 렌더러 → AIN-UI 1.0.0-rc
3. 데모 최소판: `/`, `/catalog.json`, `ainize.json` 배포, 도메인 연결
4. 5단계 카탈로그 (순서 1 → 2 → 3), `/components`
5. 6단계 에이전트 쪽, `/evals`, `/api/skills`, `/watch`, `/start`
6. 8단계 이전, AIN-UI 1.0.0

데모를 일찍 띄워 이후 단계의 검증 도구로 쓴다.
