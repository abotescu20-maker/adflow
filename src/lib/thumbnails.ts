// Client-side thumbnail generation from a public media URL. Used to backfill
// thumbnails for assets uploaded before thumbnail-on-upload existed. Works because
// Vercel Blob asset URLs are public. Returns a JPEG Blob or null (best-effort).

const THUMB_MAX_W = 640;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
}

export async function thumbnailFromVideoUrl(url: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    const done = (b: Blob | null) => resolve(b);
    let settled = false;
    const finish = (b: Blob | null) => {
      if (settled) return;
      settled = true;
      done(b);
    };
    video.onloadedmetadata = () => {
      video.currentTime = isFinite(video.duration) ? Math.min(1, video.duration * 0.1) : 0;
    };
    video.onseeked = async () => {
      try {
        const scale = video.videoWidth ? Math.min(1, THUMB_MAX_W / video.videoWidth) : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(await canvasToJpeg(canvas));
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    // Safety timeout — some CORS/codecs never fire events.
    setTimeout(() => finish(null), 15000);
    video.src = url;
  });
}

export async function thumbnailFromImageUrl(url: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const scale = img.naturalWidth ? Math.min(1, THUMB_MAX_W / img.naturalWidth) : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(await canvasToJpeg(canvas));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 15000);
    img.src = url;
  });
}
