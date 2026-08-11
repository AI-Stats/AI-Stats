# Design QA — expandable low-balance notification

- Expanded reference: `C:/Users/danie/AppData/Local/Temp/codex-clipboard-84b865f5-1107-454d-830d-cede7034431e.png` (1284 × 869)
- Collapsed reference: `C:/Users/danie/AppData/Local/Temp/codex-clipboard-45cadc83-8f3d-4aa7-bb60-4a3004267b2b.png` (1261 × 244)
- Implementation capture: `E:/ai-stats-public-worktrees/provider-route-geography-20260807/design-qa-notifications-implementation.png` (1265 × 745)
- Combined comparison: `E:/ai-stats-public-worktrees/provider-route-geography-20260807/design-qa-notifications-comparison.png` (1100 × 1223)
- Browser viewport: 1265 px wide desktop, dark theme
- State: `/settings/credits`, low-balance notification collapsed and expanded

## Full-view comparison evidence

The implementation follows the supplied notification pattern: a compact, bounded group; a single primary row with its switch aligned at the far edge; and a secondary threshold row revealed only when enabled. The surrounding Credits page remains unchanged. Phaseo's existing foreground, muted, border, background, primary, spacing, and radius tokens are retained instead of copying the reference application's lime accent.

## Focused comparison evidence

The combined comparison places both reference states directly beside the equivalent implementation states. The primary row height, left-aligned title and supporting copy, right-aligned switch, inset divider, and expanded threshold control are visually aligned. The reference's unrelated Chat Completion and Alert Email rows were intentionally omitted because this flow only manages the low-balance alert and always targets the workspace owner.

## Required fidelity surfaces

- Typography: existing Phaseo settings typography is preserved with a concise title and muted supporting copy.
- Spacing: the switch sits inside the row rather than floating across the page; the expanded row uses the same horizontal inset and a compact vertical rhythm.
- Radius and borders: the outer group uses the same secondary-surface radius and border treatment as the surrounding Credits settings.
- Motion: the threshold row expands and collapses using the existing 200 ms ease-out transition.
- Responsive layout: the threshold input stays compact on desktop and stacks beneath its label on narrow screens.
- Assets: no new raster or illustrative assets were required.

## Comparison history

1. P1 — the earlier standalone switch placement looked detached from its setting. Replaced it with the supplied bounded notification-row pattern.
2. P1 — the first functional browser pass returned `credits_update_failed`. Supabase inspection found the low-balance columns absent because an older migration version collided with an existing production migration. Reissued and applied the idempotent schema change under a unique version.
3. P2 — the expanded setting initially occupied an independent block. Moved the threshold into a compact second row inside the same group.

## Interaction and runtime checks

- Toggled the alert on in the in-app browser; the threshold row expanded and the save completed without an error toast.
- Toggled the alert off again; the row collapsed, the save completed, and the original disabled state was restored.
- Verified the four database columns and non-negative threshold constraint after migration.
- Supabase security and performance advisors were run; they reported existing project-wide notices, with no new issue caused by this column-only migration.

## Remaining findings

No actionable P0/P1/P2 visual or functional findings remain for this state.

final result: passed

---

# Design QA — Profile identity and Top Models polish

- Source visual truth: `C:/Users/danie/AppData/Local/Temp/codex-clipboard-53c196f7-5fb6-4ecc-8ffb-c8ea180229fc.png` (763 × 90 px)
- Implementation screenshot: `E:/ai-stats-public-worktrees/provider-route-geography-20260807/design-audit/profile-settings-roundedness/profile-avatar-top.png` (1126 × 912 px)
- Browser viewport: 1126 × 912 CSS px, desktop dark theme, device density 1
- State: `/settings/profile`, Tokens selected, Last 30 Days

## Full-view comparison evidence

The Profile page retains its existing hierarchy and layout. The Top Models heading and secondary label remain unchanged, while the usage action now aligns to the heading row and follows the shared compact ghost-button treatment.

## Focused comparison evidence

The supplied source is already a focused crop of the Top Models heading. The implementation screenshot keeps that region readable at native browser density and also shows the requested profile-photo and provider-logo radius changes. A separate browser clip was not used because the in-app capture backend did not preserve the requested clip coordinates reliably.

## Required fidelity surfaces

- Typography: heading size, weight, secondary label and action copy remain unchanged.
- Spacing and layout: the usage action is vertically aligned with the Top Models heading; its compact height does not disturb the subtitle rhythm.
- Colors and tokens: the action uses the existing ghost-button tokens and muted foreground; no new palette values were introduced.
- Image quality and assets: the existing user photo and provider logos are preserved without raster changes; only their masks/outlines changed.
- Copy and content: all existing labels remain intact.
- Radius: the profile avatar remains circular for a familiar identity treatment, while provider-logo outlines use the shared `rounded-lg` token (10 px).

## Comparison history

1. P2 — provider marks used full-circle outlines that conflicted with the settings radius language. Updated them to `rounded-lg`; the larger profile avatar remains circular after visual review.
2. P2 — “Open workspace usage” appeared as a detached text link. Rebuilt it with the existing compact ghost-button primitive and aligned it to the heading row.
3. Post-fix pass — no remaining P0/P1/P2 mismatch was visible in the requested surface.

## Interaction and runtime checks

- Confirmed the profile avatar is circular and provider marks compute to a 10 px radius.
- Confirmed the usage action remains a working link to `/settings/usage/overview` through the shared Button `asChild` composition.
- Web TypeScript and focused ESLint checks pass.

final result: passed
