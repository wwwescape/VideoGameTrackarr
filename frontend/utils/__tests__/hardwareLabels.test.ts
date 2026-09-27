import { describe, expect, it } from "vitest";
import { formatGenerationOption } from "../hardwareLabels";

describe("formatGenerationOption", () => {
  const entries = [
    { generation: "Xbox 360", generationShort: "X360" },
    { generation: "NES", generationShort: "NES" },
    { generation: "Mystery", generationShort: null },
  ];

  it("appends a short name that differs from the generation", () => {
    expect(formatGenerationOption("Xbox 360", entries)).toBe("Xbox 360 (X360)");
  });

  it("doesn't repeat a short name identical to the generation", () => {
    expect(formatGenerationOption("NES", entries)).toBe("NES");
  });

  it("falls back to the generation when there's no short name", () => {
    expect(formatGenerationOption("Mystery", entries)).toBe("Mystery");
    expect(formatGenerationOption("Unknown", entries)).toBe("Unknown");
  });
});
