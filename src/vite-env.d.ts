/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** 'true' 이면 내 컴퓨터의 Firebase 에뮬레이터에 붙는다. */
  readonly VITE_USE_EMULATOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
