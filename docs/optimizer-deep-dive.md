# Optimizer Deep Dive

This document explains how the NFL Link Game optimizer works, why it is structured the way it is, what tradeoffs it is making, and how to explain it clearly to someone else.

It is based on the current implementation in:

- `lib/dev-puzzle.ts`
- `app/dev/page.tsx`
- `app/api/optimal-lineup/route.ts`
- `lib/puzzle-rules.ts`
- `lib/scoring.ts`

## 1. The short version

The optimizer is a two-layer search system:

1. It searches for a good puzzle shape.
2. For each candidate puzzle shape, it solves for the best possible 5-player lineup.

That distinction is the whole story.

Most people think the hard part is "pick the best 5 players." That is only the inner problem. The harder problem is deciding which puzzle to even test:

- what time range to use
- what link rule to use
- what 5 slot parameters to use
- whether lineup-wide restrictions like `One-Each Lock` or `No QBs` are active

The optimizer is not impressive because it checks everything. It is impressive because it avoids checking most things.

## 2. Why this is a hard problem

The search space is huge.

On the dev side, the system already frames it roughly like this:

- active link types: `11`
- slot parameters in the dev pool: `165`
- lineup-rule modes: `3`
- full consecutive year windows from `2000-2025`: `351`

That produces a rough full builder search space of about `1.33 quadrillion` possible puzzle shapes before even considering the player-lineup combinations inside each puzzle.

If you tried to brute force that whole space, it would be hopeless. So the optimizer is built around one core idea:

Reduce the effective search space as early and as often as possible.

## 3. What the optimizer is actually trying to do

The optimizer is not trying to prove the single globally best puzzle over every possible configuration.

Its real job is to:

- generate puzzle candidates that look promising
- reject impossible or low-value puzzle candidates quickly
- run expensive exact solving only on the strongest survivors
- do this fast enough that the tool still feels usable

So the system is best described as:

- constrained combinatorial search
- guided by heuristics
- accelerated by pruning
- improved over time with persistent memory

## 4. The two layers

## 4.1 Outer layer: puzzle generation

The outer layer chooses the puzzle definition:

- start season / end season
- relationship rule
- 5 slot rules
- lineup-wide toggle mode

This mostly lives in:

- `app/dev/page.tsx`
- `lib/dev-puzzle.ts`

## 4.2 Inner layer: lineup solving

Once the outer layer proposes a puzzle, the inner layer solves:

- which eligible player should fill each slot
- while keeping players unique
- while satisfying puzzle-wide rules
- while maximizing final score

This mostly lives in:

- `app/api/optimal-lineup/route.ts`
- `lib/dev-puzzle.ts`

This separation matters when explaining the system. The generator and the solver are related, but they are not the same thing.

## 5. Scoring model

The current scoring model is:

- `base_score = sum of the 5 players' fantasy points in the chosen time range`
- `final_score = base_score * multiplier`

The multiplier comes from active links:

- each active link adds `10%`
- `0 links = 1.00x`
- `5 links = 1.50x`
- `10 links = 2.00x`

That means the optimizer is balancing two forces:

- raw fantasy production
- connectivity between the selected players

So the best lineup is not always just the 5 highest-scoring players. A slightly lower raw-score lineup can win if it creates enough extra links to increase the multiplier.

## 6. Puzzle-wide lineup rules

The optimizer can enforce lineup-wide restrictions beyond the slot rules themselves.

These are implemented in `lib/puzzle-rules.ts`.

## 6.1 Open lineup

This is the default mode.

There are no extra lineup-composition restrictions besides the slot rules.

## 6.2 One-Each Lock

This means the final lineup must contain:

- exactly `1 QB`
- exactly `1 RB`
- exactly `1 WR`
- exactly `1 TE`
- plus `1` extra `RB/WR/TE`

Those positions can appear in any slot. This is not a fixed-slot overlay anymore.

## 6.3 No QBs

No quarterback is allowed anywhere in the final lineup.

## 6.4 Why these rules matter

The optimizer does not just check these at the end. It also uses partial feasibility checks while building lineups, which allows it to kill bad branches early.

That is one of the more important performance tricks in the whole system.

## 7. Generator settings and what they mean

