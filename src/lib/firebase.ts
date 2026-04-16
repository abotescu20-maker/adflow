import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  Firestore,
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

// Use long polling to avoid WebChannel issues behind corporate proxies and
// in some Chrome profiles (fixes "client is offline" errors)
export const db: Firestore = isNewApp
  ? initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    })
  : getFirestore(firebaseApp);

export const storage: FirebaseStorage = getStorage(firebaseApp);
