import { AlertTriangle, ClipboardCopy, Eye, FileUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@eve/ui";
import { Card, CardContent } from "@eve/ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Textarea } from "@eve/ui";
import { toast } from "@eve/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@eve/ui";
import { startUserLogin } from "@/app/tradecraft/api/characters/users.hooks";
import { DEFAULT_EFT } from "../lib/constants";
import { parseEftHeader } from "../lib/fit";

type CharacterOption = {
  id: number;
  name: string;
  isPrimary?: boolean | null;
};

type AnalyzeMutationState = {
  isPending: boolean;
  error: unknown;
};

type AnalyzeControlsCardProps = {
  characters: CharacterOption[];
  charsLoading: boolean;
  characterId: number | null;
  setCharacterId: (value: number | null) => void;
  eft: string;
  setEft: (value: string) => void;
  eftDraft: string;
  setEftDraft: (value: string) => void;
  canAnalyze: boolean;
  analyzeState: AnalyzeMutationState;
  onAnalyze: () => void;
};

export function AnalyzeControlsCard({
  characters,
  charsLoading,
  characterId,
  setCharacterId,
  eft,
  setEft,
  eftDraft,
  setEftDraft,
  canAnalyze,
  analyzeState,
  onAnalyze,
}: AnalyzeControlsCardProps) {
  const fitHeader = parseEftHeader(eft);
  const fitLabel = fitHeader?.fitName ?? "Imported fit";
  const fitSubLabel = fitHeader?.shipName ?? "EFT fit";

  return (
    <Card className="border bg-card">
      <CardContent className="pt-4 pb-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-3 space-y-1.5 md:pr-4 md:border-r border-border">
            <Label className="text-sm font-medium">Character</Label>
            <Select
              value={characterId ? String(characterId) : ""}
              onValueChange={(value) => setCharacterId(Number(value))}
              disabled={charsLoading || characters.length === 0}
            >
              <SelectTrigger className="h-10">
                <SelectValue
                  placeholder={charsLoading ? "Loading..." : "Select character"}
                />
              </SelectTrigger>
              <SelectContent>
                {characters.map((character) => (
                  <SelectItem key={character.id} value={String(character.id)}>
                    {character.name}
                    {character.isPrimary ? " (Primary)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-6 space-y-1.5 md:px-4 md:border-r border-border">
            <Label className="text-sm font-medium">Fit (EFT)</Label>
            <div className="flex items-center gap-3 rounded-md border bg-background/40 px-3 h-10">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-sm leading-tight">
                  {fitLabel}
                </div>
                <div className="text-xs text-muted-foreground truncate leading-tight">
                  {fitSubLabel}
                  {eft === DEFAULT_EFT ? " • Sample" : ""}
                </div>
              </div>
              <TooltipProvider>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Dialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Preview fit</TooltipContent>
                    </Tooltip>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>EFT Fit Preview</DialogTitle>
                        <DialogDescription>
                          Read-only view of your current fit.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-md border bg-muted/20 p-3">
                        <pre className="font-mono text-xs whitespace-pre-wrap break-all max-h-[400px] overflow-auto">
                          {eft}
                        </pre>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Close</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          await navigator.clipboard.writeText(eft);
                          toast("Copied", {
                            description: "Raw EFT copied to clipboard.",
                          });
                        }}
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy to clipboard</TooltipContent>
                  </Tooltip>

                  <Dialog
                    onOpenChange={(open) => {
                      if (open) setEftDraft(eft);
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <FileUp className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Import new fit</TooltipContent>
                    </Tooltip>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Import EFT fit</DialogTitle>
                        <DialogDescription>
                          Paste the EFT block here. We'll store it locally and
                          only show the fit name on the page.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-2">
                        <Textarea
                          value={eftDraft}
                          onChange={(event) => setEftDraft(event.target.value)}
                          rows={14}
                          className="font-mono text-xs"
                          placeholder='Paste EFT text like: "[Gila, Abyss]"'
                        />
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEftDraft(DEFAULT_EFT)}
                          >
                            Load sample
                          </Button>
                          <div className="text-xs text-foreground/70">
                            Tip: first line should be{" "}
                            <span className="font-mono">[Hull, Fit Name]</span>
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEft(DEFAULT_EFT);
                            toast("Reset", {
                              description: "Sample EFT restored.",
                            });
                          }}
                        >
                          Reset to sample
                        </Button>
                        <DialogClose asChild>
                          <Button
                            onClick={() => {
                              setEft(eftDraft);
                              const header = parseEftHeader(eftDraft);
                              toast("Fit imported", {
                                description: header?.fitName
                                  ? `Loaded "${header.fitName}".`
                                  : "EFT loaded.",
                              });
                            }}
                          >
                            Use this fit
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </TooltipProvider>
            </div>
          </div>

          <div className="md:col-span-3 space-y-1.5 md:pl-4">
            <Label className="text-sm font-medium opacity-0">Actions</Label>
            <div className="flex items-center gap-2">
              <Button onClick={onAnalyze} disabled={!canAnalyze} className="flex-1 h-10">
                {analyzeState.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-2">
                  {analyzeState.isPending ? "Analyzing…" : "Analyze"}
                </span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => {
                  setEft(DEFAULT_EFT);
                  toast("Reset", { description: "Sample EFT restored." });
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {analyzeState.isPending ? (
          <div className="text-sm text-foreground/70">Analyzing…</div>
        ) : null}

        {analyzeState.error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
            <p className="font-medium text-red-200">Analysis failed</p>
            <p className="text-red-200/80">
              {analyzeState.error instanceof Error
                ? analyzeState.error.message
                : "Unknown error"}
            </p>
          </div>
        ) : null}

        {!charsLoading && characters.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-foreground/70" />
              <div className="space-y-2">
                <p className="font-medium">No linked characters</p>
                <p className="text-foreground/70">
                  Link a character to compare required skills against your pilot.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    const returnUrl =
                      typeof window !== "undefined" ? window.location.href : "/";
                    startUserLogin(returnUrl);
                  }}
                >
                  Sign in / Link character
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
