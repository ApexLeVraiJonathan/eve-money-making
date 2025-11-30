export interface SkillSubgroupDefinition {
  /**
   * Stable key used by the API and UI to group skills within a skill group.
   * Example: "gunnery_small", "gunnery_medium".
   */
  key: string;
  /**
   * Human readable label shown in the UI, e.g. "Small Turrets".
   */
  label: string;
  /**
   * All skill typeIds that belong to this subgroup.
   */
  skillIds: number[];
}

/**
 * Configuration for skill sub-groups, keyed by groupId from the EVE skill
 * groups (e.g. 255 = Gunnery, 257 = Spaceship Command).
 *
 * This intentionally lives in a single place so we can carefully curate
 * sub-groupings across all categories over time.
 *
 * NOTE: The arrays below are intentionally left empty as placeholders so that
 * we don't guess at exact mappings. To define a subgroup, add the relevant
 * skill typeIds for that group.
 */
export const SKILL_SUBGROUPS: Record<number, SkillSubgroupDefinition[]> = {
  // 255: Gunnery
  255: [
    {
      key: 'gunnery_small',
      label: 'Small Gun',
      skillIds: [
        3303, // Small Energy Turret
        3301, // Small Hybrid Turret
        47870, // Small Precursor Weapon
        3302, // Small Projectile Turret
        55034, // Small Vorton Projector
      ],
    },
    {
      key: 'gunnery_small_t2',
      label: 'Small Gun T2',
      skillIds: [
        12201, // Small Artillery Specialization
        11084, // Small Autocannon Specialization
        11083, // Small Beam Laser Specialization
        12210, // Small Blaster Specialization
        47873, // Small Disintegrator Specialization
        12213, // Small Pulse Laser Specialization
        11082, // Small Railgun Specialization
        54827, // Small Vorton Specialization
      ],
    },
    {
      key: 'gunnery_medium',
      label: 'Medium Gun',
      skillIds: [
        3306, // Medium Energy Turret
        3304, // Medium Hybrid Turret
        47871, // Medium Precursor Weapon
        3305, // Medium Projectile Turret
        55035, // Medium Vorton Projector
      ],
    },
    {
      key: 'gunnery_medium_t2',
      label: 'Medium Gun T2',
      skillIds: [
        12202, // Medium Artillery Specialization
        12208, // Medium Autocannon Specialization
        12204, // Medium Beam Laser Specialization
        12211, // Medium Blaster Specialization
        47874, // Medium Disintegrator Specialization
        12214, // Medium Pulse Laser Specialization
        12206, // Medium Railgun Specialization
        54828, // Medium Vorton Specialization
      ],
    },
    {
      key: 'gunnery_large',
      label: 'Large Gun',
      skillIds: [
        3309, // Large Energy Turret
        3307, // Large Hybrid Turret
        47872, // Large Precursor Weapon
        3308, // Large Projectile Turret
        54826, // Large Vorton Projector
      ],
    },
    {
      key: 'gunnery_large_t2',
      label: 'Large Gun T2',
      skillIds: [
        12203, // Large Artillery Specialization
        12209, // Large Autocannon Specialization
        12205, // Large Beam Laser Specialization
        12212, // Large Blaster Specialization
        47875, // Large Disintegrator Specialization
        12215, // Large Pulse Laser Specialization
        12207, // Large Railgun Specialization
        54829, // Large Vorton Specialization
      ],
    },
    {
      key: 'gunnery_capital',
      label: 'Capital Gun',
      skillIds: [
        24563, // Doomsday Operation
        20327, // Capital Energy Turret
        21666, // Capital Hybrid Turret
        52998, // Capital Precursor Weapon
        21667, // Capital Projectile Turret
      ],
    },
    {
      key: 'gunnery_capital_t2',
      label: 'Capital Gun T2',
      skillIds: [
        41404, // Capital Artillery Specialization
        41403, // Capital Autocannon Specialization
        41408, // Capital Beam Laser Specialization
        41405, // Capital Blaster Specialization
        41407, // Capital Pulse Laser Specialization
        41406, // Capital Railgun Specialization
      ],
    },
    {
      key: 'gunnery_support',
      label: 'Support',
      skillIds: [
        77739, // Disruptive Lance Operation
        41537, // Doomsday Rapid Firing
        88377, // Advanced Doomsday Operation
        3300, // Gunnery
        3312, // Motion Prediction
        3310, // Rapid Firing
        3311, // Sharpshooter
        3315, // Surgical Strike
        3316, // Controlled Bursts
        22043, // Tactical Weapon Reconfiguration
        3317, // Trajectory Analysis
        55511, // Vorton Arc Extension
        54841, // Vorton Arc Guidance
        54840, // Vorton Power Amplification
        55033, // Vorton Projector Operation
      ],
    },
  ],

  // 257: Spaceship Command
  257: [
    {
      key: 'spaceship_frigates',
      label: 'Frigates & Destroyers',
      skillIds: [
        // Racial T1 frigates
        3331, // Amarr Frigate
        3329, // Caldari Frigate
        3327, // Gallente Frigate
        3325, // Minmatar Frigate

        // Factional / special frigates
        60696, // EDENCOM Frigate
        33092, // Mining Frigate
        49866, // Precursor Frigate

        // Racial destroyers
        33091, // Amarr Destroyer
        33089, // Caldari Destroyer
        33087, // Gallente Destroyer
        33085, // Minmatar Destroyer

        // Factional / special destroyers
        33098, // Mining Destroyer
        49708, // Precursor Destroyer

        // T2 small hull families
        12095, // Assault Frigates
        34390, // Amarr Tactical Destroyer
        35680, // Caldari Tactical Destroyer
        35685, // Gallente Tactical Destroyer
        35696, // Minmatar Tactical Destroyer
      ],
    },
    {
      key: 'spaceship_cruisers',
      label: 'Cruisers & Battlecruisers',
      skillIds: [
        // Racial cruisers
        3335, // Amarr Cruiser
        3323, // Caldari Cruiser
        3321, // Gallente Cruiser
        3319, // Minmatar Cruiser

        // Factional / special cruisers
        60698, // EDENCOM Cruiser
        49710, // Precursor Cruiser

        // Strategic cruisers
        30650, // Amarr Strategic Cruiser
        30651, // Caldari Strategic Cruiser
        30652, // Gallente Strategic Cruiser
        30653, // Minmatar Strategic Cruiser

        // Racial battlecruisers
        33095, // Amarr Battlecruiser
        33097, // Caldari Battlecruiser
        33099, // Gallente Battlecruiser
        33101, // Minmatar Battlecruiser

        // Factional / special battlecruisers
        49712, // Precursor Battlecruiser
      ],
    },
    {
      key: 'spaceship_battleships',
      label: 'Battleships & Capitals',
      skillIds: [
        // Racial battleships
        3339, // Amarr Battleship
        3337, // Caldari Battleship
        3335, // Gallente Battleship (note: also used as cruiser, kept here for size)
        3333, // Minmatar Battleship

        // Factional / special battleships
        60699, // EDENCOM Battleship
        49714, // Precursor Battleship

        // Capitals: dreadnoughts, carriers, titans, freighters etc.
        20525, // Amarr Dreadnought
        20530, // Caldari Dreadnought
        20531, // Gallente Dreadnought
        20532, // Minmatar Dreadnought

        24311, // Amarr Carrier
        24312, // Caldari Carrier
        24313, // Gallente Carrier
        24314, // Minmatar Carrier

        3347, // Amarr Titan
        3348, // Caldari Titan
        3349, // Gallente Titan
        3350, // Minmatar Titan

        20524, // Amarr Freighter
        20526, // Caldari Freighter
        20527, // Gallente Freighter
        20528, // Minmatar Freighter

        37615, // Jump Freighters (generic skill)
        17940, // Capital Ships (generic)
      ],
    },
    {
      key: 'spaceship_support',
      label: 'Support & Misc',
      skillIds: [
        3327, // Spaceship Command
        20342, // Advanced Spaceship Command
        20533, // Capital Ships

        // Misc advanced hull families that don't cleanly fit size buckets
        12092, // Heavy Assault Cruisers
        12093, // Heavy Interdictors
        19719, // Command Ships
        28609, // Marauders
        28615, // Logistics Cruisers
        28656, // Black Ops
      ],
    },
  ],

  // Placeholders for other groups (Navigation, Engineering, etc.) that we can
  // fill out as we review each category.
};

export function getSkillSubgroupForSkill(
  groupId: number,
  typeId: number,
): { subGroupKey: string | null; subGroupLabel: string | null } {
  const defs = SKILL_SUBGROUPS[groupId];
  if (!defs?.length) {
    return { subGroupKey: null, subGroupLabel: null };
  }

  for (const def of defs) {
    if (def.skillIds.includes(typeId)) {
      return { subGroupKey: def.key, subGroupLabel: def.label };
    }
  }

  return { subGroupKey: null, subGroupLabel: null };
}
