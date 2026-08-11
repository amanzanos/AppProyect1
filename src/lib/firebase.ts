import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Whether there is a Firebase project behind this build at all.
 *
 * The solo games never touch Firebase, so the app is entirely playable
 * without one — which is exactly how it ships before a project exists. The
 * two-player games do need it, and they check this and say so.
 */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/**
 * Nothing is initialised unless there is real config. `getAuth()` throws
 * `auth/invalid-api-key` the moment it is called with a blank key, and
 * because that happens while the module is being imported it takes the whole
 * route down with it — a white "this page couldn't load" screen, before any
 * component has had the chance to check anything.
 */
function start(): FirebaseApp | null {
  if (!firebaseConfigured) return null;
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

const app = start();

export const auth: Auth | null = app ? getAuth(app) : null;

function firestore(instance: FirebaseApp): Firestore {
  // Conditionally-undefined fields make Firestore's SDK throw on write unless
  // this is set.
  try {
    return initializeFirestore(instance, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(instance);
  }
}

/**
 * Typed as a real Firestore for the benefit of every call site, but null when
 * unconfigured. Every path that reaches it is behind `firebaseConfigured`, so
 * the lie never gets to be true at runtime.
 */
export const db: Firestore = (app ? firestore(app) : null) as Firestore;
