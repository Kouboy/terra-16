# Security Specification — Terra 16 Firestore Fortress

## 1. Data Invariants & Master Source of Truth
1. **Default-Deny Catch-All**: Every path not explicitly matched under `/explorers/{userId}`, `/explorers/{userId}/discoveries/{discoveryId}`, `/explorers/{userId}/specimens/{specimenId}`, and `/cairns/{cairnId}` is strictly denied (`allow read, write: if false;`).
2. **Verified Identity & Zero PII**: Only signed-in users with `request.auth.token.email_verified == true` may read or write Firestore documents. No emails, phone numbers, or addresses are stored in any Firestore document.
3. **Master Gate Relational Sync**:
   - `/explorers/{userId}` is the parent root of truth (`userId == request.auth.uid && data.ownerId == request.auth.uid`).
   - Every `/explorers/{userId}/discoveries/{discoveryId}` and `/explorers/{userId}/specimens/{specimenId}` write verifies via `exists()` and `get()` (or `existsAfter()`/`getAfter()` for atomic batch creation) that `/explorers/$(userId)` exists and its `ownerId == request.auth.uid`.
   - Every `/cairns/{cairnId}` creation verifies that the authenticated author has genuinely unlocked that POI (`exists(/databases/$(database)/documents/explorers/$(request.auth.uid)/discoveries/$(incoming().poiId))`) and uses deterministic ID `${authorId}_${poiId}` (one cairn per explorer per POI).
4. **Strict Blueprints & Action-Based Updates**:
   - `isValidExplorerProfile(data)`, `isValidJournalDiscovery(data)`, `isValidExplorerSpecimen(data)`, and `isValidExplorerCairn(data)` enforce `hasAll` + `hasOnly` keys, exact types, regex IDs (`^[a-zA-Z0-9_\-]+$`), string `.size()` bounds, numeric bounds (`walkedMeters` in `[0, 100000000]`, `harvestCount` in `[1, 100000]`), enum whitelists (`domain`, `affinity`, `gender`/`authorGender`, `avatarPreset`/`authorAvatarPreset`, `skinTone`/`authorSkinTone`, `headgearId`/`authorHeadgearId`, `outfitId`/`authorOutfitId`, `toolId`, `packId`, `tag`, `visibility`), and bounded arrays (`completedMissions.size() <= 50`, `relatedPoiIds.size() <= 10`).
   - Updates wrap `isValid[Entity](incoming())`, enforce immutable fields (`ownerId`/`authorId`, `createdAt`/`discoveredAt`/`firstCollectedAt`, `specimenId`, `domain`), monotonic counters (`totalXp`, `discoveriesCount`, `walkedMeters`, `harvestCount`) EXCEPT during an explicit full-zero Character Reset (`Action 3`, where `totalXp == 0`, all guild XPs `== 0`, `walkedMeters == 0`, `discoveriesCount == 0`, and `completedMissions.size() == 0`), enforce `updatedAt == request.time`, and restrict changed keys with `affectedKeys().hasOnly(...)`.
   - `allow delete` on `/explorers/{userId}/discoveries/{discoveryId}` and `/explorers/{userId}/specimens/{specimenId}` is restricted strictly to the verified owner (`request.auth.uid == userId && existing().ownerId == request.auth.uid`) with Master Gate parent verification (`hasExistingExplorerParent(userId)`).
5. **Query Enforcer (Cost-Optimized List)**:
   - `allow list` on `/explorers/{userId}/discoveries/{discoveryId}` and `/explorers/{userId}/specimens/{specimenId}` checks `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls.
   - `allow list` on `/cairns/{cairnId}` requires `isVerified() && resource.data.visibility == 'public'` without `get()`/`exists()` calls.

## 2. Adversarial Payloads ("Dirty Dozen" + Cairn, Cosmetics & Reset Hardening)
1. **Unauthenticated Write**: Creating `/explorers/user_1` or `/cairns/user_1_poi_1` with `auth == null`.
2. **Unverified Email Spoof**: Creating `/explorers/user_1` with `email_verified: false`.
3. **Identity Spoofing (Cross-User Profile / Cairn)**: User `attacker_1` creating `/explorers/victim_1` or `/cairns/victim_1_poi_1`.
4. **Shadow Ghost Field Injection**: Updating `/explorers/user_1` with extra key `"isAdmin": true`.
5. **ID Resource Poisoning**: Creating `/explorers/user_1/discoveries/bad$id!with/slash` or 200-char ID.
6. **Orphaned Subcollection / Undiscovered Cairn Write**: Creating `/explorers/user_1/discoveries/poi_1` without parent profile, or placing `/cairns/user_1_poi_1` without having unlocked `poi_1`.
7. **Unbounded Array / Denial of Wallet**: Setting `completedMissions` with 60 items (> 50 max) or non-string first item.
8. **String Oversize Attack**: Setting `personalNote` > 2000 chars or cairn `message` > 280 chars.
9. **Client Timestamp Forgery**: Setting `createdAt` or `updatedAt` to a past/future client timestamp instead of `request.time`.
10. **Immutable Field Mutation**: Updating `xpAwarded`, `category`, `poiId`, or `discoveredAt` on an existing `JournalDiscovery`.
11. **Value Poisoning on Whitelisted Update Key**: Updating `gender`, `outfitId`, `headgearId`, `avatarPreset`, `toolId`, `packId`, or `walkedMeters` with an invalid type, negative number, or out-of-enum string.
12. **Cross-Tenant List Scraping & Unauthorized Cairn Deletion**: Authenticated `attacker_1` listing `/explorers/victim_1/discoveries` or deleting `/cairns/user_1_poi_1`.
13. **Partial Reset Bypass & Cross-User Discovery Deletion**: Attempting to decrease `totalXp` from `100` to non-zero `50` via Action 3, or `attacker_1` attempting to delete `/explorers/user_1/discoveries/osm_node_12345`.
14. **Cairn Author Avatar Enum Poisoning**: Placing or updating `/cairns/user_1_poi_1` with an out-of-enum `authorGender` or `authorOutfitId`.


