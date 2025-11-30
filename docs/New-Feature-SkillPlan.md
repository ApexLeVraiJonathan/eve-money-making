1. Feature Name
   Skill Plans & Remap Optimization
2. Feature Summary
   A Skill Plan system that lets EVE players create, manage, and reuse skill plans in a central library, independent of any single character. Plans are fully compatible with the in-game copy/import text format, while the app adds richer metadata, optimization, and notifications. Players can assign plans to characters, see progress and time-to-complete, and receive Discord notifications about upcoming remaps and plan completion. The system supports remap-aware optimization of skill ordering, accounting for attributes, implants, and boosters to minimize training time.
3. Goals
   Reusable plan library: Give players a personal collection of skill plans they can reuse across multiple characters and activities.
   In-game compatible import/export: Allow seamless copy/paste of plans between the app and the EVE client using the standard text format.
   Accurate training time estimates: Provide reliable total and per-skill training time estimates under different attribute/implant/booster setups.
   Remap-aware optimization: Suggest remaps and skill ordering to significantly reduce total training time while respecting user preferences when desired.
   Per-character progress tracking: Show how much of a plan a character has trained, what remains, and how long it will take to complete.
   In-game queue awareness: Detect whether a plan is actually set up in the character’s skill queue and highlight discrepancies.
   Actionable notifications: Send Discord notifications for upcoming remaps and plan completion at useful times, helping players act before critical moments.
4. Non-Goals / Out-of-Scope
   Public/browsable libraries: No public gallery, rating, or discovery of other players’ plans in V1.
   Corp/alliance planning: No corp or alliance-level plan sharing, enforcement, or doctrine management yet.
   Automated in-game updates: The app will not push plans into the EVE client; users still paste/import manually in-game.
   Abstract skill level semantics: No higher-level semantics like “at least level X”; plans are explicit “Skill Name N” lists like in-game.
   Complex versioning UI: No explicit version history or change-log management for plans beyond edit and duplicate.
   Non-Discord channels: No email, push, or other notification channels in this version.
   Cross-roster optimization: No optimization that spans multiple characters at once; optimization is per-plan, per-character (or generic scenario).
5. Primary User Stories
   As an EVE player, I want to create and save skill plans in a central library so that I can reuse them across multiple characters without recreating them in-game each time.
   As a multi-alt player, I want to import a plan from the game once and then assign it to several characters so each can train toward the same goal.
   As a player optimizing training time, I want to run an opt-in optimization that suggests remaps and reorders skills so I can train the plan as fast as possible.
   As a player who needs early usability, I want to keep my own skill order but still get remap suggestions so I can start using the character while training.
   As a character owner, I want to see how much of a plan my character has already trained and how long remains so I can prioritize which plans to pursue.
   As a cautious planner, I want to see whether my plan is actually set up in the in-game skill queue and what’s missing so I can fix mistakes quickly.
   As a player who relies on remaps, I want Discord notifications 3 days, 1 day, and 1 hour before a planned remap so I don’t forget to change attributes at the right time.
   As a player finishing a long plan, I want Discord notifications before plan completion so I can plan my next steps and maybe switch to a new plan immediately.
   As a player sharing plans with friends, I want to copy a plan from my app and have others paste it into theirs (or into the game) so sharing remains easy and text-based.
   As a newbro, I want the app to automatically add prerequisite skills when I create plans so I don’t end up with impossible or incomplete skill paths.
