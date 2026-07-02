// Synthetic demo data seeder — creates realistic ad post-production campaigns
// with assets, tags, ratings, comments, and activity entries so the UI can be
// tested end-to-end without waiting for real uploads.

import { addDoc, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assetsRef, assetVersionsRef } from "@/lib/firestore/assets";
import { campaignsRef, updateCampaign } from "@/lib/firestore/campaigns";
import { collectionsRef } from "@/lib/firestore/collections";
import { activityRef } from "@/lib/firestore/activity";
import type {
  ApprovalStatus,
  AssetType,
  ActivityAction,
} from "@/lib/schema";

// Public sample media for demo (Google-hosted CC/free content)
const SAMPLE_VIDEOS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
];

// BBC sound effects are permanent, stable public URLs
const SAMPLE_AUDIO =
  "https://sound-effects-media.bbcrewind.co.uk/mp3/NHU05040023.mp3";

function pickVideoUrl(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SAMPLE_VIDEOS[h % SAMPLE_VIDEOS.length];
}

function pickImageUrl(seed: string, w = 1080, h = 1080): string {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return `https://picsum.photos/seed/${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "adflow"}/${w}/${h}`;
}

function pickThumbnail(seed: string): string {
  return pickImageUrl(seed + "thumb", 640, 360);
}

interface SeedContext {
  workspaceId: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
}

// -------- Template data --------

const DEMO_CAMPAIGNS: Array<{
  name: string;
  client: string;
  brand: string;
  description: string;
  status: ApprovalStatus;
  progress: number;
  dueInDays: number;
  platforms: string[];
}> = [
  {
    name: "Summer Refresh — 2026",
    client: "Dryp Beverages",
    brand: "Dryp",
    description: "Q2 campaign for new sparkling water line. TikTok-first, cross-platform kit.",
    status: "review",
    progress: 70,
    dueInDays: 9,
    platforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
  },
  {
    name: "Winter Flagship Launch",
    client: "Aurora Sports",
    brand: "Aurora",
    description: "Hero film + 9 cutdowns for flagship parka. Broadcast + digital.",
    status: "production",
    progress: 40,
    dueInDays: 21,
    platforms: ["YouTube", "Instagram", "Broadcast"],
  },
  {
    name: "Back-to-School 2026",
    client: "Stellar Laptops",
    brand: "Stellar",
    description: "Student targeted spots. Price point hero + feature explainers.",
    status: "approved",
    progress: 95,
    dueInDays: -2,
    platforms: ["Instagram Reels", "TikTok", "YouTube Shorts"],
  },
  {
    name: "Holiday Gifting Campaign",
    client: "Lumière Cosmetics",
    brand: "Lumière",
    description: "Gift-set showcase + UGC-style testimonials for holiday window.",
    status: "brief",
    progress: 10,
    dueInDays: 45,
    platforms: ["Instagram", "Pinterest", "TikTok"],
  },
];

interface AssetTemplate {
  name: string;
  type: AssetType;
  folder: string;
  status: ApprovalStatus;
  tags: string[];
  rating?: number;
  comments: number;
  unresolved: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  sizeMB: number;
  versions?: number;
  priority?: "low" | "normal" | "high" | "urgent";
}

