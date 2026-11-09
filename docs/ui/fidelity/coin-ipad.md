# Coin detail on wide iPad

At 1180 × 820, the mobile app uses its existing iPad coin page. Wallet allocation shows up to eight funded sources and groups any remaining funded sources under Others. Sources with zero amount and value sit behind an expandable count row; the count includes all such sources. The wallet allocation page keeps its existing source list behavior.

The 16-source, 12-source, single-source, and three-day fixtures are covered at 1180 × 820 in `tests/e2e/ios-coin-layout-balance.spec.ts`. The legacy iPad page has no Open lots list, so the phone and desktop Open lots controls do not appear here.

At 820 × 1180, the coin metric cards use a three-card row followed by a two-card row on a 16 px grid. The metric content fills each card vertically. The allocation source rows provide their own bottom spacing, so the card adds no second bottom inset.