6. Functional Requirements
   6.1 Skill Data & Dependencies
   Skill metadata loading
   The system must load and cache static EVE skill data (ID, name, rank, primary/secondary attributes, prerequisites) from a trusted source (e.g., SDE / skills.json).
   Dependency closure
   When a user adds a skill with target level N to a plan, the system must ensure all prerequisite skills and levels are present in the plan.
   Missing prerequisites must be auto-inserted, with clear indication in the UI.
   Dependency integrity
   When a user removes a skill, the system must warn if that skill is a prerequisite for another skill in the plan and prevent accidental invalid states unless the user confirms.
   6.2 Plan Library & CRUD
   Plan ownership
   Each plan is owned by a single user and is not visible to others unless explicitly shared via exported text.
   Plan structure
   A plan stores: name, description, optional tags, created/updated timestamps, and an ordered list of items (skillId, targetLevel, position, optional note).
   Plan operations
   Users can create, edit, duplicate, and archive/delete plans.
   Duplication creates a new plan with copied items and metadata but a new identity.
   Archiving / soft delete
   Archived/deleted plans are excluded from normal lists but can be restored or fully removed via separate flows if needed.
   6.3 Import/Export – In-Game Format
   Import from game
   Users can paste a raw text blob (in-game export format) into an import UI and mark it as “EVE format”.
   The system parses lines like “Skill Name N” into (skillId, level N), ignoring empty or whitespace-only lines.
   Unknown or invalid lines must be reported back to the user with clear errors.
   Plan creation from import
   On successful parse, the user can create a new plan or overwrite an existing one using the parsed skills (after dependency completion).
   Export to game
   Users can export a plan as a pure EVE-compatible text list of “Skill Name N”, one per line, in the current plan order.
   No app-specific metadata appears in this export; it must be safe to paste directly into the EVE client.
   6.4 Import/Export – App Plan Format
   App-specific text format
   The system must support a second text-based “App Plan Format” that includes metadata (e.g., JSON/YAML header or structured block).
   Format detection
   Import logic must distinguish between EVE format and App Plan Format (e.g., via a header marker), and parse accordingly.
   Rich import/export
   Exporting in App Plan Format includes: plan metadata (name, description, tags), attribute/remap assumptions, implants/boosters assumptions, and full skill list.
   Importing this format must recreate the plan with no loss of metadata.
   6.5 Attributes, Implants, Boosters & Time Estimation
   Scenarios without characters
   For a plan with no character assigned, users can configure:
   Attribute layout (Int, Mem, Per, Will, Cha).
   Implants: 0 to +5.
   Boosters: 0, 2, 4, 6, 8, 10, 12 (as discrete levels).
   The system computes per-skill and total training time from scratch under this scenario.
   Character-aware estimates
   For a plan with a character selected, the system uses:
   Character’s known attributes and remap state from ESI.
   Character’s implants/boosters where ESI allows, with UI prompts for missing pieces if needed.
   Estimates training time from current skill levels to plan targets.
   Time calculation engine
   Training time calculations must use EVE’s SP/hour and skill point formulas with rank, primary, and secondary attributes, plus modifiers (implants/boosters).
   Engine must handle both “from level 0” and “from current level” cases.
   6.6 Remap Modeling & Optimization
   Remap rules alignment
   A dedicated rules engine must model EVE’s real remap rules: base remaps, bonus remaps, cooldown periods, and how/when remaps are regained.
   Plan remap configuration
   A plan (or optimization run) can specify:
   Number of remaps to use.
   Whether to use character-specific remap availability or a generic model.
   Optimization modes
   Mode FULL: The optimizer can reorder skills freely (subject to prerequisite correctness) to minimize total time within remap constraints.
   Mode RESPECT_ORDER: The optimizer preserves the user’s overall ordering as much as possible, only adjusting where beneficial, and suggests where remaps should occur.
   Opt-in optimization
   Optimization is never applied automatically.
   A user manually triggers “Optimize Plan” to generate an optimized proposal.
   Optimization preview
   When optimization is triggered, the backend returns:
   Proposed new ordering and remap windows.
   Total time before vs after optimization.
   Markers of changed segments (for UI highlighting).
   The plan remains unchanged until the user explicitly accepts the proposal.
   Apply optimized plan
   Applying optimization persists the new ordering and associated remap metadata only if the plan has not changed since the preview (to avoid stale application).
   6.7 Plan–Character Assignment & Progress
   Plan–character link
   Users can assign any plan to any of their linked characters.
   Multiple characters can be assigned the same plan independently.
   Progress computation
   For each plan + character:
   Mark skills that are fully trained (character level ≥ plan level).
   Mark skills partially trained.
   Mark skills not started.
   Compute percentage of total plan SP completed and time remaining under current conditions.
   Progress display
   UI must show:
   Overall completion percentage.
   Estimated remaining training time.
   Breakdown of skills by status (complete/in progress/not started).
   6.8 In-Game Queue Comparison
   Queue retrieval
   For an assigned plan, the system fetches the character’s skill queue via ESI, within rate limits.
   Comparison logic
   Determine:
   Skills in the plan missing from the queue.
   Skills at lower target levels in the queue than in the plan.
   Extra skills in the queue not present in the plan (informational).
   Significant ordering differences (beyond a configurable tolerance).
   Queue status
   Return a status per plan + character:
   MATCHED: Queue aligns closely with plan.
   PARTIAL: Some skills/levels missing or order deviates.
   MISMATCHED: Plan is largely not present or diverges heavily.
   UI must show a clear badge (e.g., “Plan set up”, “Partially set up”, “Not set up”).
   6.9 Discord Notifications
   Settings integration
   Extend the existing Discord notification settings page to add toggles for:
   Upcoming remaps (must-have).
   Plan completion (optional but supported).
   All toggles are off by default.
   Remap notifications
   For each remap boundary in an assigned plan (where optimization/remap configuration exists), schedule Discord notifications at:
   3 days before.
   1 day before.
   1 hour before.
   Plan completion notifications
   For each assigned plan, using current estimates, schedule Discord notifications at:
   3 days before estimated completion.
   1 day before.
   1 hour before.
   Notification conditions
   Before sending, each scheduled notification must verify:
   The plan is still assigned to that character.
   Notifications are still enabled.
   The relevant event (remap or completion) is still expected at roughly that time (within acceptable drift).
   Idempotency
   Each notification event is fired once, even if recalculations or retries occur.
   6.10 UI & UX
   Skill Plan hub
   Provide a skill plan overview page listing:
   All plans (with filters/search).
   Plan status (e.g., used by N characters, tags).
   Support simple search by name and optional tags.
   Plan detail
   Show:
   Metadata (name, description, tags).
   Skill list with order and levels (with dependency indication).
   Time estimates for:
   Generic scenario (if configured).
   Selected character (if any).
   Remap blocks and recommended attributes.
   Character assignment control and progress.
   In-game queue status.
   Clear format modes
   Distinct UI affordances for:
   “Import from EVE” vs “Import from App text”.
   “Export for EVE” vs “Export for App sharing”.
   Explain which format to use for which target.
