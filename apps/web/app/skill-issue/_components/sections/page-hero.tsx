import { Zap } from "lucide-react";

export function SkillIssuePageHero() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Fit Analysis</h1>
          <p className="text-sm text-foreground/70">
            Pick a character, import an EFT fit, and see missing + influencing
            skills.
          </p>
        </div>
      </div>
    </div>
  );
}
