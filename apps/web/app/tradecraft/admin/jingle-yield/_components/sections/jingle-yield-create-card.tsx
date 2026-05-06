import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { DollarSign, Loader2 } from "lucide-react";

type User = {
  id: string;
  primaryCharacterId: number | null;
  characters: Array<{ id: number; name: string }>;
};

type Cycle = { id: string; name: string | null };
type AdminCharacter = { characterId: number; characterName: string };

export function JingleYieldCreateCard({
  users,
  userLabelMap,
  plannedCycles,
  adminCharacters,
  jyUserId,
  setJyUserId,
  jyCycleId,
  setJyCycleId,
  jyAdminCharacterId,
  setJyAdminCharacterId,
  jyCharacterName,
  jyPrincipalIsk,
  setJyPrincipalIsk,
  jyMinCycles,
  setJyMinCycles,
  isFormValid,
  getMissingFieldsCount,
  isPending,
  onCreate,
}: {
  users: User[];
  userLabelMap: Map<string, { primaryName: string; label: string }>;
  plannedCycles: Cycle[];
  adminCharacters: AdminCharacter[];
  jyUserId: string;
  setJyUserId: (value: string) => void;
  jyCycleId: string;
  setJyCycleId: (value: string) => void;
  jyAdminCharacterId: number | "";
  setJyAdminCharacterId: (value: number | "") => void;
  jyCharacterName: string;
  jyPrincipalIsk: string;
  setJyPrincipalIsk: (value: string) => void;
  jyMinCycles: number | "";
  setJyMinCycles: (value: number | "") => void;
  isFormValid: boolean;
  getMissingFieldsCount: () => number;
  isPending: boolean;
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          Create JingleYield Participation
        </CardTitle>
        <CardDescription>
          Seed an admin-funded participation for an eligible user in a planned cycle.
          Principal and minimum cycles can be adjusted per program.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              User <span className="text-destructive">*</span>
            </label>
            <Select value={jyUserId} onValueChange={setJyUserId}>
              <SelectTrigger className={`w-full ${!jyUserId && "border-destructive/50"}`}>
                <SelectValue placeholder="Select user…" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => {
                  const info = userLabelMap.get(u.id);
                  return (
                    <SelectItem key={u.id} value={u.id}>
                      {info?.label ?? u.id.substring(0, 8)} ({u.id.substring(0, 8)})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Planned Cycle <span className="text-destructive">*</span>
            </label>
            <Select value={jyCycleId} onValueChange={setJyCycleId}>
              <SelectTrigger className={`w-full ${!jyCycleId && "border-destructive/50"}`}>
                <SelectValue placeholder="Select planned cycle…" />
              </SelectTrigger>
              <SelectContent>
                {plannedCycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? c.id.substring(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Admin Character <span className="text-destructive">*</span>
            </label>
            <Select
              value={jyAdminCharacterId === "" ? "" : String(jyAdminCharacterId)}
              onValueChange={(val) => setJyAdminCharacterId(val ? Number(val) : "")}
            >
              <SelectTrigger
                className={`w-full ${jyAdminCharacterId === "" && "border-destructive/50"}`}
              >
                <SelectValue placeholder="Select admin character…" />
              </SelectTrigger>
              <SelectContent>
                {adminCharacters.map((c) => (
                  <SelectItem key={c.characterId} value={String(c.characterId)}>
                    {c.characterName} ({c.characterId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Display Character Name</label>
            <Input
              className="bg-muted/50 cursor-not-allowed"
              placeholder="Auto-populated from selected user"
              value={jyCharacterName}
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Automatically set based on selected user&apos;s primary character.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Seeded Principal (ISK)</label>
            <Input
              type="number"
              min={1}
              step={1_000_000}
              value={jyPrincipalIsk}
              onChange={(e) => setJyPrincipalIsk(e.target.value)}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-xs text-muted-foreground">
              Counts toward the 10B principal cap (user principal + JY principal ≤ 10B).
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Min Cycles Before Repay</label>
            <Input
              type="number"
              min={1}
              value={jyMinCycles}
              onChange={(e) => setJyMinCycles(e.target.value ? Number(e.target.value) : "")}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-xs text-muted-foreground">
              Locked principal can only be repaid after at least this many cycles or once
              accrued interest reaches the principal.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          {!isFormValid && (
            <p className="text-sm text-muted-foreground">
              {getMissingFieldsCount()} required {getMissingFieldsCount() === 1 ? "field" : "fields"}{" "}
              remaining
            </p>
          )}
          <Button
            size="sm"
            className="gap-2 ml-auto"
            disabled={!isFormValid || isPending}
            onClick={onCreate}
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <DollarSign className="h-3.5 w-3.5" />
                Create JingleYield
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
