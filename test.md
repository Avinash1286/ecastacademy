# Certification, Grading, and Enrollment Test Plan

This document describes comprehensive manual and automated test coverage for the certification pipeline, including enrollment, progress tracking, grading calculations, certificate issuance, and public verification. Align these tests with QA sign-off criteria before each release.

---

## 1. Test Environments
- **Local**: `npm run dev` + `convex dev`, seeded with realistic fixtures.
- **Staging**: Hosted instance with production-like network and auth providers (Google, email magic link).
- **Browsers**: Chrome (latest), Firefox (latest), Safari (latest), Edge (latest).
- **Devices**: Desktop (1440x900), Tablet (1024x768), Mobile (390x844).

---

## 2. Test Data Requirements
- Admin account with course creation permissions.
- Multiple learner accounts (active, suspended, newly registered).
- Courses representing each configuration:
  - Certification course with graded quizzes, assignments, and passing grade.
  - Non-certification course (no certificate expected).
  - Certification course with optional graded items, retake limits, and different passing thresholds.
- Content items covering quiz, video, text, and manual grade entry.
- Historical progress data for regression testing (some users partially complete courses).

---

## 3. Enrollment Flow Tests
1. **Happy Path Enrollment**
   - Steps: Learner enrolls in a certification course from `/dashboard`. Confirm enrollment record created, status `active`.
   - Expected: Course appears in "My Learnings", progress 0%.
2. **Duplicate Enrollment Attempt**
   - Steps: Enroll again.
   - Expected: No duplicate record, UI indicates user already enrolled.
3. **Admin-Enforced Enrollment**
   - Steps: Admin assigns course via admin panel.
   - Expected: Learner sees course immediately; audit log entry created.
4. **Suspended User**
   - Precondition: User status `suspended`.
   - Steps: Attempt enrollment.
   - Expected: Enrollment blocked; error toast referencing account status.
5. **Course Capacity / Closed Enrollment**
   - Given: Course flagged as full or closed.
   - Expected: Enrollment CTA disabled, tooltip explains reason.
6. **Enrollment Cancellation**
   - Steps: User drops course.
   - Expected: Status transitions to `withdrawn`, progress preserved for analytics.

---

## 4. Progress Recording & Grading
### 4.1 Video/Text Content
- Record completion event -> Progress row updated with `completed=true`, `progressPercentage=100`.
- Edge: Refresh mid-video -> ensure partial progress preserved.
- Edge: Retry completion when retakes disabled -> existing record unchanged.

### 4.2 Quizzes
1. **First Attempt Pass**
   - Submit quiz above passing score.
   - Expected: `quizAttempts` entry created, `progress` row `passed=true`, `percentage=score`.
2. **Multiple Attempts**
   - First attempt fail, second pass.
   - Expected: `bestScore` reflects higher result; `attempts` increments.
3. **Retake Limit**
   - Content flagged `allowRetakes=false`.
   - Expected: Second submission rejected with meaningful message.
4. **Manual Max Score Override**
   - Provide custom `maxScore` smaller than default; ensure percentage uses override.
5. **Time Tracking**
   - Submit with `timeSpent`. Verify stored on attempt record.

### 4.3 Assignments / Manual Scores
- Mark item complete with `score` provided via admin.
- Expected: `percentage` derived correctly; pass/fail honors item-level passing score.
- Edge: Manual score below passing threshold -> certificate eligibility remains false.

### 4.4 Progress Summary Calculations
- `calculateCourseProgress` results validated for:
  - Completed vs total items.
  - Graded item counts.
  - `overallGrade` computed from best scores.
  - `eligibleForCertificate` true only when every graded item passed and grade >= course threshold.
- Edge: Course without graded items -> overall grade `null`, eligible flag false.
- Edge: New graded item added after completion -> eligibility toggles to false until item passed.

---

## 5. Certificate Issuance Logic
### 5.1 Automatic Issuance via `requestCertificate`
1. **Happy Path**
   - Preconditions: All graded items passed, `overallGrade` >= passing grade.
   - Steps: Trigger request (via UI or mutation).
   - Expected: Certificate record created once; response `issued=true`.
2. **Idempotency**
   - Call request again.
   - Expected: Response `alreadyIssued=true`; no duplicate DB rows.
3. **Incomplete Graded Item**
   - Missing attempts.
   - Expected: Response `eligible=false`, reason indicates outstanding items.
4. **Failed Grade**
   - Overall grade below threshold.
   - Expected: `eligible=false`, reason includes grade details.
5. **Non-certification Course**
   - Attempt issuance.
   - Expected: `eligible=false`, reason "Not a certification course".
6. **User Not Found / Deleted**
   - Simulate by removing user record.
   - Expected: Graceful failure with descriptive message.
