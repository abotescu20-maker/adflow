export type AssetType = "video" | "image" | "audio" | "document";
export type ApprovalStatus = "brief" | "production" | "review" | "revision" | "approved" | "delivered";
export type CommentVisibility = "public" | "team";

export interface Campaign {
  id: string;
  name: string;
  client: string;
  brand: string;
  status: ApprovalStatus;
  dueDate: string;
  thumbnail: string;
  assetsCount: number;
  progress: number;
  platforms: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  folder: string;
  thumbnail: string;
  duration?: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  status: ApprovalStatus;
  version: number;
  comments: number;
  width?: number;
  height?: number;
  format?: string;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  count: number;
  children?: Folder[];
}

export interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: string;
  timecode?: string;
  visibility: CommentVisibility;
  resolved: boolean;
  replies?: Comment[];
}

export interface Deliverable {
  id: string;
  platform: string;
  format: string;
  dimensions: string;
  duration: string;
  status: "pending" | "rendering" | "ready" | "delivered";
  assetId?: string;
}
