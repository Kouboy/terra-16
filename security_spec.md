# Security Specification — Terra 16 Firestore Fortress

## 1. Data Invariants & Master Source of Truth
1. **Default-Deny Catch-All**: Every path not explicitly matched under `/explorers/{userId}`, `/explorers/{userId}/discoveries/{discoveryId}`, `/explorers/{userId}/specimens/{specimenId}`, `/explorers/{userId}/archivistChests/{chestId}`, `/cairns/{cairnId}`, `/geocaches/{cacheId}`, `/geocaches/{cacheId}/logs/{finderId}`, `/challengeEntries/{entryId}`, and `/pantheonEntries/{explorerId}` is strictly denied (`allow read, write: if false;`).
2. **Verified Identity & Zero PII**: Only signed-in users with `request.auth.token.email_verified == true` may read or write Firestore documents. No emails, phone numbers, or addresses are stored in any Firestore document.
3. **Master Gate Relational Sync**:
   - `/explorers/{userId}` is the parent root of truth (`userId == request.auth.uid && data.ownerId == request.auth.uid`).
   - Every `/explorers/{userId}/discoveries/{discoveryId}`, `/explorers/{userId}/specimens/{specimenId}`, and `/explorers/{userId}/archivistChests/{chestId}` write verifies via `exists()` and `get()` (or `existsAfter()`/`getAfter()` for atomic batch creation) that `/explorers/$(userId)` exists and its `ownerId == request.auth.uid`.
   - Every `/cairns/{cairnId}` creation verifies that the authenticated author has genuinely unlocked that POI (`exists(/databases/$(database)/documents/explorers/$(request.auth.uid)/discoveries/$(incoming().poiId))`).
   - Every `/geocaches/{cacheId}` creation verifies `hasValidExplorerParent(request.auth.uid)` AND enforces physical/unlocked presence: either `incoming().placementMode == 'gps_live'` OR (`incoming().placementMode == 'unlocked_poi'` with `'anchorPoiId' in incoming()` and `hasUnlockedPoi(request.auth.uid, incoming().anchorPoiId)`). Furthermore, if `incoming().giftKind == 'specimen'`, the author must actually own that specimen in `/explorers/$(request.auth.uid)/specimens/$(incoming().giftId)`.
   - Every `/geocaches/{cacheId}/logs/{finderId}` write enforces `finderId == request.auth.uid`, verifies `hasValidExplorerParent(request.auth.uid)`, and verifies via `exists()` + `get()` that parent `/geocaches/$(cacheId)` exists with `visibility == 'public'`.
   - Every `/challengeEntries/{entryId}` write enforces `explorerId == request.auth.uid`, verifies `hasValidExplorerParent(request.auth.uid)` on create and `hasExistingExplorerParent(request.auth.uid)` on update/delete, and strictly requires monotonic non-decreasing `contributionCount >= existing().contributionCount` and `points >= existing().points` on update.
   - Every `/pantheonEntries/{explorerId}` write enforces `request.auth.uid == explorerId && incoming().explorerId == request.auth.uid`, verifies `hasValidExplorerParent(request.auth.uid)` on create and `hasExistingExplorerParent(request.auth.uid)` on update/delete, and strictly requires monotonic non-decreasing `pantheonScore >= existing().pantheonScore && totalXp >= existing().totalXp && discoveriesCount >= existing().discoveriesCount` on update.
4. **Strict Blueprints & Action-Based Updates**:
   - `isValidExplorerProfile`, `isValidJournalDiscovery`, `isValidExplorerSpecimen`, `isValidOpenedArchivistChest`, `isValidExplorerCairn`, `isValidExplorerGeocache`, `isValidGeocacheLogEntry`, `isValidCommunityChallengeEntry`, and `isValidPantheonLeaderboardEntry` enforce `hasAll` + `hasOnly` keys, exact types, regex IDs (`^[a-zA-Z0-9_\-]+$`), string `.size()` bounds, numeric bounds, enum whitelists, and bounded arrays.
   - Updates wrap `isValid[Entity](incoming())`, enforce immutable fields (`ownerId`/`authorId`/`finderId`/`explorerId`, `createdAt`/`discoveredAt`/`firstCollectedAt`/`openedAt`/`foundAt`, `chestId`, `cacheId`, `sectorKey`, `challengeId`, `cadence`, `periodKey`, `lat`, `lng`, `placementMode`, `giftKind`, `giftId`), enforce `updatedAt == request.time`, and restrict changed keys with `affectedKeys().hasOnly(...)`.