The core generator settings are defined in `lib/dev-puzzle.ts` through `DevGeneratorSettings`.

Important puzzle-quality controls:

- `targetPendingCount`
- `minActiveLinks`
- `usageThresholdTotal`
- `maxQbs`
- `minFantasyPointsPerSeason`
- `maxAttemptsPerPuzzle`
- `forcePositionLock`
- `forceNoQbs`

Important optimizer-behavior controls:

- `useAnchorSearch`
- `useSkeletonScoring`
- `useThresholdMemory`
- `anchorCount`
- `stageWidth`
- `beamWidth`

These settings do two different jobs:

1. They define what counts as a good puzzle.
2. They define how the optimizer explores the search space.

That split is important. Some settings change content quality. Others change runtime behavior.

## 8. High-level flow of one optimizer attempt

When the optimizer runs, the high-level flow is:

1. Generate a candidate puzzle skeleton.
2. Check memory to see whether this shape is already known to fail.
3. Build candidate pools for each slot.
4. Reject impossible shapes early.
5. Optionally rank staged skeletons before full solves.
6. Fully solve the best candidates.
7. Apply the queue thresholds.
8. If a puzzle qualifies, save it.
9. If auto queue is active, repeat.

That is the cleanest way to explain it to someone.

## 9. Candidate pool generation

For each slot, the optimizer builds a list of eligible players.

That process applies:

- the time-period filter
- the slot rule
- lineup-wide restrictions like `No QBs`
- puzzle-rule eligibility

If any slot ends up with zero eligible players, the config is dead immediately.

That is where this failure comes from:

- `No valid candidate pool for one or more slots.`

This is a structural failure, not a "bad score" failure. The puzzle literally cannot be solved.

## 10. Invalid-pool memory

The optimizer stores structural failures in persistent DB-backed tables:

- `dev_invalid_slot_candidate_cache`
- `dev_invalid_config_cache`

This lets the system remember:

- a slot rule that is dead for a given theme and lineup mode
- a full 5-slot config that is dead for a given theme and lineup mode

So if the system already proved that a shape is impossible, it can skip it next time without rebuilding the candidate pools.

This is one of the clearest examples of the optimizer "learning," even though it is not machine learning in the neural-network sense. It is persistent structural memory.

## 11. Why the lineup toggles are part of the cache key

Invalid-pool memory is not global across every mode.

The cache keys include lineup-mode state like:

- `position_overlay_enabled`
- `qb_exclusion_enabled`

That matters because a slot shape that is impossible under `No QBs` might be totally valid when QBs are allowed.

So the optimizer remembers failures separately by mode.

## 12. Threshold memory

Structural failures are only one class of failure.

The optimizer also caches exact configurations that failed your current quality thresholds:

- not enough active links
- too much prior player usage
- too many QBs
- not enough player impact

That cache lives in:

- `dev_threshold_failure_cache`

This is more nuanced than invalid-pool memory because threshold failures depend on current settings. A puzzle that fails today might pass later if you change the thresholds.

So threshold memory is keyed to the config plus the settings that caused the failure.

That is the right tradeoff:

- structural failures can be remembered broadly
- soft failures have to be settings-aware

## 13. Slot candidate metric cache

The optimizer also stores slot-level candidate metrics in:

- `dev_slot_candidate_metric_cache`

This is useful for faster early rejection.

For example, if the strongest candidate in a slot still cannot possibly meet the minimum impact floor for the current time window, the optimizer can reject the puzzle before doing a full solve.

This is a strong design pattern:

- use cheap metadata to skip expensive exact work

## 14. Staged anchor search

One of the biggest speed improvements is staged anchor search.

Instead of rerolling all 5 slot parameters every time, the optimizer can:

1. Generate a full candidate skeleton.
2. Lock part of it in place as anchors.
3. Mutate only the remaining open slots.
4. Explore that local neighborhood.
5. Only later throw the whole thing away and restart.

The relevant controls are:

- `useAnchorSearch`
- `anchorCount`
- `stageWidth`

Why this works:

Many failed puzzles are not bad in every dimension. Often 2 or 3 slots are fine and 1 or 2 are the real problem. So it is more efficient to keep the promising structure and mutate the weaker parts than to reroll everything from scratch.

