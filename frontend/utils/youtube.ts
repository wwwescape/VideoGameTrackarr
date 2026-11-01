// YouTube's 11-character video id, the only part of a video VGT stores (like IGDB's videos).
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// The video id in anything someone might paste: a watch, share (youtu.be), Shorts, embed or
// live link, or the bare id itself. null when it isn't a YouTube video.
export function parseYoutubeVideoId(input: string): string | null {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    id = first === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(first) ? second : null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
