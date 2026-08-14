import { describe, expect, it } from "vitest";
import { heroSlides } from "./Hero";

describe("homepage hero priorities", () => {
  it("leads with booking, then courses, then cocktails", () => {
    expect(heroSlides.map(({ link }) => link)).toEqual([
      "/book",
      "/learn",
      "/drinks",
    ]);
  });
});
