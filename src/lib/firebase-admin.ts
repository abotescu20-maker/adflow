import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Trusted server tier (02.07.2026). The client-only Firebase model has no place
// to safely perform operations that must NOT be exposed to the browser — chiefly
// resolving a public share token and writing a guest's comment/approval on their
// behalf (Firestore rules correctly forbid anonymous writes). This module boots
// the Admin SDK from a base64-encoded service-account key held ONLY in server env
// (FIREBASE_SERVICE_ACCOUNT_B64 — never NEXT_PUBLIC, never committed).
//
// The Admin SDK bypasses all security rules, so every route that uses it MUST
// validate authorization itself (see src/app/api/share/*).

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  const existing = getApps();
  if (existing.length) {
    _app = existing[0];
    return _app;
  }
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_B64 is not set — the server tier cannot start. " +
        "Add the base64 service-account key to the server environment."
    );
  }
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  _app = initializeApp({
    credential: cert({
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    }),
  });
  return _app;
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}
