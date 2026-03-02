import type { SkillEncyclopediaResponse } from "@eve/shared/skill-contracts";

export function toRoman(num: number): string {
  const map: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
  };
  return map[num] ?? String(num);
}

export function createSkillNameByIdMap(
  encyclopedia: SkillEncyclopediaResponse | null | undefined,
): Map<number, string> {
  const map = new Map<number, string>();
  if (!encyclopedia?.skills) {
    return map;
  }

  for (const skill of encyclopedia.skills) {
    map.set(skill.skillId, skill.name);
  }
  return map;
}
