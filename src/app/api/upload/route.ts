import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// SECURITY (02.07.2026, H4): this route previously minted a Vercel Blob upload
// token for ANY request — the comment claimed the client was authenticated but
// nothing verified it. Anyone on the internet could push 500 MB files into the
// Blob store (cost abuse + malware hosting on our domain). We now verify the
// Firebase ID token the client sends as clientPayload against Google's Identity
// Toolkit (project-scoped by the public web API key — no service account needed,
// no new dependency). Anonymous/invalid tokens are rejected before a token is issued.
async function verifyFirebaseIdToken(idToken: string | null): Promise<string> {
  if (!idToken) throw new Error("Unauthorized: missing auth token");
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey)
    throw new Error("Server misconfigured: missing Firebase API key");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) throw new Error("Unauthorized: invalid auth token");
  const data = (await res.json()) as { users?: Array<{ localId?: string }> };
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error("Unauthorized: token did not resolve to a user");
  return uid;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Reject unauthenticated callers. The client sends its Firebase ID token
        // as clientPayload (see UploadDialog). Throwing here fails the request
        // before any upload token is generated.
        const uid = await verifyFirebaseIdToken(clientPayload);
        // Path must be workspace-scoped: workspaces/{workspaceId}/...
        const parts = pathname.split("/");
        if (parts[0] !== "workspaces" || !parts[1]) {
          throw new Error("Forbidden: upload path must be workspace-scoped");
        }
        const workspaceId = parts[1];
        // SECURITY (05.07.2026): the caller must be a MEMBER of that workspace —
        // an authenticated user must not be able to upload into someone else's
        // workspace by crafting the pathname. (Previously only auth was checked.)
        const member = await adminDb()
          .collection("workspaces")
          .doc(workspaceId)
          .collection("members")
          .doc(uid)
          .get();
        if (!member.exists) {
          throw new Error("Forbidden: not a member of this workspace");
        }
        return {
          allowedContentTypes: [
            "video/*",
            "image/*",
            "audio/*",
            "application/pdf",
            "application/postscript",
            "application/illustrator",
            "application/x-photoshop",
            "application/octet-stream",
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB per file
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname, uid }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Server-side side effects could go here.
        // For now, client saves asset metadata to Firestore after successful upload.
        console.log("Upload completed:", blob.pathname, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // 401 for auth failures so the client can distinguish; 400 otherwise.
    const msg = error instanceof Error ? error.message : "Upload failed";
    const status = /unauthorized|forbidden/i.test(msg) ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
