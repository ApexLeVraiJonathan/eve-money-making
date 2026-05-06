"use client";

import * as React from "react";
import { toast } from "@eve/ui";
import { Users } from "lucide-react";
import {
  useTradecraftUsers,
  useUpdateTradecraftUserMaxParticipation,
} from "../../../api";
import { iskFromB } from "./lib/caps";
import { ManageCapsCard } from "./sections/manage-caps-card";

export default function TradecraftUsersAdminPageClient() {
  const { data: users = [], isLoading } = useTradecraftUsers({
    limit: 500,
    offset: 0,
  });
  const updateMax = useUpdateTradecraftUserMaxParticipation();

  const [query, setQuery] = React.useState("");
  const [draftPrincipalB, setDraftPrincipalB] = React.useState<Record<string, string>>(
    {},
  );
  const [draftMaximumB, setDraftMaximumB] = React.useState<Record<string, string>>(
    {},
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const email = (u.email ?? "").toLowerCase();
      const id = u.id.toLowerCase();
      const pc = (u.primaryCharacter?.name ?? "").toLowerCase();
      return email.includes(q) || id.includes(q) || pc.includes(q);
    });
  }, [users, query]);

  const handleSave = async (userId: string) => {
    const principalRaw = (draftPrincipalB[userId] ?? "").trim();
    const maximumRaw = (draftMaximumB[userId] ?? "").trim();

    const principalB = principalRaw.length === 0 ? null : Number(principalRaw);
    const maximumB = maximumRaw.length === 0 ? null : Number(maximumRaw);

    if (principalB != null && (!Number.isFinite(principalB) || principalB < 0)) {
      toast.error("Invalid principal cap (B ISK). Use a positive number like 10.");
      return;
    }
    if (maximumB != null && (!Number.isFinite(maximumB) || maximumB < 0)) {
      toast.error("Invalid maximum cap (B ISK). Use a positive number like 20.");
      return;
    }
    if (principalB != null && maximumB != null && principalB > maximumB) {
      toast.error("Principal cap cannot be higher than maximum cap");
      return;
    }

    await updateMax.mutateAsync({
      userId,
      principalCapIsk: principalB == null ? null : iskFromB(principalB),
      maximumCapIsk: maximumB == null ? null : iskFromB(maximumB),
    });

    toast.success("Updated Tradecraft caps");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tradecraft Users</h1>
          <p className="text-sm text-muted-foreground">
            Users who have used Tradecraft before. Manage per-user max participation
            caps.
          </p>
        </div>
      </div>

      <ManageCapsCard
        query={query}
        setQuery={setQuery}
        isLoading={isLoading}
        filtered={filtered}
        draftPrincipalB={draftPrincipalB}
        setDraftPrincipalB={setDraftPrincipalB}
        draftMaximumB={draftMaximumB}
        setDraftMaximumB={setDraftMaximumB}
        isSaving={updateMax.isPending}
        onSave={(userId) =>
          handleSave(userId).catch((e) =>
            toast.error(e instanceof Error ? e.message : "Failed to update"),
          )
        }
      />
    </div>
  );
}
