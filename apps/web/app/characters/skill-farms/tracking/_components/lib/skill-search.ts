import type { SkillEncyclopediaEntry } from "@eve/shared/skill-contracts";

export function buildSkillNameById(
  skills: SkillEncyclopediaEntry[] | undefined,
): Map<number, string> {
  const map = new Map<number, string>();
  if (!skills) return map;
  for (const skill of skills) {
    map.set(skill.skillId, skill.name);
  }
  return map;
}

export function searchSkills(
  skills: SkillEncyclopediaEntry[] | undefined,
  query: string,
  limit = 25,
): SkillEncyclopediaEntry[] {
  if (!skills) return [];
  if (query.length < 2) return [];

  return skills
    .filter((skill) => {
      const name = skill.name.toLowerCase();
      const group = (skill.groupName ?? "").toLowerCase();
      const id = String(skill.skillId);
      return (
        name.includes(query) || group.includes(query) || id.includes(query)
      );
    })
    .slice(0, limit);
}
