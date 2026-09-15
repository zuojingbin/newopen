import { describe, expect, it } from "vitest";
import { autoOrder, naturalCompare } from "./ordering.js";

describe("naturalCompare", () => {
  it("orders numbered filenames numerically, not lexically", () => {
    const names = ["10.jpg", "2.jpg", "1.jpg", "3_doc.pdf"];
    expect([...names].sort(naturalCompare)).toEqual(["1.jpg", "2.jpg", "3_doc.pdf", "10.jpg"]);
  });

  it("supports Chinese page-number filenames", () => {
    const names = ["第10页.jpg", "第2页.jpg", "第1页.jpg"];
    expect([...names].sort(naturalCompare)).toEqual(["第1页.jpg", "第2页.jpg", "第10页.jpg"]);
  });
});

describe("autoOrder", () => {
  it("falls back to upload time when names carry no usable number", () => {
    const items = [
      { filename: "img.jpg", createdAt: 200 },
      { filename: "img.jpg", createdAt: 100 },
    ];
    expect(autoOrder(items).map((i) => i.createdAt)).toEqual([100, 200]);
  });
});
