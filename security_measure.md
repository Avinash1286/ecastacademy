# Security Audit Findings (AuthZ/AuthN)

## Critical
- Admin mutations/queries bypass auth via `currentUserId` fallback (`convex/admin.ts`: requireAdmin helper lines ~20-48, used by `listUsers`, `updateUserRole`, `deleteUser`, `getAdminStats`, `listGenerationFailures`, `getFailureStats`, `resolveGenerationFailure`, `bulkResolveByErrorCode`). Any caller can pass an admin userId to gain admin rights with no session/JWT.
- Courses CRUD uses `requireAuthenticatedUserWithFallback` accepting client-supplied `currentUserId` (`convex/courses.ts` e.g., `createCourse` ~24, `updateCourse` ~55, `deleteCourse` ~110). Unauthenticated callers can impersonate any user by passing their ID.
- Capsule creation/visibility/progress trust caller-supplied user IDs with no auth (`convex/capsules.ts`: `getUserCapsules` ~45, `getCapsuleProgress` ~320, `createCapsule` ~390, `toggleCapsuleVisibility` ~120, `updateLessonProgress` ~770). Attackers can create/modify/read capsules for other users or update progress on their behalf.
- Enrollment flows lack auth (`convex/courses.ts`: `enrollInCourse` ~980, `unenrollFromCourse` ~1015, `isUserEnrolled` ~1050, `getEnrolledCourses` ~1070). Any caller can enroll/unenroll or enumerate enrollment for any user by passing their `userId`.
- Chat data disclosure: `getChatHistory` (`convex/chatSessions.ts` ~70) and `messages.list` (`convex/messages.ts` ~45) have no auth/ownership check. Anyone with `chatId`/`sessionId` can read another user’s chats.
- Generation jobs unauthenticated: `createGenerationJob` and `updateGenerationJob` (`convex/generationJobs.ts` ~110, ~160) take arbitrary IDs with no auth/ownership; attackers can create/update jobs for others’ capsules.

## High
- Videos CRUD insufficient authorization: `createVideo`/`updateVideo` allow any authenticated (or unauth via fallback `currentUserId`) user to create/modify any video (`convex/videos.ts` lines ~10, ~55). No ownership/admin check.
- Rate limit bucket manipulation unauthenticated: `checkRateLimit`/`recordRequest` (`convex/rateLimit.ts` ~40, ~70) take arbitrary bucket keys with no auth. Attackers can create or exhaust buckets for other users/operations.

## Medium
- Certificate listing information leak: `getUserCertificates` (`convex/certificates.ts` ~30) returns certificates for any `userId` without auth; allows enumeration of user achievements/emails if stored.
- `requireAuthenticatedUserWithFallback` pattern used widely (courses, capsules, videos) allows auth bypass whenever `currentUserId` is accepted from the client. Treat as design flaw unless guarded by server-only callers.

## Admin Route Protection
- Frontend middleware (`middleware.ts`) enforces admin role on `/admin/*` using NextAuth JWT. However, server-side Convex admin functions rely on the vulnerable `currentUserId` fallback, so admin-only enforcement is not reliable server-side (see Critical finding #1).

## Recommended Remediations
- Remove `currentUserId` fallback from server-side auth helpers for any client-exposed mutation/query. Require `ctx.auth` session and match against stored user.
- Add ownership checks using authenticated user for all mutations/queries that accept `userId`. Derive userId from session, not input.
- Require admin role via authenticated session for all admin operations; drop userId fallback.
- Add auth to enrollment, chat history/list, generation job, rate-limit mutations/queries. Enforce that the caller owns the target resource.
- For read endpoints exposing user-specific data (certificates, capsules, chats), ensure the requesting user matches the target user or has admin rights.

## Suggested Test Cases
- Call `admin.updateUserRole` with `currentUserId` set to a known admin ID while unauthenticated; expect rejection (currently succeeds).
- Attempt `courses.enrollInCourse` with another user’s ID; should be rejected.
- Toggle another user’s capsule visibility via `toggleCapsuleVisibility` with their capsuleId/userId; should be rejected.
- Fetch `getChatHistory` for another user’s `chatId`/`sessionId`; should require ownership.
- Create/update a video without a valid session but with `currentUserId` set; should fail.
- Record rate-limit requests against another user’s bucket; should require ownership/admin.
