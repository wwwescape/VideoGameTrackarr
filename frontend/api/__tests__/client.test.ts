import { describe, expect, it } from "vitest";
import { API_BASE_URL, resolveImageUrl } from "../client";

describe("resolveImageUrl", () => {
  it("asks IGDB for the given size instead of the stored one", () => {
    expect(
      resolveImageUrl("https://images.igdb.com/igdb/image/upload/t_720p/co6qqa.jpg", "t_cover_big")
    ).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co6qqa.jpg");
    expect(
      resolveImageUrl(
        "https://images.igdb.com/igdb/image/upload/t_1080p/el176.png",
        "t_screenshot_big"
      )
    ).toBe("https://images.igdb.com/igdb/image/upload/t_screenshot_big/el176.png");
  });

  it("replaces whatever size an older library stored", () => {
    expect(
      resolveImageUrl(
        "https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg",
        "t_cover_small"
      )
    ).toBe("https://images.igdb.com/igdb/image/upload/t_cover_small/co1.jpg");
    expect(
      resolveImageUrl("http://images.igdb.com/igdb/image/upload/t_thumb/co1.jpg", "t_cover_big")
    ).toBe("http://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg");
  });

  it("leaves uploaded covers and other sites' images alone", () => {
    expect(resolveImageUrl("/uploads/covers/abc.jpg", "t_cover_big")).toBe(
      `${API_BASE_URL}/uploads/covers/abc.jpg`
    );
    const wikimedia = "https://upload.wikimedia.org/wikipedia/en/t_720p/cover.jpg";
    expect(resolveImageUrl(wikimedia, "t_cover_big")).toBe(wikimedia);
    const unsized = "https://images.igdb.com/igdb/image/upload/co1.jpg";
    expect(resolveImageUrl(unsized, "t_cover_big")).toBe(unsized);
  });

  it("passes no image through", () => {
    expect(resolveImageUrl(null, "t_cover_big")).toBeNull();
    expect(resolveImageUrl("", "t_cover_big")).toBe("");
  });
});
