# Security Specification — Terra 16 Firestore Fortress

## 1. Data Invariants & Master Source of Truth
1. **Default-Deny Catch-All**: Every path not explicitly matched under `/explorers/{userId}`, `/explorers/{userId}/discoveries/{discoveryId}`, `/explorers/{userId}/specimens/{specimenId}`, `/explorers/{userId}/archivistChests/{chestId}`, `/cairns/{cairnId}`, `/geocaches/{cacheId}`, and `/geocaches/{cacheId}/logs/{finderId}` is strictly denied (`allow read, write: if false;`).
2. **Verified Identity & Zero PII**: Only signed-in users with `request.auth.token.email_verified == true` may read or write Firestore documents. No emails, phone numbers, or addresses are stored in any Firestore document.
3. **Master Gate Relational Sync**:
   - `/explorers/{userId}` is the parent root of truth (`userId == request.auth.uid && data.ownerId == request.auth.uid`).
   - Every `/explorers/{userId}/discoveries/{discoveryId}`, `/explorers/{userId}/specimens/{specimenId}`, and `/explorers/{userId}/archivistChests/{chestId}` write verifies via `exists()` and `get()` (or `existsAfter()`/`getAfter()` for atomic batch creation) that `/explorers/$(userId)` exists and its `ownerId == request.auth.uid`.
   - Every `/cairns/{cairnId}` creation verifies that the authenticated author has genuinely unlocked that POI (`exists(/databases/$(database)/documents/explorers/$(request.auth.uid)/discoveries/$(incoming().poiId))`) and uses deterministic ID `${authorId}_${poiId}`.
   - Every `/geocaches/{cacheId}` creation verifies `hasValidExplorerParent(request.auth.uid)` AND enforces physical/unlocked presence: either `incoming().placementMode == 'gps_live'` OR (`incoming().placementMode == 'unlocked_poi'` with `'anchorPoiId' in incoming()` and `hasUnlockedPoi(request.auth.uid, incoming().anchorPoiId)`). Furthermore, if `incoming().giftKind == 'specimen'`, the author must actually own that specimen in `/explorers/$(request.auth.uid)/specimens/$(incoming().giftId)`.
   - Every `/geocaches/{cacheId}/logs/{finderId}` write enforces `finderId == request.auth.uid`, verifies `hasValidExplorerParent(request.auth.uid)`, and verifies via `exists()` + `get()` that parent `/geocaches/$(cacheId)` exists with `visibility == 'public'` (Pillar 1 Master Gate, avoiding unbounded arrays on `/geocaches/{cacheId}`).
4. **Strict Blueprints & Action-Based Updates**:
   - `isValidExplorerProfile`, `isValidJournalDiscovery`, `isValidExplorerSpecimen`, `isValidOpenedArchivistChest`, `isValidExplorerCairn`, `isValidExplorerGeocache`, and `isValidGeocacheLogEntry` enforce `hasAll` + `hasOnly` keys, exact types, regex IDs (`^[a-zA-Z0-9_\-]+$`), string `.size()` bounds, numeric bounds, enum whitelists, and bounded arrays.
   - Updates wrap `isValid[Entity](incoming())`, enforce immutable fields (`ownerId`/`authorId`/`finderId`, `createdAt`/`discoveredAt`/`firstCollectedAt`/`openedAt`/`foundAt`, `chestId`, `cacheId`, `sectorKey`, `lat`, `lng`, `placementMode`, `giftKind`, `giftId`), enforce `updatedAt == request.time`, and restrict changed keys with `affectedKeys().hasOnly(...)`.
5. **Query Enforcer (Cost-Optimized List)**:
   - `allow list` on `/explorers/{userId}/discoveries/{discoveryId}`, `/explorers/{userId}/specimens/{specimenId}`, and `/explorers/{userId}/archivistChests/{chestId}` checks `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls.
   - `allow list` on `/cairns/{cairnId}` and `/geocaches/{cacheId}` requires `isVerified() && resource.data.visibility == 'public'` without `get()`/`exists()` calls.
   - `allow list` on `/geocaches/{cacheId}/logs/{finderId}` requires `isVerified() && resource.data.visibility == 'public' && resource.data.cacheId == cacheId` without `get()`/`exists()` calls.

## 2. Adversarial Payloads ("Dirty Dozen" + Cairn, Geocache & Archivist Chest Hardening)
1. **Unauthenticated Write**: Creating `/explorers/user_1`, `/cairns/user_1_poi_1`, or `/geocaches/cache_1` with `auth == null`.
2. **Unverified Email Spoof**: Creating `/explorers/user_1` or `/geocaches/cache_1` with `email_verified: false`.
3. **Identity Spoofing (Cross-User Profile / Cairn / Geocache / Log)**: User `attacker_1` creating `/explorers/victim_1`, `/geocaches/cache_1` with `authorId: 'victim_1'`, or `/geocaches/cache_1/logs/victim_1`.
4. **Shadow Ghost Field Injection**: Updating `/explorers/user_1` or `/geocaches/cache_1` with extra key `"isAdmin": true`.
5. **ID Resource Poisoning**: Creating `/explorers/user_1/archivistChests/bad$id/slash` or 200-char ID.
6. **Orphaned Subcollection / Ununlocked Geocache Anchor / Unowned Specimen Gift**:
   - Creating `/explorers/user_1/archivistChests/chest_1` without parent profile.
   - Creating `/geocaches/cache_1` with `placementMode: 'unlocked_poi'` on an ununlocked `anchorPoiId`.
   - Creating `/geocaches/cache_1` with `giftKind: 'specimen'` for a specimen not owned by the author.
   - Signing `/geocaches/nonexistent/logs/user_1` without parent geocache.
7. **Unbounded Array / Denial of Wallet**: Setting `completedMissions` with 60 items (> 50 max).
8. **String Oversize Attack**: Setting `personalNote` > 2000 chars, cairn `message` > 280 chars, geocache `riddleHint` > 320 chars, or log `note` > 240 chars.
9. **Client Timestamp Forgery**: Setting `createdAt`, `openedAt`, `foundAt`, or `updatedAt` to a client timestamp instead of `request.time`.
10. **Immutable Field Mutation**: Updating `lat`, `lng`, `giftId`, or `sectorKey` on an existing `ExplorerGeocache`, or mutating an `OpenedArchivistChest` (which is immutable once opened).
11. **Value Poisoning on Whitelisted Update Key**: Updating `gender`, `outfitId`, `giftDomain`, `archetype`, or `placementMode` with an invalid type or out-of-enum string.
12. **Cross-Tenant List Scraping & Unauthorized Deletion**: `attacker_1` listing `/explorers/victim_1/archivistChests` or deleting `/geocaches/user_1_cache` or `/geocaches/cache_1/logs/user_1`.
13. **Partial Reset Bypass**: Attempting to decrease `totalXp` from `100` to non-zero `50` via Action 3.
14. **Author/Finder Avatar Enum Poisoning**: Placing `/geocaches/cache_1` or `/geocaches/cache_1/logs/user_1` with an out-of-enum `authorOutfitId` or `finderOutfitId`.
