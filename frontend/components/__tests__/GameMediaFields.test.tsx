import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GameMediaFields, { EMPTY_GAME_MEDIA, type GameMediaValue } from "../GameMediaFields";

let uploadCount = 0;
const uploadGameMedia = vi.fn(async () => ({ url: `/uploads/game-media/${++uploadCount}.jpg` }));

vi.mock("../../hooks/useUploads", () => ({
  useUploadGameMedia: () => ({ mutateAsync: uploadGameMedia, isPending: false }),
}));

let latest: GameMediaValue = EMPTY_GAME_MEDIA;

const Harness = ({ initial = EMPTY_GAME_MEDIA }: { initial?: GameMediaValue }) => {
  const [media, setMedia] = useState(initial);
  latest = media;
  return <GameMediaFields value={media} onChange={setMedia} onUploadingChange={() => undefined} />;
};

const image = (name: string) => new File(["x"], name, { type: "image/png" });

describe("GameMediaFields", () => {
  it("uploads picked images in order and removes one", async () => {
    uploadCount = 0;
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const [screenshotInput] = container.querySelectorAll<HTMLInputElement>('input[type="file"]');

    await user.upload(screenshotInput, [image("a.png"), image("b.png")]);

    await waitFor(() => expect(latest.screenshotUrls).toEqual(["/uploads/game-media/1.jpg", "/uploads/game-media/2.jpg"]));
    await user.click(screen.getByRole("button", { name: "Remove image 1" }));
    expect(latest.screenshotUrls).toEqual(["/uploads/game-media/2.jpg"]);
    expect(latest.artworkUrls).toEqual([]);
  });

  it("adds a YouTube video from a link, with an optional title", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("YouTube link"), "https://youtu.be/dQw4w9WgXcQ");
    await user.type(screen.getByLabelText("Title (optional)"), "Launch Trailer");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(latest.videos).toEqual([{ name: "Launch Trailer", videoId: "dQw4w9WgXcQ" }]);
    expect(screen.getByText("Launch Trailer")).toBeInTheDocument();
  });

  it("refuses a link that isn't a YouTube video, or one already added", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...EMPTY_GAME_MEDIA, videos: [{ name: null, videoId: "dQw4w9WgXcQ" }] }} />);
    const link = screen.getByLabelText("YouTube link");

    await user.type(link, "https://vimeo.com/123{Enter}");
    expect(screen.getByText("That isn't a YouTube video link.")).toBeInTheDocument();

    await user.clear(link);
    await user.type(link, "https://www.youtube.com/watch?v=dQw4w9WgXcQ{Enter}");
    expect(screen.getByText("This video is already added.")).toBeInTheDocument();
    expect(latest.videos).toHaveLength(1);
  });

  it("stops offering uploads once a section has ten images", () => {
    const full = Array.from({ length: 10 }, (_, index) => `/uploads/game-media/${index}.jpg`);
    render(<Harness initial={{ ...EMPTY_GAME_MEDIA, artworkUrls: full }} />);

    const [screenshots, artwork] = screen.getAllByText("Add images").map((label) => label.closest("label"));
    expect(screenshots).not.toHaveAttribute("aria-disabled", "true");
    expect(artwork).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
  });
});
