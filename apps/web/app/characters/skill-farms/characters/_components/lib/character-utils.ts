import type {
  ComputedCharacter,
  FarmFilter,
  FarmSort,
  RequirementSummary,
  SkillFarmCharacter,
} from "./types";

export function getRequirementList(c: {
  requirements: {
    minSp: RequirementSummary;
    biology: RequirementSummary;
    cybernetics: RequirementSummary;
    remap: RequirementSummary;
    training: RequirementSummary;
    implants: RequirementSummary;
  };
}) {
  return [
    c.requirements.minSp,
    c.requirements.biology,
    c.requirements.cybernetics,
    c.requirements.remap,
    c.requirements.training,
    c.requirements.implants,
  ];
}

export function computeCharacters(chars: SkillFarmCharacter[]): ComputedCharacter[] {
  return chars.map((c) => {
    const reqs = getRequirementList(c);
    const isReady = reqs.every((r) => r.status === "pass");
    const hasWarnings = reqs.some((r) => r.status === "warning");
    const blocking = reqs.filter((r) => r.status !== "pass");
    const isActive = c.config.isActive;
    const isCandidate = !!c.config.isCandidate;

    const statusLabel = isActive
      ? "Active farm"
      : isReady
        ? "Ready"
        : hasWarnings
          ? "Needs attention"
          : "Not ready";

    const statusVariant: "default" | "secondary" | "outline" = isActive
      ? "default"
      : isReady
        ? "secondary"
        : "outline";

    return {
      c,
      isReady,
      isActive,
      isCandidate,
      blocking,
      statusLabel,
      statusVariant,
    };
  });
}

export function getCharacterCounts(computed: ComputedCharacter[]) {
  return {
    total: computed.length,
    active: computed.filter((x) => x.isActive).length,
    ready: computed.filter((x) => x.isReady && !x.isActive).length,
    needsWork: computed.filter((x) => !x.isReady && !x.isActive).length,
    candidates: computed.filter((x) => x.isCandidate).length,
  };
}

export function filterAndSortCharacters({
  computed,
  query,
  filter,
  sort,
}: {
  computed: ComputedCharacter[];
  query: string;
  filter: FarmFilter;
  sort: FarmSort;
}) {
  const normalizedQuery = query.trim().toLowerCase();

  const visibleUnsorted = computed
    .filter((x) => {
      if (!normalizedQuery) return true;
      return x.c.name.toLowerCase().includes(normalizedQuery);
    })
    .filter((x) => {
      if (filter === "all") return true;
      if (filter === "active") return x.isActive;
      if (filter === "ready") return x.isReady && !x.isActive;
      if (filter === "needs-work") return !x.isReady && !x.isActive;
      if (filter === "candidates") return x.isCandidate;
      return true;
    });

  return [...visibleUnsorted].sort((a, b) => {
    if (sort === "name") return a.c.name.localeCompare(b.c.name);
    if (sort === "sp") return b.c.totalSp - a.c.totalSp;

    // default: status-first
    const statusRank = (x: (typeof visibleUnsorted)[number]) => {
      if (x.isActive) return 0;
      if (x.isReady) return 1;
      const hasWarning = x.blocking.some((r) => r.status === "warning");
      return hasWarning ? 2 : 3;
    };

    const r = statusRank(a) - statusRank(b);
    if (r !== 0) return r;

    // Within a status group, put "closest to ready" first.
    const missingCount = (x: (typeof visibleUnsorted)[number]) => x.blocking.length;
    const m = missingCount(a) - missingCount(b);
    if (m !== 0) return m;

    return a.c.name.localeCompare(b.c.name);
  });
}
