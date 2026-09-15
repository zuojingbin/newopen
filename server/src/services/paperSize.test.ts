import { describe, expect, it } from "vitest";
import { classifyByPoints, guessA3ByPixels } from "./paperSize.js";
import { A3, A4 } from "../config.js";

describe("classifyByPoints", () => {
  it("recognizes an exact A4 page in either orientation", () => {
    expect(classifyByPoints(A4.w, A4.h)).toBe("A4");
    expect(classifyByPoints(A4.h, A4.w)).toBe("A4");
  });

  it("recognizes an exact A3 page in either orientation", () => {
    expect(classifyByPoints(A3.w, A3.h)).toBe("A3");
    expect(classifyByPoints(A3.h, A3.w)).toBe("A3");
  });

  it("tolerates small scanner/DPI drift", () => {
    expect(classifyByPoints(A3.w * 1.02, A3.h * 0.98)).toBe("A3");
  });

  it("falls back to 'other' for unrelated sizes", () => {
    expect(classifyByPoints(300, 300)).toBe("other");
  });
});

describe("guessA3ByPixels", () => {
  it("flags a large A-series-ratio landscape photo as likely A3", () => {
    expect(guessA3ByPixels(3300, 2334)).toBe(true);
  });

  it("does not flag a small phone photo even with the right ratio", () => {
    expect(guessA3ByPixels(1000, 707)).toBe(false);
  });

  it("does not flag a large photo with an unrelated aspect ratio", () => {
    expect(guessA3ByPixels(3000, 3000)).toBe(false);
  });
});
