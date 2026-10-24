import { describe, expect, it } from "vitest";

import { pluralPl } from "./plural-pl";

const DAYS = ["dzień", "dni", "dni"] as const;
const ITEMS = ["sztuka", "sztuki", "sztuk"] as const;

describe("pluralPl", () => {
  it("uses one for exactly 1", () => {
    expect(pluralPl(1, DAYS)).toBe("dzień");
    expect(pluralPl(1, ITEMS)).toBe("sztuka");
  });

  it("uses few for 2-4", () => {
    expect(pluralPl(2, ITEMS)).toBe("sztuki");
    expect(pluralPl(3, ITEMS)).toBe("sztuki");
    expect(pluralPl(4, ITEMS)).toBe("sztuki");
    expect(pluralPl(22, ITEMS)).toBe("sztuki");
    expect(pluralPl(104, ITEMS)).toBe("sztuki");
  });

  it("uses many for 0, 5-21 and the teens", () => {
    expect(pluralPl(0, ITEMS)).toBe("sztuk");
    expect(pluralPl(5, ITEMS)).toBe("sztuk");
    expect(pluralPl(12, ITEMS)).toBe("sztuk");
    expect(pluralPl(13, ITEMS)).toBe("sztuk");
    expect(pluralPl(14, ITEMS)).toBe("sztuk");
    expect(pluralPl(21, ITEMS)).toBe("sztuk");
    expect(pluralPl(112, ITEMS)).toBe("sztuk");
    expect(pluralPl(1000, ITEMS)).toBe("sztuk");
    expect(pluralPl(1001, ITEMS)).toBe("sztuk");
    expect(pluralPl(1002, ITEMS)).toBe("sztuki");
  });
});