This is one of the best parts of the optimizer to highlight when explaining it to someone technical.

## 15. Skeleton scoring

Full preview solves are expensive. Generating rough skeletons is much cheaper.

So when `useSkeletonScoring` is on, the optimizer:

- generates staged candidate skeletons
- scores them heuristically
- keeps only the strongest few
- fully previews only those survivors

This is where `beamWidth` matters.

In plain English:

The optimizer does a cheap first-pass ranking before spending exact-solve time.

That is a classic search optimization technique:

- cheap heuristic ranking first
- expensive exact evaluation second

## 16. Branch-and-bound lineup solving

Once a puzzle survives the outer filters, the inner solver takes over.

In `app/api/optimal-lineup/route.ts`, the lineup search uses branch-and-bound.

At a high level it:

1. builds the candidate lists
2. recursively fills the lineup one slot at a time
3. tracks current base score
4. tracks current active-link count
5. tracks which players are already used
6. keeps the best complete lineup found so far
7. prunes any branch that can no longer beat the current best

This is much faster than brute-forcing every legal 5-player combination.

## 17. Link-aware pruning

The solver does not only think in terms of fantasy points.

Because the final score depends on both:

- base score
- active links

the branch-and-bound logic keeps track of both.

For each partial branch, it estimates:

- the maximum base score still reachable
- the maximum number of links still reachable
- the best possible multiplier still reachable

If even that optimistic branch cannot beat the current best lineup, the branch is cut immediately.

That is a major reason the solver is practical.

## 18. Partial lineup feasibility checks

One subtle but important part of the solver is:

- `partialLineupCanStillSatisfyPuzzleRules(...)`

This lets the solver ask:

- given the positions already chosen
- and the slots still left
- is it still possible to satisfy `One-Each Lock` or `No QBs`?

If not, the branch dies immediately.

Without this, the solver would waste a lot of work building lineups that only become invalid at the very end.

## 19. Usage control and why it exists

The optimizer is not only trying to maximize score. It is also trying to protect puzzle quality.

One of the main quality controls is prior optimal-lineup usage.

Each optimal-lineup player can have a `previous_optimal_usage_count`, and the queue can constrain the total usage across the winning lineup.

That means the generator is not just solving a mathematical optimization problem. It is solving a content-design problem too:

- avoid stale puzzle answers
- avoid the same stars over and over
- keep future puzzle schedules fresher

This is one of the most important nuances in the whole system.

## 20. Impact threshold

The `minFantasyPointsPerSeason` setting prevents weak fringe players from showing up as optimal answers.

It scales with the width of the time range.

Examples:

- 1-season window with floor `50`: player must have at least `50`
- 5-season window with floor `50`: player must have at least `250`

This helps avoid:

- barely-used players
- tiny outlier seasons
- obscure low-impact answers that make the puzzle feel weak

## 21. Run Now vs Start Auto Queue

This is worth explaining clearly because the names are similar.

## 21.1 Run Now

`Run Now`:

- uses the current optimizer settings
- searches for exactly `1` qualifying pending puzzle
- saves it if found
- stops

## 21.2 Start Auto Queue

`Start Auto Queue`:

- uses the same optimizer process
- keeps repeating after each saved pending puzzle
- continues until the pending count reaches the queue target
- or until you stop it

So the difference is not the search logic. The difference is whether it stops after one success or keeps filling the queue.

## 22. Why pending puzzles affect future generation

Pending puzzles matter immediately.

Once a pending puzzle is saved:

- its optimal lineup is now part of the usage landscape
- future queue runs see those players as used
- future puzzle generation becomes less likely to resurface the same answer sets

This makes the queue dynamic, not stateless.

That is another good point to emphasize when explaining the design.

## 23. Observability and why the UI matters

The optimizer tab is not just decoration. It is part of the system.

It gives you:

- puzzles per minute
- rolling pace
- attempts logged
- brute-force vs current-budget estimates
- queue target and runtime state
- build history / optimizer journal

This matters because optimization work is hard to improve if it is invisible.

The UI turns the optimizer into something you can:

- tune
- measure
- compare over time
- explain to someone else

That is especially valuable from a portfolio perspective.

