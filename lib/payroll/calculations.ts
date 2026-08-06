import type { SalaryTier, UserSalaryRate, BonusRule, TaskEntry, User, PayrollResult } from "@/types";

/**
 * 1. Calculate daily hours from an array of task entries.
 * Throws error if any duration_seconds <= 0 (Validation TC-011).
 */
export function calculateDailyHours(entries: Array<{ duration_seconds: number }>): number {
  let totalSeconds = 0;
  for (const entry of entries) {
    if (!entry.duration_seconds || entry.duration_seconds <= 0) {
      throw new Error("Durasi task harus berupa angka positif lebih dari 0 detik.");
    }
    totalSeconds += entry.duration_seconds;
  }
  return totalSeconds / 3600;
}

/**
 * 2. Determine applicable salary tier for a given daily total hours and date.
 * Filter by effective_from <= date and tier bounds (min_hours <= totalHours <= max_hours).
 */
export function determineTier(
  totalHours: number,
  tiers: SalaryTier[],
  date: string | Date
): SalaryTier | null {
  const targetDateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];

  // Filter tiers effective on or before target date
  const validTiers = tiers.filter((t) => t.effective_from <= targetDateStr);
  if (validTiers.length === 0) return null;

  // Group by effective_from and get the most recent effective_from
  const latestEffectiveDate = validTiers.reduce((latest, t) =>
    t.effective_from > latest ? t.effective_from : latest
  , validTiers[0].effective_from);

  const activeTiersForDate = validTiers.filter((t) => t.effective_from === latestEffectiveDate);

  // Find tier matching hours range
  const matchedTier = activeTiersForDate.find(
    (tier) =>
      totalHours >= tier.min_hours &&
      (tier.max_hours === null || totalHours <= tier.max_hours)
  );

  return matchedTier || null;
}

/**
 * 3. Determine applicable user hourly rate (checks custom user rate override first, falls back to global tier).
 */
export function determineUserHourlyRate(
  userId: string | undefined,
  totalHours: number,
  date: string | Date,
  globalTiers: SalaryTier[],
  userRates?: UserSalaryRate[]
): number {
  const targetDateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];

  if (userId && userRates && userRates.length > 0) {
    const userValidRates = userRates.filter(
      (r) => r.user_id === userId && r.effective_from <= targetDateStr
    );
    if (userValidRates.length > 0) {
      const latestUserRate = userValidRates.reduce((latest, r) =>
        r.effective_from > latest.effective_from ? r : latest
      , userValidRates[0]);
      return latestUserRate.rate_per_hour;
    }
  }

  // Fallback to global tier rate
  const tier = determineTier(totalHours, globalTiers, targetDateStr);
  return tier ? tier.rate_per_hour : (globalTiers[0]?.rate_per_hour || 10000);
}

/**
 * 4. Calculate daily pay based on total hours and hourly rate.
 */
export function calculateDailyPay(totalHours: number, tierOrRate: SalaryTier | number | null): number {
  if (!tierOrRate || totalHours <= 0) return 0;
  const rate = typeof tierOrRate === "number" ? tierOrRate : tierOrRate.rate_per_hour;
  return Math.round(totalHours * rate);
}

/**
 * 5. Calculate weekly bonus amount based on total weekly hours and bonus rules.
 */
export function calculateWeeklyBonus(
  weeklyHours: number,
  bonusRules: BonusRule[],
  date: string | Date
): number {
  const targetDateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];

  const validRules = bonusRules.filter((r) => r.effective_from <= targetDateStr);
  if (validRules.length === 0) return 0;

  const latestRule = validRules.reduce((latest, r) =>
    r.effective_from > latest.effective_from ? r : latest
  , validRules[0]);

  if (weeklyHours >= latestRule.min_weekly_hours) {
    return latestRule.bonus_amount;
  }
  return 0;
}

/**
 * 6. Aggregate period payroll calculation for a single user with custom user rate support.
 */
export function calculateUserPeriodPayroll(
  user: User,
  dailySessions: Array<{ date: string; taskEntries: TaskEntry[] }>,
  tiers: SalaryTier[],
  bonusRules: BonusRule[],
  periodStart: string,
  periodEnd: string,
  userSalaryRates?: UserSalaryRate[]
): PayrollResult {
  let totalPeriodHours = 0;
  let totalBasePay = 0;

  for (const session of dailySessions) {
    if (session.taskEntries.length > 0) {
      const dailyHours = calculateDailyHours(session.taskEntries);
      const rate = determineUserHourlyRate(user.id, dailyHours, session.date, tiers, userSalaryRates);
      const dailyPay = Math.round(dailyHours * rate);

      totalPeriodHours += dailyHours;
      totalBasePay += dailyPay;
    }
  }

  const bonusPay = calculateWeeklyBonus(totalPeriodHours, bonusRules, periodEnd);
  const totalPay = totalBasePay + bonusPay;

  const primaryTier = determineTier(totalPeriodHours / (dailySessions.length || 1), tiers, periodEnd);

  return {
    user,
    period_start: periodStart,
    period_end: periodEnd,
    total_hours: Math.round(totalPeriodHours * 100) / 100,
    applied_tier: primaryTier,
    base_pay: totalBasePay,
    bonus_pay: bonusPay,
    total_pay: totalPay,
    payment_status: "unpaid",
  };
}
