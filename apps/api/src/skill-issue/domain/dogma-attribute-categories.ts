export type SkillIssueInfluenceCategory =
  | 'Capacitor'
  | 'Fitting Resources'
  | 'Offense'
  | 'Defense'
  | 'Targeting'
  | 'Navigation'
  | 'Drones'
  | 'Other';

const ORDER: SkillIssueInfluenceCategory[] = [
  'Capacitor',
  'Fitting Resources',
  'Offense',
  'Defense',
  'Targeting',
  'Navigation',
  'Drones',
  'Other',
];

export function sortCategories(
  categories: Iterable<SkillIssueInfluenceCategory>,
): SkillIssueInfluenceCategory[] {
  const set = new Set(categories);
  return ORDER.filter((c) => set.has(c));
}

export function categorizeDogmaAttributeName(
  attributeName: string,
): SkillIssueInfluenceCategory | null {
  const n = attributeName.toLowerCase();

  // Special-case: dogma attribute `speed` is Rate of Fire (attributeID 51)
  if (n === 'speed') return 'Offense';

  // Fitting resources (CPU / Powergrid)
  // Examples:
  // - cpuOutput (48), cpu (50), cpuNeedBonus (310), cpuMultiplier (202)
  // - powerOutput (11), power (30), powerOutputBonus (121)
  if (n.includes('cpu')) return 'Fitting Resources';
  if (n === 'power') return 'Fitting Resources';
  if (n.includes('powergrid')) return 'Fitting Resources';
  if (n.startsWith('poweroutput')) return 'Fitting Resources';
  if (n.includes('powerengineering')) return 'Fitting Resources';

  // Capacitor (short names that don't include the full word "capacitor")
  // Examples: capRechargeBonus (314), capNeedBonus (317), rechargeRate (55)
  if (n === 'rechargerate') return 'Capacitor';
  if (n === 'caprechargebonus') return 'Capacitor';
  if (n === 'capneedbonus') return 'Capacitor';

  // Drones / Fighters
  if (n.includes('drone') || n.includes('fighter')) return 'Drones';

  // Capacitor
  if (n.includes('capacitor')) return 'Capacitor';

  // Defense
  if (
    n.includes('shield') ||
    n.includes('armor') ||
    n.includes('hull') ||
    n.includes('structure') ||
    n.includes('resistance') ||
    n.includes('resonance') ||
    n.includes('hitpoints') ||
    n.endsWith('hp') ||
    n.includes('repair') ||
    n.includes('boost')
  ) {
    return 'Defense';
  }

  // Targeting / Sensors / EWAR
  if (
    n.includes('target') ||
    n.includes('scan') ||
    n.includes('sensor') ||
    n.includes('signature') ||
    n.includes('ecm') ||
    n.includes('jamming') ||
    n.includes('disrupt') ||
    n.includes('damp')
  ) {
    return 'Targeting';
  }

  // Navigation
  if (
    n.includes('velocity') ||
    n.includes('speed') ||
    n.includes('warp') ||
    n.includes('inertia') ||
    n.includes('mass') ||
    n.includes('agility') ||
    n.includes('acceleration')
  ) {
    return 'Navigation';
  }

  // Offense
  if (
    n.includes('damage') ||
    n.includes('missile') ||
    n.includes('turret') ||
    n.includes('launcher') ||
    n.includes('rateoffire') ||
    n.includes('tracking') ||
    n.includes('optimal') ||
    n.includes('falloff') ||
    n.includes('explosion') ||
    n.includes('warhead')
  ) {
    return 'Offense';
  }

  return null;
}
