"use client";

type GettingStartedTipsProps = {
  showGettingStarted: boolean;
  onDismiss: () => void;
  onShow: () => void;
};

export function GettingStartedTips({
  showGettingStarted,
  onDismiss,
  onShow,
}: GettingStartedTipsProps) {
  if (showGettingStarted) {
    return (
      <section className="relative rounded-md border bg-card p-4 text-sm space-y-2">
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 text-foreground/60 hover:text-foreground transition-colors"
          aria-label="Dismiss getting started"
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
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <p className="font-medium">Getting started</p>
        <ul className="list-disc space-y-1 pl-5 text-foreground">
          <li>
            Use the <span className="font-semibold">search box</span> to find skills by
            name or ID, and the <span className="font-semibold">level filters</span> to
            focus on specific tiers.
          </li>
          <li>
            Click any <span className="font-semibold">skill row</span> or{" "}
            <span className="font-semibold">queue entry</span> to open a detailed view
            with prerequisites, SP per level, and training attributes.
          </li>
          <li>
            Watch the <span className="font-semibold">Training Queue</span> on the right
            for total time remaining and upcoming skills, and use the character selector
            to switch between pilots.
          </li>
        </ul>
      </section>
    );
  }

  return (
    <button
      onClick={onShow}
      className="text-sm text-foreground/70 hover:text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors rounded-md border border-dashed px-3 py-1.5"
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
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      Show getting started tips
    </button>
  );
}
