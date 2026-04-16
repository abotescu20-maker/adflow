import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isNewApp = getApps().length === 0;
export const firebaseApp: FirebaseApp = isNewApp ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(firebaseApp);

// Use auto-detect long polling to avoid WebChannel issues on some networks
// (fixes "client is offline" errors on regional Firestore instances)
export const db: Firestore = isNewApp
  ? initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
      localCache:
        typeof window !== "undefined"
          ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          : undefined,
    })
  : getFirestore(firebaseApp);

export const storage: FirebaseStorage = getStorage(firebaseApp);
