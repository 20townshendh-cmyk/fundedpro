import { describe, expect, it } from "vitest";
import { challengePlans, trustMetrics } from "../../../packages/domain/src/marketing";

describe("FundedPro marketing seeds", () => {
  it("exposes the current launch pricing tiers", () => {
    expect(challengePlans.map((plan) => plan.name)).toEqual(["Starter", "Pro", "Elite", "Apex"]);
  });

  it("includes trust metrics for the homepage credibility section", () => {
    expect(trustMetrics).toHaveLength(3);
    expect(trustMetrics.every((metric) => metric.detail.length > 20)).toBe(true);
  });
});
