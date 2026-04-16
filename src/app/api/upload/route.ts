import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Client is authenticated via Firebase Auth; we accept any authenticated upload.
        // Path must be scoped to workspace: workspaces/{workspaceId}/campaigns/{campaignId}/{filename}
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
          tokenPayload: JSON.stringify({ pathname }),
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