7. Non-Functional Requirements
   Performance
   Training time calculations and optimization previews should complete within 1–2 seconds for typical plans (≈100–300 skills).
   Imports of large pasted plans should remain responsive and not block the UI.
   Reliability & Data Integrity
   Plan CRUD operations must be transactional; partial updates should not result in broken or partially saved plans.
   Plan–character assignments and notifications must remain consistent even across restarts (e.g., via durable job/queue storage).
   ESI Rate Limiting & Freshness
   ESI calls (skills, queue, attributes, remaps) must respect rate limits and use caching with sensible TTLs.
   UI should display last updated timestamps for character data relevant to plans.
   Security & Privacy
   Plans are only accessible and modifiable by their owner.
   Character data is scoped to authenticated users and existing ESI scopes; no unnecessary scopes are requested.
   Maintainability
   The Skill Plan module, optimization engine, and remap rules service should be separated into clear components for future enhancement (e.g., corp tools, public plans).
   UX Consistency
   Follow the existing design system and components for settings, tables/lists, and detail views.
   All errors (parsing, ESI failures, optimization failures) should be displayed with clear, actionable messages.
   Observability
   Key operations (imports, optimizations, notification scheduling) should be logged with enough detail to debug issues.
8. Enhancement & Expansion Ideas
   8.1 Near-Term Enhancements (High-impact, low/medium effort)
   Preset plan templates
   Provide curated starter plans (e.g., “PI Alt Basic”, “Skill Farm Alpha”, “Newbro PvE”) that users can clone and customize.
   Multiple optimization strategies
   Offer more than one optimization profile (e.g., “Fastest overall”, “Minimize remaps”, “Front-load usability skills”), selectable in the optimization preview.
   Per-skill annotations
   Allow users to add short notes to plan items (e.g., “After this level you can start PI on most planets”).
   Plan groups/folders
   Lightweight grouping of plans (e.g., “Industry”, “Combat”, “Alts”) for better organization.
   8.2 Longer-Term Roadmap (High-impact, higher effort)
   Public / shared libraries
   Public or corp-shared plan collections with search, ratings, and tagging.
   Corp/alliance doctrines
   Corp-level required/recommended plans attached to doctrines, with dashboards showing member progress.
   Advanced analytics
   Historical tracking of plan completion, SP investment by plan type, and “time saved by optimization” stats.
   Cross-server or external sharing
   One-click links for sharing plans outside the app (e.g., web links that open into the app with import preview).
   8.3 Nice-to-Have / Polish
   Timeline visualization
   A timeline/roadmap view that shows skill milestones over time (e.g., “At this date you can fly X ship”).
   What-if sliders
   Interactive controls to tweak implants/boosters or remap counts and instantly see changes to total time.
   Inline ESI status indicators
   Live mini-indicators in plan lists showing when character data was last synced.
9. Assumptions & Dependencies
   Assumptions
   Static EVE skill data (SDE) is already available or can be added as a reliable data source.
   Existing auth and character-linking flows are in place and can be reused.
   Discord integration and a general notification/job system already exist and can be extended.
   Players are comfortable with copy/paste workflows for moving plans between the game and the app.
   Dependencies
   ESI endpoints for:
   Character skills and skill levels.
   Skill queue.
   Attributes, remap information, and implants (where available).
   Existing notification settings UI and Discord delivery pipeline.
   Existing design system/components for lists, detail pages, and settings.
10. Risks, Open Questions, and Decisions Needed
    Remap rule accuracy
    Risk: Incomplete or outdated understanding of EVE’s remap mechanics could produce misleading schedules.
    Mitigation: Verify against CCP docs and community resources; encapsulate logic in a dedicated service for easy correction.
    ESI limitations
    Risk: Limited visibility into implants, boosters, or exact remap cooldowns could reduce estimate precision.
    Mitigation: Allow manual overrides and clearly communicate where assumptions are used.
    Optimization complexity
    Risk: Exact optimization may be too slow for very large plans.
    Mitigation: Use heuristic/greedy algorithms and cap plan sizes or optimization depth if needed.
    Notification drift
    Risk: Estimated times (remaps, completion) may drift as players change queues or attributes without immediate refresh.
    Mitigation: Recalculate schedules periodically and near key events; document that times are approximate.
    User confusion on formats
    Risk: Users might mix up EVE format and App Plan Format.
    Mitigation: Very clear labels, helper text, and separate UI entry points for each.
