import { describe, it, expect } from "vitest";
import {
  calculateDailyHours,
  determineTier,
  calculateDailyPay,
  calculateWeeklyBonus,
} from "../calculations";
import type { SalaryTier, BonusRule } from "@/types";

const MOCK_TIERS: SalaryTier[] = [
  { id: "t1", min_hours: 0, max_hours: 8, rate_per_hour: 10000, effective_from: "2026-01-01" },
  { id: "t2", min_hours: 8.01, max_hours: 10, rate_per_hour: 11000, effective_from: "2026-01-01" },
  { id: "t3", min_hours: 10.01, max_hours: 12, rate_per_hour: 12000, effective_from: "2026-01-01" },
  { id: "t4", min_hours: 12.01, max_hours: null, rate_per_hour: 12000, effective_from: "2026-01-01" },
];

const MOCK_BONUS_RULES: BonusRule[] = [
  { id: "b1", min_weekly_hours: 40, bonus_amount: 100000, effective_from: "2026-01-01" },
];

describe("AnnoTracker Payroll Calculations (QA Test Cases)", () => {
  // TC-006: Happy path - 6 jam masuk tier 1-8 jam @ 10rb/jam
  it("TC-006: calculates daily pay correctly for 6 hours in 1-8 hour tier (Rp 60.000)", () => {
    const totalHours = 6;
    const tier = determineTier(totalHours, MOCK_TIERS, "2026-07-28");
    expect(tier).not.toBeNull();
    expect(tier?.rate_per_hour).toBe(10000);

    const pay = calculateDailyPay(totalHours, tier);
    expect(pay).toBe(60000);
  });

  // TC-007: Tepat 12 jam di batas tier 11-12 jam @ 12rb/jam (flat)
  it("TC-007: calculates flat rate daily pay correctly for 12 hours boundary (Rp 144.000)", () => {
    const totalHours = 12;
    const tier = determineTier(totalHours, MOCK_TIERS, "2026-07-28");
    expect(tier).not.toBeNull();
    expect(tier?.rate_per_hour).toBe(12000);

    const pay = calculateDailyPay(totalHours, tier);
    expect(pay).toBe(144000); // 12 * 12.000 = 144.000 (FLAT, NOT progressive)
  });

  // TC-008: Bonus mingguan tercapai (42 jam >= threshold 40 jam -> bonus 100rb)
  it("TC-008: returns weekly bonus of Rp 100.000 when threshold of 40 hours is met (42 hours)", () => {
    const weeklyHours = 42;
    const bonus = calculateWeeklyBonus(weeklyHours, MOCK_BONUS_RULES, "2026-07-28");
    expect(bonus).toBe(100000);
  });

  // TC-009: Bonus mingguan tidak tercapai (25 jam < threshold 40 jam -> bonus 0)
  it("TC-009: returns Rp 0 weekly bonus when threshold of 40 hours is not met (25 hours)", () => {
    const weeklyHours = 25;
    const bonus = calculateWeeklyBonus(weeklyHours, MOCK_BONUS_RULES, "2026-07-28");
    expect(bonus).toBe(0);
  });

  // TC-010: Perubahan rate tier di tengah periode (effective_from)
  it("TC-010: respects effective_from date when rate tier changes mid-period", () => {
    const updatedTiers: SalaryTier[] = [
      ...MOCK_TIERS,
      // New tier rule effective from July 15, 2026 with increased rate
      { id: "t1-new", min_hours: 0, max_hours: 8, rate_per_hour: 15000, effective_from: "2026-07-15" },
    ];

    // Task on July 10 (before effective date) -> uses old rate 10.000
    const tierBefore = determineTier(6, updatedTiers, "2026-07-10");
    expect(tierBefore?.rate_per_hour).toBe(10000);

    // Task on July 20 (after effective date) -> uses new rate 15.000
    const tierAfter = determineTier(6, updatedTiers, "2026-07-20");
    expect(tierAfter?.rate_per_hour).toBe(15000);
  });

  // TC-011: Durasi task 0 detik -> error validasi
  it("TC-011: throws validation error when task duration is 0 or negative seconds", () => {
    const invalidEntries = [{ duration_seconds: 0 }];
    expect(() => calculateDailyHours(invalidEntries)).toThrow(
      "Durasi task harus berupa angka positif lebih dari 0 detik."
    );
  });
});
