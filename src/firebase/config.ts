import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import appletConfig from "../../firebase-applet-config.json";

// Single source of truth: firebase-applet-config.json (these web keys are public by design;
// access is controlled by firestore.rules / storage.rules, not by hiding the key).
export const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
};

// This project stores its data in a *named* Firestore database, not "(default)".
// It can be overridden per environment with VITE_FIREBASE_FIRESTORE_DATABASE_ID.
const envDatabaseId = (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string | undefined)?.trim();
export const firestoreDatabaseId: string = envDatabaseId || appletConfig.firestoreDatabaseId || "(default)";

// Reuse the existing app during hot reloads instead of initialising twice.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createFirestore(): Firestore {
  const namedDatabase = firestoreDatabaseId !== "(default)";
  try {
    // ignoreUndefinedProperties: a stray `undefined` in CMS content must not make the whole save fail.
    const settings = { ignoreUndefinedProperties: true };
    return namedDatabase
      ? initializeFirestore(app, settings, firestoreDatabaseId)
      : initializeFirestore(app, settings);
  } catch {
    // Already initialised (hot reload) — fall back to the existing instance.
    return namedDatabase ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
  }
}

export const db = createFirestore();
export const auth = getAuth(app);
export const storage = getStorage(app);

export default { app, db, auth, storage };
