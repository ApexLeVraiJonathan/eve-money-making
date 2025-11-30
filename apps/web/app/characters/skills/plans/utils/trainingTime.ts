/**
 * Training Time Calculation Utilities
 * Based on EVE Online's skill training formula
 */

export interface CharacterAttributes {
  intelligence: number;
  perception: number;
  charisma: number;
  willpower: number;
  memory: number;
}

/**
 * Calculate training time for a skill level
 * Formula: Time (seconds) = SP_required / training_rate * 60
 * where SP_required = 2^(level-1) * 250 * rank
 * and training_rate = primary_attr + secondary_attr/2
 */
export function calculateTrainingTime(
  skillRank: number,
  targetLevel: number,
  primaryAttr: number = 20,
  secondaryAttr: number = 20,
): number {
  const spRequired = Math.pow(2, targetLevel - 1) * 250 * skillRank;
  const trainRate = primaryAttr + secondaryAttr / 2;
  return Math.ceil((spRequired / trainRate) * 60); // seconds
}

/**
 * Format training time in human-readable format
 */
export function formatTrainingTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/**
 * Roman numeral conversion for skill levels I-V
 */
export const romanNumerals: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
};
