import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Trusted server tier (02.07.2026). The client-only Firebase model has no place
// to safely perform operations that must NOT be exposed to the browser — chiefly
// resolving a public share token and writing a guest's comment/approval, and
// accepting workspace invitations. This module boots the Admin SDK for Firestore
// writes from a base64 service-account key in server env only
// (FIREBASE_SERVICE_ACCOUNT_B64 — never NEXT_PUBLIC, never committed).
//
// NOTE: we deliberately do NOT import `firebase-admin/auth`. Its transitive dep
// chain (jwks-rsa → jose) is ESM-only and blows up under the serverless CJS
// loader (ERR_REQUIRE_ESM). ID tokens are verified via the Identity Toolkit REST
// endpoint below instead, which needs no extra deps.

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
      "FIREBASE_SERVICE_ACCOUNT_B64 is not set — the server tier cannot start."
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

export interface VerifiedUser {
  uid: string;
  email: string;
  name: string;
  picture: string | null;
}

// Verify a Firebase ID token via the Identity Toolkit REST API (project-scoped by
// the public web API key). Returns the resolved user or throws.
export async function verifyIdToken(idToken: string | null | undefined): Promise<VerifiedUser> {
  if (!idToken) throw new Error("Missing auth token");
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Server misconfigured: missing Firebase API key");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) throw new Error("Invalid auth token");
  const data = (await res.json()) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string; photoUrl?: string }>;
  };
  const u = data.users?.[0];
  if (!u?.localId) throw new Error("Auth token did not resolve to a user");
  return {
    uid: u.localId,
    email: (u.email || "").toLowerCase(),
    name: u.displayName || u.email || "Member",
    picture: u.photoUrl || null,
  };
}
