import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Fields like `text`/`imageUrl` are conditionally `undefined` depending on
// entry type; Firestore's SDK throws on those unless this is set, so writes
// like addCalendarEntry() would fail every time otherwise.
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
} catch {
  db = getFirestore(firebaseApp);
}
export { db };