const ASSET_POOL: Record<string, AssetTemplate[]> = {
  "Summer Refresh — 2026": [
    {
      name: "Hero_Beach_Take3.mov",
      type: "video",
      folder: "footage",
      status: "review",
      tags: ["hero", "beach", "TikTok"],
      rating: 4,
      comments: 7,
      unresolved: 2,
      durationSeconds: 42,
      width: 1080,
      height: 1920,
      sizeMB: 240,
      versions: 3,
      priority: "high",
    },
    {
      name: "Product_Pour_Closeup.mov",
      type: "video",
      folder: "footage",
      status: "approved",
      tags: ["product", "macro"],
      rating: 5,
      comments: 3,
      unresolved: 0,
      durationSeconds: 12,
      width: 3840,
      height: 2160,
      sizeMB: 485,
      versions: 1,
    },
    {
      name: "Brand_Logo_Bug.ai",
      type: "image",
      folder: "graphics",
      status: "approved",
      tags: ["logo", "brand"],
      comments: 1,
      unresolved: 0,
      width: 2048,
      height: 2048,
      sizeMB: 2.3,
    },
    {
      name: "Summer_Vibes_Track.wav",
      type: "audio",
      folder: "sound",
      status: "review",
      tags: ["music", "upbeat"],
      rating: 3,
      comments: 4,
      unresolved: 2,
      durationSeconds: 45,
      sizeMB: 12.4,
      versions: 2,
    },
    {
      name: "Cutdown_15s_v4.mp4",
      type: "video",
      folder: "edits",
      status: "revision",
      tags: ["cutdown", "15s", "IG"],
      rating: 3,
      comments: 9,
      unresolved: 5,
      durationSeconds: 15,
      width: 1080,
      height: 1080,
      sizeMB: 22,
      versions: 4,
      priority: "urgent",
    },
    {
      name: "Client_Brief_v2.pdf",
      type: "document",
      folder: "briefs",
      status: "approved",
      tags: ["brief", "client"],
      comments: 0,
      unresolved: 0,
      sizeMB: 1.8,
    },
  ],
  "Winter Flagship Launch": [
    {
      name: "Hero_Mountain_Take5.mov",
      type: "video",
      folder: "footage",
      status: "production",
      tags: ["hero", "mountain", "drone"],
      rating: 5,
      comments: 12,
      unresolved: 3,
      durationSeconds: 58,
      width: 3840,
      height: 2160,
      sizeMB: 820,
      versions: 2,
      priority: "high",
    },
    {
      name: "Studio_Product_PackShot.mov",
      type: "video",
      folder: "footage",
      status: "approved",
      tags: ["product", "studio"],
      rating: 4,
      comments: 2,
      unresolved: 0,
      durationSeconds: 8,
      width: 3840,
      height: 2160,
      sizeMB: 210,
    },
    {
      name: "Hero_Edit_30s_v2.mp4",
      type: "video",
      folder: "edits",
      status: "review",
      tags: ["hero", "30s", "broadcast"],
      rating: 4,
      comments: 6,
      unresolved: 1,
      durationSeconds: 30,
      width: 1920,
      height: 1080,
      sizeMB: 95,
      versions: 2,
    },
    {
      name: "Snowfall_Foley.wav",
      type: "audio",
      folder: "sound",
      status: "production",
      tags: ["foley", "ambient"],
      comments: 1,
      unresolved: 1,
      durationSeconds: 120,
      sizeMB: 38.5,
    },
    {
      name: "Style_Frame_01.jpg",
      type: "image",
      folder: "graphics",
      status: "approved",
      tags: ["style-frame"],
      rating: 4,
      comments: 0,
      unresolved: 0,
      width: 1920,
      height: 1080,
      sizeMB: 4.2,
    },
  ],
  "Back-to-School 2026": [
    {
      name: "Campus_Montage_Final.mp4",
      type: "video",
      folder: "final",
      status: "delivered",
      tags: ["final", "montage"],
      rating: 5,
      comments: 18,
      unresolved: 0,
      durationSeconds: 29,
      width: 1920,
      height: 1080,
      sizeMB: 112,
      versions: 3,
    },
    {
      name: "Feature_Keyboard_15s.mp4",
      type: "video",
      folder: "final",
      status: "delivered",
      tags: ["feature", "keyboard"],
      rating: 4,
      comments: 5,
      unresolved: 0,
      durationSeconds: 15,
      width: 1080,
      height: 1080,
      sizeMB: 32,
    },
    {
      name: "Price_Reveal_9x16.mp4",
      type: "video",
      folder: "final",
      status: "approved",
      tags: ["price", "TikTok", "9x16"],
      rating: 5,
      comments: 2,
      unresolved: 0,
      durationSeconds: 15,
      width: 1080,
      height: 1920,
      sizeMB: 28,
    },
    {
      name: "Graphic_Price_Card.psd",
      type: "image",
      folder: "graphics",
      status: "approved",
      tags: ["price-card"],
      comments: 0,
      unresolved: 0,
      width: 1080,
      height: 1920,
      sizeMB: 68,
    },
  ],
  "Holiday Gifting Campaign": [
    {
      name: "Creative_Brief.pdf",
      type: "document",
      folder: "briefs",
      status: "brief",
      tags: ["brief"],
      comments: 2,
      unresolved: 2,
      sizeMB: 2.1,
    },
    {
      name: "Reference_Moodboard.jpg",
      type: "image",
      folder: "graphics",
      status: "brief",
      tags: ["moodboard", "reference"],
      comments: 1,
      unresolved: 1,
      width: 2048,
      height: 2732,
      sizeMB: 8.6,
    },
  ],
};

