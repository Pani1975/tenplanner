import { describe, expect, it } from "vitest";
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
  normalizeVideoUrl,
} from "@/lib/video-embed";

describe("getYouTubeEmbedUrl", () => {
  it("converts the usual YouTube link formats", () => {
    expect(getYouTubeEmbedUrl("https://youtu.be/PIM_IAoc1S4")).toBe(
      "https://www.youtube-nocookie.com/embed/PIM_IAoc1S4"
    );
    expect(
      getYouTubeEmbedUrl("https://www.youtube.com/watch?v=1eIun7nMuDk")
    ).toBe("https://www.youtube-nocookie.com/embed/1eIun7nMuDk");
    expect(
      getYouTubeEmbedUrl("https://www.youtube.com/shorts/cExaGVBbYqs")
    ).toBe("https://www.youtube-nocookie.com/embed/cExaGVBbYqs");
  });

  it("keeps the start time", () => {
    expect(getYouTubeEmbedUrl("https://youtu.be/d8cUv59-PdA?t=330")).toBe(
      "https://www.youtube-nocookie.com/embed/d8cUv59-PdA?start=330"
    );
    expect(
      getYouTubeEmbedUrl("https://www.youtube.com/watch?v=1eIun7nMuDk&t=1m5s")
    ).toBe("https://www.youtube-nocookie.com/embed/1eIun7nMuDk?start=65");
  });

  it("returns null for non-YouTube or invalid links", () => {
    expect(
      getYouTubeEmbedUrl(
        "https://www.sportplan.net/drills/Tennis/Coordination-Fun-Games/Ghosts-t30002.jsp"
      )
    ).toBeNull();
    expect(getYouTubeEmbedUrl("https://youtu.be/")).toBeNull();
    expect(getYouTubeEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(getYouTubeEmbedUrl(null)).toBeNull();
  });
});

describe("getYouTubeThumbnailUrl", () => {
  it("returns the public thumbnail for YouTube links", () => {
    expect(
      getYouTubeThumbnailUrl("https://www.youtube.com/watch?v=1eIun7nMuDk")
    ).toBe("https://i.ytimg.com/vi/1eIun7nMuDk/hqdefault.jpg");
    expect(getYouTubeVideoId("https://youtu.be/PIM_IAoc1S4?t=10")).toBe(
      "PIM_IAoc1S4"
    );
  });

  it("returns null for other links", () => {
    expect(
      getYouTubeThumbnailUrl("https://drive.google.com/file/d/abc/view")
    ).toBeNull();
    expect(getYouTubeThumbnailUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("normalizeVideoUrl", () => {
  it("detects the link kind", () => {
    expect(normalizeVideoUrl("https://youtu.be/PIM_IAoc1S4")?.kind).toBe(
      "youtube"
    );
    expect(
      normalizeVideoUrl("https://drive.google.com/file/d/abc/view")?.kind
    ).toBe("drive");
    expect(normalizeVideoUrl("https://vimeo.com/123")?.kind).toBe("other");
  });

  it("adds https:// when missing", () => {
    expect(normalizeVideoUrl("  youtu.be/PIM_IAoc1S4 ")).toEqual({
      url: "https://youtu.be/PIM_IAoc1S4",
      kind: "youtube",
    });
  });

  it("rejects invalid or unsafe links", () => {
    expect(normalizeVideoUrl("")).toBeNull();
    expect(normalizeVideoUrl("no es un enlace")).toBeNull();
    expect(normalizeVideoUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeVideoUrl("ftp://example.com/v.mp4")).toBeNull();
    expect(normalizeVideoUrl("localhost")).toBeNull();
  });
});
