import { describe, expect, it } from "vitest";
import { getYouTubeEmbedUrl } from "@/lib/video-embed";

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