const COLLECTION_PRESETS = [
  {
    name: "Awaiting Approval",
    icon: "clock",
    color: "#f59e0b",
    description: "Assets sent for client review",
    filters: { status: ["review"] as ApprovalStatus[] },
    pinned: true,
  },
  {
    name: "Approved Assets",
    icon: "check",
    color: "#10b981",
    description: "Signed off by the client",
    filters: { status: ["approved"] as ApprovalStatus[] },
    pinned: true,
  },
  {
    name: "Changes Requested",
    icon: "alert",
    color: "#ef4444",
    description: "Needs rework before next round",
    filters: { status: ["revision"] as ApprovalStatus[] },
    pinned: true,
  },
  {
    name: "Delivered",
    icon: "sparkles",
    color: "#8b5cf6",
    description: "Final deliverables shipped",
    filters: { status: ["delivered"] as ApprovalStatus[] },
    pinned: true,
  },
];

// -------- Seeder --------

export async function seedDemoData(ctx: SeedContext): Promise<void> {
  const { workspaceId, uid, displayName, photoURL } = ctx;

  // 1. Collections
  for (const preset of COLLECTION_PRESETS) {
    await addDoc(collectionsRef(workspaceId), {
      workspaceId,
      name: preset.name,
      description: preset.description,
      icon: preset.icon,
      color: preset.color,
      filters: preset.filters,
      pinned: preset.pinned,
      createdBy: uid,
      createdByName: displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 2. Campaigns with assets
  for (const c of DEMO_CAMPAIGNS) {
    const due = new Date();
    due.setDate(due.getDate() + c.dueInDays);

    const campaignDocRef = await addDoc(campaignsRef(workspaceId), {
      workspaceId,
      name: c.name,
      client: c.client,
      brand: c.brand,
      description: c.description,
      status: c.status,
      dueDate: Timestamp.fromDate(due),
      platforms: c.platforms,
      thumbnailURL: null,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      assetsCount: 0,
      commentsCount: 0,
      progress: c.progress,
    });

    const templates = ASSET_POOL[c.name] || [];
    let assetsCreated = 0;
    let commentsTotal = 0;

    for (const t of templates) {
      const sizeBytes = Math.round(t.sizeMB * 1024 * 1024);
      const versions = t.versions || 1;

      // Pick REAL sample media URLs so the viewer can actually play/display
      const seedKey = `${c.name}-${t.name}`;
      let mediaUrl = "";
      let thumbUrl: string | null = null;
      if (t.type === "video") {
        mediaUrl = pickVideoUrl(seedKey);
        thumbUrl = pickThumbnail(seedKey);
      } else if (t.type === "image") {
        mediaUrl = pickImageUrl(seedKey, t.width || 1080, t.height || 1080);
        thumbUrl = mediaUrl;
      } else if (t.type === "audio") {
        mediaUrl = SAMPLE_AUDIO;
        thumbUrl = null;
      } else {
        // PDF / document — leave empty but placeholder thumbnail
        thumbUrl = null;
      }

      const assetDocRef = await addDoc(
        assetsRef(workspaceId, campaignDocRef.id),
        {
          workspaceId,
          campaignId: campaignDocRef.id,
          name: t.name,
          type: t.type,
          folder: t.folder,
          status: t.status,
          processingStatus: "ready",
          version: versions,
          versionCount: versions,
          parentAssetId: null,
          storagePath: mediaUrl,
          originalFileName: t.name,
          sizeBytes,
          mimeType:
            t.type === "video"
              ? "video/mp4"
              : t.type === "image"
                ? "image/jpeg"
                : t.type === "audio"
                  ? "audio/mpeg"
                  : "application/pdf",
          width: t.width ?? null,
          height: t.height ?? null,
          durationSeconds: t.durationSeconds ?? null,
          format:
            t.type === "video"
              ? "H.264"
              : t.type === "image"
                ? "JPEG"
                : t.type === "audio"
                  ? "MP3"
                  : "PDF",
          thumbnailURL: thumbUrl,
          hlsManifestURL: null,
          previewURL: null,
          downloadURL: mediaUrl,
          tags: t.tags,
          rating: t.rating ?? null,
          assignedTo: null,
          assignedToName: null,
          assignedToAvatar: null,
          deadline: null,
          priority: t.priority ?? "normal",
          customFields: null,
          uploadedBy: uid,
          uploadedByName: displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          commentsCount: t.comments,
          unresolvedCommentsCount: t.unresolved,
          approvedBy: t.status === "approved" || t.status === "delivered" ? uid : null,
          approvedAt:
            t.status === "approved" || t.status === "delivered"
              ? serverTimestamp()
              : null,
        }
      );

      // Write version history docs (each version points to a different sample clip)
      for (let v = 1; v <= versions; v++) {
        const vDocRef = doc(assetVersionsRef(workspaceId, campaignDocRef.id, assetDocRef.id));
        const vMediaUrl =
          t.type === "video"
            ? pickVideoUrl(`${seedKey}-v${v}`)
            : t.type === "image"
              ? pickImageUrl(`${seedKey}-v${v}`, t.width || 1080, t.height || 1080)
              : t.type === "audio"
                ? SAMPLE_AUDIO
                : "";
        await setDoc(vDocRef, {
          assetId: assetDocRef.id,
          workspaceId,
          campaignId: campaignDocRef.id,
          version: v,
          storagePath: vMediaUrl,
          downloadURL: vMediaUrl,
          originalFileName: t.name,
          sizeBytes: Math.round(sizeBytes * (0.85 + v * 0.05)),
          mimeType:
            t.type === "video"
              ? "video/mp4"
              : t.type === "image"
                ? "image/jpeg"
                : t.type === "audio"
                  ? "audio/mpeg"
                  : "application/pdf",
          thumbnailURL: t.type === "video" || t.type === "image" ? pickThumbnail(`${seedKey}-v${v}`) : null,
          durationSeconds: t.durationSeconds ?? null,
          width: t.width ?? null,
          height: t.height ?? null,
          notes:
            v === versions
              ? null
              : v === 1
                ? "Initial upload"
                : `Revision ${v} — client notes addressed`,
          uploadedBy: uid,
          uploadedByName: displayName,
          createdAt: serverTimestamp(),
        });
      }

      // Log some activity for this asset
      const actions: ActivityAction[] = ["asset.uploaded"];
      if (t.status === "approved" || t.status === "delivered")
        actions.push("asset.approved");
      if (t.status === "revision") actions.push("asset.rejected");
      if (t.comments > 0) actions.push("comment.posted");
      for (const action of actions) {
        await addDoc(activityRef(workspaceId), {
          workspaceId,
          actorId: uid,
          actorName: displayName,
          actorAvatar: photoURL ?? null,
          action,
          targetType: action.startsWith("comment") ? "comment" : "asset",
          targetId: assetDocRef.id,
          targetName: t.name,
          campaignId: campaignDocRef.id,
          campaignName: c.name,
          assetId: assetDocRef.id,
          assetName: t.name,
          metadata: { seeded: true, demo: true },
          createdAt: serverTimestamp(),
        });
      }

      assetsCreated++;
      commentsTotal += t.comments;
    }

    // Update campaign counters + thumbnail from brand
    await updateCampaign(workspaceId, campaignDocRef.id, {
      assetsCount: assetsCreated,
      commentsCount: commentsTotal,
      progress: c.progress,
      thumbnailURL: pickImageUrl(`${c.name}-cover`, 800, 400),
    });

    // Campaign-level activity
    await addDoc(activityRef(workspaceId), {
      workspaceId,
      actorId: uid,
      actorName: displayName,
      actorAvatar: photoURL ?? null,
      action: "campaign.created" as ActivityAction,
      targetType: "campaign",
      targetId: campaignDocRef.id,
      targetName: c.name,
      campaignId: campaignDocRef.id,
      campaignName: c.name,
      metadata: { seeded: true, demo: true },
      createdAt: serverTimestamp(),
    });
  }
}
