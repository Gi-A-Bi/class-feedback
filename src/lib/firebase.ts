// Firebase 연결. 설정값은 모두 환경 변수(VITE_FIREBASE_*)에서 읽는다.
// 공식 문서 확인: https://firebase.google.com/docs/web/setup
//   - initializeApp: 'firebase/app'
//   - getFirestore:  'firebase/firestore'
//   - getAuth:       'firebase/auth'
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

/**
 * 웹 앱에 필요한 설정값.
 * 문서의 config 객체에서 필수 항목은 apiKey, projectId, appId이고
 * Authentication에는 authDomain이 필요하다.
 * storageBucket과 messagingSenderId는 Cloud Storage와 푸시 알림용이라
 * 이 프로그램에서는 쓰지 않으므로 받지 않는다.
 */
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** 비어 있는 환경 변수의 이름 목록. 비어 있지 않으면 설정이 덜 된 것이다. */
export function missingConfigKeys(): string[] {
  return REQUIRED_KEYS.filter((key) => !firebaseConfig[key]).map(
    (key) => 'VITE_FIREBASE_' + key.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase(),
  )
}

export const isConfigured = missingConfigKeys().length === 0

let app: FirebaseApp | undefined
let authInstance: Auth | undefined
let dbInstance: Firestore | undefined

function getApp(): FirebaseApp {
  if (!isConfigured) {
    throw new Error('Firebase 설정값이 없습니다: ' + missingConfigKeys().join(', '))
  }
  app ??= initializeApp(firebaseConfig)
  return app
}

/**
 * 내 컴퓨터에서 에뮬레이터로 시험할 때만 켠다(VITE_USE_EMULATOR=true).
 * 실제 배포에서는 이 값이 없으므로 진짜 Firebase에 붙는다.
 */
const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'

export function getAuthClient(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getApp())
    if (useEmulator) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true })
    }
  }
  return authInstance
}

export function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getApp())
    if (useEmulator) {
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080)
    }
  }
  return dbInstance
}

/** 화면에 보여 줄 프로젝트 id. 설정이 없으면 undefined. */
export const projectId: string | undefined = firebaseConfig.projectId
