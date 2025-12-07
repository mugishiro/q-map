import { describe, it, expect } from "vitest";
import lambda from "../infra/lambda/src/index.ts";

describe("lambda helpers", () => {
  const { letterForDepth, matchPath } = lambda._test;

  it("letterForDepth stays within A-Z", () => {
    expect(letterForDepth(0)).toBe("A");
    expect(letterForDepth(1)).toBe("B");
    expect(letterForDepth(25)).toBe("Z");
    expect(letterForDepth(30)).toBe("Z");
  });

  it("matchPath extracts params", () => {
    const params = matchPath("/v1/topics/abc/nodes", "/v1/topics/{topicId}/nodes");
    expect(params).toEqual({ topicId: "abc" });
    expect(matchPath("/v1/topics/abc", "/v1/topics/{topicId}/nodes")).toBeNull();
  });
});