7. **Data Race**
   - Two requests in parallel.
   - Expected: Only one certificate created (unique constraint validated).

### 5.2 Certificate Content Validation
- Fields: `certificateId`, `courseName`, `userName`, `overallGrade`, `passedItems`, `totalGradedItems`, `completionDate`.
- Ensure `certificateId` format stable across environments.
- Validate `completionDate` equals issuance timestamp, not last attempt date.

### 5.3 Revocation Scenario
- If course is reconfigured or user loses eligibility, confirm existing certificates remain but UI displays warning.

---

## 6. Dashboard & Public Views
### 6.1 Dashboard Certificates List (`/dashboard/certificates`)
- Authenticated user sees cards sorted by completion date.
- Share button copies `/certificates/{id}`; clipboard integration tested via Cypress (if available).
- Back to Profile button returns to `/dashboard/profile` on all states (loading, empty, populated).
- Edge: Loading state skeleton visible while query pending.
- Edge: Unauthenticated redirect to sign-in card.

### 6.2 Certificate Detail (Dashboard & Public)
- Dashboard route: `/dashboard/certificates/{id}` delegates to shared component.
- Public route: `/certificates/{id}` accessible without auth.
- Query invalid ID -> friendly "Certificate Not Found" message.
- `Download / Print` triggers browser print dialog (desktop + iOS PDF).
- Verify `verificationLink` displays canonical URL without double slashes.
- Dark/light theme rendering parity.
- Mobile responsiveness: card padding adjusts, text wraps correctly.

### 6.3 Public Verification Flow
1. Copy link as logged-in user; open incognito.
   - Expected: Certificate visible, no auth challenge.
2. Attempt to access `/dashboard/certificates/{id}` while signed out.
   - Expected: Redirect to sign-in.
3. Tamper with query (`?source=dashboard`) -> ensures only back button behavior changes; no security impact.

---

## 7. Admin & Instructor Workflows
- Issue certificate manually via admin UI where applicable.
- Adjust passing grade after certificates issued -> confirm new completions require updated grade.
- Delete graded content item -> progress recalculates; certificate eligibility reevaluated.
- Migration scripts (if any) to backfill progress: verify no orphaned records.

---

## 8. API Contract Tests
- GraphQL/Convex query contracts serialized (TypeScript) include:
  - `api.progress.getUserCertificates`
  - `api.progress.getCertificate` (returns `null` when missing)
  - `api.certificates.requestCertificate`
  - `api.completions.recordCompletion`
- Automated tests should assert response schemas using mocked Convex client or integration harness.

---

## 9. Edge & Negative Cases Matrix
| Scenario | Setup | Action | Expected |
| --- | --- | --- | --- |
| Missing enrollment | User not enrolled | Submit completion mutation | Error `Not enrolled` |
| Progress spam | 20 rapid completion calls | Fire mutation concurrently | Only one canonical progress record; duplicates merged |
| Clock skew | Completion timestamp backdated | Run summary | Overall grade unaffected; certificate uses issuance timestamp |
| Partial data | Delete progress row mid-issuance | Trigger request | Graceful failure, no orphaned certificate |
| Locale variance | Browser locale `fr-FR` | Render certificate | Date and numbers formatted per locale, layout intact |
| Offline mode | Simulate network loss mid-save | Submit quiz | Frontend error toast; no inconsistent progress saved |

---

## 10. Automation Recommendations
- **Unit Tests**: Convex function handlers (mock DB) covering eligibility logic, percentage calculations, idempotency.
- **Integration Tests**: Cypress or Playwright flows for enrollment, course completion, certificate view/share.
- **Smoke Tests**: After deployment, run script to issue certificate for seeded user and validate public link.
- **Regression Pack**: Re-run after changes to `convex/completions.ts`, `convex/certificates.ts`, or dashboard UI.

---

## 11. Observability & Monitoring
- Confirm logging around certificate issuance (user ID, course ID, status).
- Add alerts for mutation failure spikes (`requestCertificate`, `recordCompletion`).
- Track analytics for certificate view/share events for UX insights.

---

## 12. Sign-off Checklist
- [ ] Enrollment flows verified on all device classes.
- [ ] Grading calculations validated against sample spreadsheet.
- [ ] Certificate issuance (manual + automated) confirmed, including duplicate prevention.
- [ ] Public verification link tested in incognito and unauthenticated states.
- [ ] Accessibility audit (contrast, keyboard nav, aria labels) on certificate views.
- [ ] All automated suites passing (`npm run lint`, `npm run test`, end-to-end suite).

Document findings and attach logs/screenshots for failures. Update this plan when new certificate features or edge cases are introduced.
