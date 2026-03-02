"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useCycles,
  useCreateJingleYieldParticipation,
  useJingleYieldPrograms,
} from "@/app/tradecraft/api";
import { Card, CardDescription, CardHeader, CardTitle, toast } from "@eve/ui";
import { Loader2, Shield } from "lucide-react";
import { useAllUsers, useAdminCharacters } from "../../../api/characters/admin.hooks";
import { JingleYieldCreateCard } from "./sections/jingle-yield-create-card";
import { JingleYieldStatsCards } from "./sections/jingle-yield-stats-cards";
import { JingleYieldProgramsCard } from "./sections/jingle-yield-programs-card";

export default function JingleYieldAdminPageClient() {
  const { data: programs = [], isLoading } = useJingleYieldPrograms();
  const { data: users = [] } = useAllUsers();
  const { data: adminCharacters = [] } = useAdminCharacters();
  const { data: cycles = [] } = useCycles();

  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [jyUserId, setJyUserId] = useState<string>("");
  const [jyCycleId, setJyCycleId] = useState<string>("");
  const [jyAdminCharacterId, setJyAdminCharacterId] = useState<number | "">("");
  const [jyCharacterName, setJyCharacterName] = useState<string>("");
  const [jyPrincipalIsk, setJyPrincipalIsk] = useState<string>("2000000000");
  const [jyMinCycles, setJyMinCycles] = useState<number | "">(12);

  const createJingleYield = useCreateJingleYieldParticipation();

  const isFormValid =
    jyUserId &&
    jyCycleId &&
    jyCharacterName &&
    jyAdminCharacterId !== "" &&
    jyPrincipalIsk &&
    jyMinCycles !== "";

  const getMissingFieldsCount = () => {
    let count = 0;
    if (!jyUserId) count++;
    if (!jyCycleId) count++;
    if (jyAdminCharacterId === "") count++;
    if (!jyPrincipalIsk) count++;
    if (jyMinCycles === "") count++;
    return count;
  };

  const plannedCycles = useMemo(() => cycles.filter((c) => c.status === "PLANNED"), [cycles]);

  const userLabelMap = useMemo(() => {
    const map = new Map<string, { primaryName: string; label: string }>();
    for (const u of users) {
      const primary = u.characters.find((c) => c.id === u.primaryCharacterId) ?? u.characters[0];
      const primaryName = primary?.name ?? "Unknown character";
      map.set(u.id, {
        primaryName,
        label: `${primaryName}`,
      });
    }
    return map;
  }, [users]);

  useEffect(() => {
    if (!jyUserId) {
      setJyCharacterName("");
      return;
    }
    const info = userLabelMap.get(jyUserId);
    setJyCharacterName(info?.primaryName ?? "");
  }, [jyUserId, userLabelMap]);

  const filtered = useMemo(
    () => programs.filter((p) => (statusFilter === "all" ? true : p.status === statusFilter)),
    [programs, statusFilter],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Shield className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">JingleYield Programs</h1>
          <p className="text-sm text-muted-foreground">
            Overview of seeded principal programs and their progress.
          </p>
        </div>
      </div>

      <JingleYieldCreateCard
        users={users}
        userLabelMap={userLabelMap}
        plannedCycles={plannedCycles}
        adminCharacters={adminCharacters}
        jyUserId={jyUserId}
        setJyUserId={setJyUserId}
        jyCycleId={jyCycleId}
        setJyCycleId={setJyCycleId}
        jyAdminCharacterId={jyAdminCharacterId}
        setJyAdminCharacterId={setJyAdminCharacterId}
        jyCharacterName={jyCharacterName}
        jyPrincipalIsk={jyPrincipalIsk}
        setJyPrincipalIsk={setJyPrincipalIsk}
        jyMinCycles={jyMinCycles}
        setJyMinCycles={setJyMinCycles}
        isFormValid={Boolean(isFormValid)}
        getMissingFieldsCount={getMissingFieldsCount}
        isPending={createJingleYield.isPending}
        onCreate={() => {
          void (async () => {
            try {
              await createJingleYield.mutateAsync({
                userId: jyUserId,
                cycleId: jyCycleId,
                adminCharacterId:
                  typeof jyAdminCharacterId === "number"
                    ? jyAdminCharacterId
                    : Number(jyAdminCharacterId),
                characterName: jyCharacterName,
                principalIsk: jyPrincipalIsk,
                minCycles: typeof jyMinCycles === "number" ? jyMinCycles : undefined,
              });
              toast.success("JingleYield participation created.");
              setJyUserId("");
              setJyCycleId("");
              setJyAdminCharacterId("");
              setJyCharacterName("");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Failed to create JY";
              toast.error(msg);
            }
          })();
        }}
      />

      <JingleYieldStatsCards programs={programs} />

      <JingleYieldProgramsCard
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filtered={filtered}
        userLabelMap={userLabelMap}
      />
    </div>
  );
}