## 24. How to explain the system in plain English

If someone asks, "How does your optimizer work?", here is a short answer:

> It is a two-layer constrained search system. First it generates candidate puzzle shapes. Then it solves for the best lineup inside each candidate. Because the search space is massive, it uses staged search, branch-and-bound pruning, and persistent memory of failed configurations to skip bad options quickly and spend full solver time only on the strongest candidates.

If they want a slightly more detailed answer:

> The outer layer chooses the puzzle itself: time range, link rule, slot parameters, and optional lineup restrictions. The inner layer finds the best five-player lineup for that puzzle. The system remembers impossible slot combinations, caches threshold failures, ranks staged puzzle skeletons before full solving, and prunes lineup branches that cannot possibly beat the current best score.

If they want the polished portfolio version:

> The core challenge was turning an intractable combinatorial search problem into something usable in real time. I did that by separating puzzle generation from lineup optimization, then layering staged anchor search, heuristic ranking, branch-and-bound solving, structural failure memory, threshold-aware caching, and live optimizer telemetry.

## 25. Important nuances that are easy to miss

These are the details that are easy to gloss over but matter a lot.

## 25.1 It is not only optimizing score

It is also optimizing for:

- link richness
- freshness of answers
- player impact
- lineup composition
- puzzle quality

## 25.2 The generator and solver are separate

The generator decides which puzzle shape is worth testing.
The solver decides the best lineup inside that shape.

Those are different jobs.

## 25.3 Memory is split into structural and conditional failures

Structural memory:

- impossible candidate pools
- impossible slot/theme/toggle combinations

Conditional memory:

- configurations that fail the current thresholds

That split is one of the cleaner design choices in the system.

## 25.4 The queue is stateful

Pending puzzles are not just drafts sitting on the side. They influence future generation through usage tracking.

## 25.5 The UI is part of the engineering

The dev optimizer tab is not just a control panel. It is part of the observability and tuning loop.

## 26. Current strengths

The optimizer already has several strong qualities:

- it recognizes that brute force is impossible
- it uses staged anchor search
- it uses branch-and-bound for the lineup solver
- it prunes with both score and link optimism
- it remembers dead candidate-pool failures
- it remembers threshold-specific failures
- it uses slot-level cached metrics for early rejection
- it exposes logs and runtime metrics in the dev UI

That combination makes it much more interesting than a simple brute-force lineup script.

## 27. Current limitations

There are still real limits:

- the outer generator still uses randomness heavily
- heuristic ranking is good, but still fairly hand-tuned
- many soft failures are still only discovered after some preview work
- candidate-pool generation can still be expensive
- runtime depends a lot on the remaining viable search space

So the optimizer is strong, but it is still evolving.

## 28. Best next steps

These are the next improvements that would most strengthen the system.

## 28.1 Success priors

Track which regions of the search space succeed more often:

- time windows
- link types
- slot-rule families
- lineup modes

Then bias generation toward historically productive areas.

## 28.2 Partial skeleton memory

Right now memory is strongest at:

- bad slot/theme combos
- bad exact configs

The next step would be learning that certain anchor skeletons are usually weak, even before all slots are finalized.

## 28.3 Better slot prefiltering

Reduce each slot candidate pool more intelligently before solving:

- dominated-player elimination
- stronger caps
- better slot ordering

## 28.4 Failure breakdown analytics

Track why attempts fail:

- invalid candidate pool
- threshold memory skip
- low links
- high usage
- too many QBs
- low impact

That would make tuning much more systematic.

## 28.5 Per-run traces

Record a run summary like:

- candidates generated
- skipped by invalid memory
- skipped by threshold memory
- fully previewed
- winning config

That would make it easier to show optimizer progress over time.

## 29. The simplest way to remember it

If you only remember one explanation, use this:

> The optimizer solves a massive puzzle-design problem in two stages. First it searches for promising puzzle shapes. Then it solves for the best lineup inside those shapes. Since brute force is impossible, it relies on staged search, heuristics, pruning, and persistent memory of failed configurations to make the problem practical.

## 30. Final takeaway

The most important idea is this:

The optimizer is not strong because it checks an enormous number of possibilities.

It is strong because it keeps finding better ways not to check them.