5. **Query Enforcer (Cost-Optimized List)**:
   - `allow list` on `/explorers/{userId}/discoveries/{discoveryId}`, `/explorers/{userId}/specimens/{specimenId}`, and `/explorers/{userId}/archivistChests/{chestId}` checks `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls.
   - `allow list` on `/cairns/{cairnId}`, `/geocaches/{cacheId}`, `/challengeEntries/{entryId}`, and `/pantheonEntries/{explorerId}` requires `isVerified() && resource.data.visibility == 'public'` without `get()`/`exists()` calls.
   - `allow list` on `/geocaches/{cacheId}/logs/{finderId}` requires `isVerified() && resource.data.visibility == 'public' && resource.data.cacheId == cacheId` without `get()`/`exists()` calls.

## 2. Adversarial Payloads ("Dirty Dozen" + Cairn, Geocache, Archivist Chest, Community Challenge & Pantheon Hardening)
1. **Unauthenticated Write**: Creating `/explorers/user_1`, `/cairns/user_1_poi_1`, `/geocaches/cache_1`, `/challengeEntries/entry_1`, or `/pantheonEntries/user_1` with `auth == null`.
2. **Unverified Email Spoof**: Creating `/explorers/user_1`, `/geocaches/cache_1`, `/challengeEntries/entry_1`, or `/pantheonEntries/user_1` with `email_verified: false`.
3. **Identity Spoofing (Cross-User Profile / Cairn / Geocache / Log / ChallengeEntry / PantheonEntry)**: User `attacker_1` creating `/explorers/victim_1`, `/geocaches/cache_1` with `authorId: 'victim_1'`, `/geocaches/cache_1/logs/victim_1`, `/challengeEntries/ch_victim_1`, or `/pantheonEntries/victim_1`.
4. **Shadow Ghost Field Injection**: Updating `/explorers/user_1`, `/geocaches/cache_1`, `/challengeEntries/entry_1`, or `/pantheonEntries/user_1` with extra key `"isAdmin": true` or `"rankOverride": 1`.
5. **ID Resource Poisoning**: Creating `/explorers/user_1/archivistChests/bad$id/slash`, `/challengeEntries/bad$id/slash`, or `/pantheonEntries/bad$id/slash`.
6. **Orphaned Subcollection / Ununlocked Geocache Anchor / Missing Parent**:
   - Creating `/explorers/user_1/archivistChests/chest_1`, `/challengeEntries/entry_1`, or `/pantheonEntries/user_1` without parent profile.
   - Creating `/geocaches/cache_1` with `placementMode: 'unlocked_poi'` on an ununlocked `anchorPoiId`.
   - Creating `/geocaches/cache_1` with `giftKind: 'specimen'` for a specimen not owned by the author.
   - Signing `/geocaches/nonexistent/logs/user_1` without parent geocache.
7. **Unbounded Array / Denial of Wallet**: Setting `completedMissions` with 60 items (> 50 max).
8. **String Oversize Attack**: Setting `personalNote` > 2000 chars, cairn `message` > 280 chars, geocache `riddleHint` > 320 chars, log `note` > 240 chars, or challenge/pantheon `regionLabel` > 100 chars.
9. **Client Timestamp Forgery**: Setting `createdAt`, `openedAt`, `foundAt`, or `updatedAt` to a client timestamp instead of `request.time`.
10. **Immutable Field Mutation & Score Decrement Attack**: Updating `lat`, `lng`, `giftId`, or `sectorKey` on `ExplorerGeocache`, mutating `challengeId`/`periodKey` or decreasing `points`/`contributionCount` on `CommunityChallengeEntry`, decreasing `pantheonScore`/`totalXp`/`discoveriesCount` on `PantheonLeaderboardEntry`, or mutating an `OpenedArchivistChest`.
11. **Value Poisoning on Whitelisted Update Key**: Updating `gender`, `outfitId`, `giftDomain`, `archetype`, `cadence`, `pinnedTrophyId`, or `placementMode` with an invalid type or out-of-enum string.
12. **Cross-Tenant List Scraping & Unauthorized Deletion**: `attacker_1` listing `/explorers/victim_1/archivistChests` or deleting `/geocaches/user_1_cache`, `/geocaches/cache_1/logs/user_1`, `/challengeEntries/ch_user_1`, or `/pantheonEntries/user_1`.
13. **Partial Reset Bypass**: Attempting to decrease `totalXp` from `100` to non-zero `50` via Action 3.
14. **Author/Finder/Explorer Avatar Enum Poisoning**: Placing `/geocaches/cache_1`, `/geocaches/cache_1/logs/user_1`, `/challengeEntries/entry_1`, or `/pantheonEntries/user_1` with an out-of-enum `outfitId`, `familiarId`, or `pinnedTrophyId`.
