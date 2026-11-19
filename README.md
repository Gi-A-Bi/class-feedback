# 발표 평가 프로그램

초등학교 수업에서 학생들이 친구의 발표를 듣고 평가하는 웹 프로그램입니다.
기획 내용은 [CLAUDE.md](./CLAUDE.md)에 있습니다.

지금은 **개발 1단계**(프로젝트 뼈대 + Firebase 연결 + Vercel 배포)까지 되어 있습니다.
주소를 열면 "1단계 확인 화면"이 나오고, 거기서 Firebase 연결을 직접 시험해 볼 수 있습니다.

---

## 1단계에서 선생님이 직접 하셔야 하는 설정

컴퓨터 지식은 필요 없습니다. 아래 순서대로 눌러 주시면 됩니다.
화면의 메뉴 이름은 한국어와 영어를 같이 적어 두었습니다. Firebase 콘솔은
오른쪽 위에서 언어를 한국어로 바꿀 수 있습니다.

### A. Firebase 프로젝트 만들기

1. <https://console.firebase.google.com> 에 학교 구글 계정으로 로그인합니다.
2. **프로젝트 만들기(Create a project)** 를 누릅니다.
3. 프로젝트 이름을 적습니다. (예: `class-feedback`) 이름은 나중에 바꿀 수 있지만,
   그 아래 자동으로 만들어지는 **프로젝트 ID**는 나중에 못 바꾸니 그대로 두셔도 됩니다.
4. 약관에 동의하고 **계속(Continue)** 을 누릅니다.
5. **Google 애널리틱스(Google Analytics)** 는 **사용하지 않음**으로 두셔도 됩니다.
   이 프로그램에는 필요 없습니다.
6. **프로젝트 만들기(Create project)** 를 누르고 끝날 때까지 기다립니다.

### B. 웹 앱 등록하고 설정값 받기

1. 프로젝트 첫 화면 가운데에 있는 **웹(`</>`)** 아이콘을 누릅니다.
   (이미 앱을 만든 적이 있다면 **앱 추가(Add app)** → 웹)
2. 앱 닉네임을 적습니다. (예: `발표 평가`) 선생님만 보는 이름입니다.
   "Firebase 호스팅(Firebase Hosting)" 체크는 **하지 않습니다.** (배포는 Vercel로 합니다.)
3. **앱 등록(Register app)** 을 누릅니다.
4. 다음 화면에 `const firebaseConfig = { ... }` 라는 글상자가 나옵니다.
   여기 있는 값들을 **메모장에 복사해 두세요.** 뒤에서 씁니다.
   나중에 다시 보려면 **⚙ 프로젝트 설정(Project settings) → 내 앱(Your apps)** 에 있습니다.

이 프로그램에서 쓰는 값은 네 가지입니다.

| 메모해 둘 값 | 환경 변수 이름 |
| --- | --- |
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

> 이 값들은 비밀번호가 아닙니다. 웹 주소처럼 누구나 볼 수 있는 값이고,
> 실제 보안은 다음 단계에서 만들 **보안 규칙**이 맡습니다.

### C. Firestore 데이터베이스 만들기 (지역이 중요합니다)

1. 왼쪽 메뉴에서 **빌드(Build) → Firestore Database** 를 누릅니다.
2. **데이터베이스 만들기(Create database)** 를 누릅니다.
3. **위치(Location)** 에서 **`asia-northeast3` (Seoul / 서울)** 을 고릅니다.
   **이 지역은 나중에 바꿀 수 없으니** 꼭 확인하고 넘어가 주세요.
4. 규칙은 **프로덕션 모드(Production mode / 잠금 모드)** 로 시작합니다.
   지금은 아무도 읽고 쓸 수 없는 상태가 맞습니다. 2단계에서 규칙을 넣습니다.
5. **만들기(Create)** 를 누릅니다.

### D. 로그인 방법 켜기

1. 왼쪽 메뉴에서 **빌드(Build) → Authentication** 을 누르고 **시작하기(Get started)** 를 누릅니다.
2. **로그인 방법(Sign-in method)** 탭으로 갑니다.
3. **Google** 을 고르고 **사용 설정(Enable)** 을 켠 뒤, 프로젝트 지원 이메일을 고르고 **저장(Save)**.
   → 선생님 로그인에 씁니다.
4. 다시 **새 제공업체 추가(Add new provider)** 에서 **익명(Anonymous)** 을 고르고
   **사용 설정(Enable)** 을 켠 뒤 **저장(Save)**.
   → 학생이 계정 없이 들어오게 하는 데 씁니다.

### E. Vercel에 올리기

1. <https://vercel.com> 에 **GitHub 계정으로** 로그인합니다.
2. **Add New… → Project** 를 누르고 이 저장소(`class-feedback`)를 고릅니다.
3. Framework Preset이 **Vite** 로 잡혔는지 확인합니다. 나머지는 그대로 둡니다.
4. **Environment Variables** 를 펼쳐서, B에서 메모해 둔 값 네 개를 위 표의
   환경 변수 이름으로 하나씩 넣습니다.
5. **Deploy** 를 누릅니다. 1~2분 뒤 `무엇무엇.vercel.app` 주소가 나옵니다.

### F. 그 주소를 Firebase에 등록하기 (이걸 빠뜨리면 로그인이 안 됩니다)

1. Firebase 콘솔 → **Authentication → 설정(Settings) → 승인된 도메인(Authorized domains)**
2. **도메인 추가(Add domain)** 를 누르고 E에서 받은 주소를 넣습니다.
   `https://` 없이 `무엇무엇.vercel.app` 만 넣으면 됩니다.

### G. 확인하기

1. Vercel 주소를 엽니다.
2. 세 줄이 모두 초록색 체크면 성공입니다.
   마지막 줄은 **Firebase 연결 시험하기** 버튼을 눌러야 초록색이 됩니다.
3. 빨간 줄이 있으면 화면에 무엇을 고쳐야 하는지 한국어로 나옵니다.
4. **학생 태블릿을 학교 네트워크에 연결해서 같은 주소가 열리는지** 꼭 확인해 주세요.
   학교 망에서 막히는 경우가 있어서, 다음 단계로 가기 전에 미리 알아야 합니다.

---

## 개발자용 메모

```bash
npm install
cp .env.example .env   # 값을 채운다
npm run dev            # 개발 서버
npm run build          # 타입 검사 + 빌드
npm run lint
```

- 기술 구성: Vite + React + TypeScript, Firebase(Firestore + Authentication), Vercel 배포
- 서버 코드 없음. Cloud Functions와 Cloud Storage는 쓰지 않는다(Spark 무료 요금제).
- 색·글꼴·치수 같은 디자인 값은 `src/styles/tokens.css` 한 곳에만 둔다.
- `.env` 는 커밋하지 않는다. 실제 값은 Vercel 환경 변수에도 같이 넣어야 한다.
- `vercel.json` 의 rewrites는 SPA 깊은 링크(새로고침)가 404가 되지 않게 한다.

### 다음 단계

2단계: 교사 Google 로그인, 학급·명단 관리, Firestore 보안 규칙 첫 버전.
