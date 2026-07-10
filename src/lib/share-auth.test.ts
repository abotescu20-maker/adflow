import { describe, it, expect } from "vitest";
import {
  ShareAuthError,
  assertAssetInShare,
  cleanText,
  toMillis,
  type ResolvedShare,
} from "@/lib/share-auth";

function share(overrides: Partial<ResolvedShare> = {}): ResolvedShare {
  return {
    token: "tok",
    workspaceId: "ws1",
    campaignId: "camp1",
    assetIds: ["a1", "a2"],
    permissions: { canView: true, canComment: true },
    ...overrides,
  };
}

describe("assertAssetInShare", () => {
  it("returns the campaignId for an asset that is in the share", () => {
    expect(assertAssetInShare(share(), "a1")).toBe("camp1");
  });

  it("allows any asset when the share is campaign-wide (empty assetIds)", () => {
    expect(assertAssetInShare(share({ assetIds: [] }), "anything")).toBe(
      "camp1"
    );
  });

  it("rejects an asset NOT in an explicit assetIds list (403)", () => {
    expect(() => assertAssetInShare(share(), "not-in-list")).toThrowError(
      ShareAuthError
    );
    try {
      assertAssetInShare(share(), "not-in-list");
    } catch (e) {
      expect((e as ShareAuthError).status).toBe(403);
    }
  });

  it("rejects a missing assetId (400)", () => {
    try {
      assertAssetInShare(share(), "");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ShareAuthError);
      expect((e as ShareAuthError).status).toBe(400);
    }
  });

  it("rejects when the share has no campaign scope (400)", () => {
    try {
      assertAssetInShare(share({ campaignId: null, assetIds: [] }), "a1");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ShareAuthError).status).toBe(400);
    }
  });
});

describe("cleanText", () => {
  it("trims whitespace", () => {
    expect(cleanText("  hi  ", 100)).toBe("hi");
  });

  it("caps to max length", () => {
    expect(cleanText("abcdef", 3)).toBe("abc");
  });

  it("strips ASCII control characters but keeps spaces + unicode", () => {
    // \x01 (control) is dropped; the space and accented char are kept.
    expect(cleanText("a\x01b cé", 100)).toBe("ab cé");
  });

  it("strips tabs/newlines (control chars)", () => {
    expect(cleanText("hello\tworld\n", 100)).toBe("helloworld");
  });

  it("coerces null/undefined/number", () => {
    expect(cleanText(null, 10)).toBe("");
    expect(cleanText(undefined, 10)).toBe("");
    expect(cleanText(42, 10)).toBe("42");
  });
});

describe("toMillis", () => {
  it("reads a Firestore-style Timestamp via toMillis()", () => {
    expect(toMillis({ toMillis: () => 1234 })).toBe(1234);
  });

  it("reads a Date", () => {
    expect(toMillis(new Date(5000))).toBe(5000);
  });

  it("returns null for null/undefined/plain values", () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis("nope")).toBeNull();
  });
});
