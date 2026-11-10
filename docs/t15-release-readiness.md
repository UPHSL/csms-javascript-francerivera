# T15 Release-Readiness Document

## 1. Developer Information
- **Name:** France Raphael Rivera
- **GitHub Username:** francerivera
- **Technology Stack:** JavaScript with Express.js (Node.js & SQLite via `better-sqlite3`, EJS Templates)
- **T15 Branch:** `feature/t15-system-hardening`

---

## 2. Release Candidate Baseline
Prior to initiating T15 hardening, the system baseline on `main` was verified:
- **Application Startup:** Verified operational (starts Express server without warnings or unhandled rejections).
- **/health Endpoint:** Verified operational (responds HTTP 200 with `{ status: "ok", application: "Community Services Management System", version: "0.1.0" }`).
- **Dashboard (`/dashboard`):** Verified operational (renders metrics and recent requests correctly).
- **Resident Management (`/residents`):** Verified operational (listing, searching, registration, update, and deactivation working).
- **Service Request Management (`/service-requests`):** Verified operational (listing, text search, status filtering, submission, details viewing, and status workflow transitions working).
- **Starter through T14 Automated Tests:** All 163 tests passed (163 passed, 0 failed).

---

## 3. Hardening Changes

| Area | Issue or Risk Found | Action Taken | Files Changed | Test / Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Invalid & Missing Input Handling** | Malformed route parameters (e.g., `/residents/abc/edit` or `/service-requests/not-a-number`) could pass `NaN` down to service and persistence layers. | Added `parseIdentifier` defensive validator in controllers and repository lookups to validate positive integer IDs; returns controlled HTTP 404 views. | `src/controllers/residentController.js`, `src/controllers/serviceRequestController.js`, `src/repositories/ResidentRepository.js`, `src/repositories/ServiceRequestRepository.js` | `test/hardening.test.js` (Test 1) |
| **Persistence Integrity & Atomic Updates** | Risk of partial property persistence during invalid updates or rejected submissions. | Verified and enforced that validation occurs strictly prior to database mutations, guaranteeing zero partial persistence. | `src/services/ResidentUpdateService.js`, `src/services/ServiceRequestSubmissionService.js` | `test/hardening.test.js` (Test 2) |
| **HTTP & Mutation Safety** | Risk of state mutation during GET navigation, filter, or dashboard access. | Audited all GET routes; verified strictly read-only execution where zero inserts, updates, or deletes are executed. | `src/controllers/dashboardController.js`, `src/controllers/residentController.js`, `src/controllers/serviceRequestController.js` | `test/hardening.test.js` (Test 3) |
| **Workflow & Lifecycle Protection** | Risk of cross-domain state corruption (e.g. inactive resident submitting service request after deactivation). | Hardened lifecycle checks across Resident deactivation and Service Request submission with real-time dashboard reconciliation. | `src/services/ServiceRequestSubmissionService.js`, `src/services/DashboardService.js` | `test/hardening.test.js` (Test 4) |
| **Query & Database Safety** | Risk of SQL injection or unparameterized queries. | Confirmed 100% parameter binding (`?`) in all prepared SQL statements across repositories. | `src/repositories/ResidentRepository.js`, `src/repositories/ServiceRequestRepository.js` | Verified via code audit & parameterized test runs |
| **Interface Feedback & Error Handling** | Risk of raw stack trace or database error leakage during unhandled server errors. | Added a global Express error-handling middleware that catches unhandled errors and renders controlled user-safe responses without stack traces. | `src/app.js` | `test/hardening.test.js` (Test 1) |
| **Boundary & Repeatability Behavior** | Risk of non-deterministic ordering or boundary overflow in recent requests when multiple items share timestamps. | Validated deterministic tie-breaker sorting (`date_requested DESC, id DESC LIMIT 5`) and idempotent query behavior under high volume. | `src/repositories/ServiceRequestRepository.js` | `test/hardening.test.js` (Test 5) |
| **Repository Hygiene** | Potential presence of unneeded development artifacts or sensitive environment variables. | Audited working tree; verified `.gitignore` coverage, zero committed credentials, and zero leftover debug artifacts. | `.gitignore` | Full repository file tree audit |

---

## 4. Five New T15 Hardening Tests

### Test 1: Category 1 - Invalid or Malformed Input
- **Test Name:** `T15 Category 1 - Malformed Route Identifiers Return Controlled 404 Without Crashing or Exposing Stack Traces`
- **Category:** Invalid or Malformed Input
- **What It Verifies:** Verifies that requesting routes with non-numeric or malformed parameters (e.g., `/residents/not-a-number/edit`, `/service-requests/abc-invalid-id`, `/service-requests/-99`) safely yields HTTP 404 with friendly not-found templates rather than uncaught server crashes, raw SQL errors, or leaked stack traces.
- **Why It Adds Value Beyond Existing Tests:** Previous tests only validated numeric nonexistent IDs (e.g., `999999`); this test explicitly hardens route perimeter validation against malformed, non-integer, and negative route inputs.

### Test 2: Category 2 - Rejected Mutation Protects Persistence
- **Test Name:** `T15 Category 2 - Rejected Resident Partial Update Protects Database State Atomically`
- **Category:** Rejected Mutation Protects Persistence
- **What It Verifies:** Verifies that submitting an update with a valid first name but an invalid contact number fails validation (HTTP 400), and directly re-queries SQLite to confirm that the existing record remained completely unchanged (no partial overwrite of the first name).
- **Why It Adds Value Beyond Existing Tests:** Verifies atomicity at the persistence layer, proving that rejected updates cannot partially corrupt stored entity attributes.

### Test 3: Category 3 - Read-Only Request Safety
- **Test Name:** `T15 Category 3 - Repeated Read-Only Queries and Filter Requests Cause Zero Mutations in Persistence`
- **Category:** Read-Only Request Safety
- **What It Verifies:** Executes sequential read-only GET requests across `/dashboard`, `/residents?search=Juan`, `/service-requests?status=Pending`, and `/service-requests/:id`, and verifies that total record counts and persisted statuses in SQLite remain strictly identical before and after.
- **Why It Adds Value Beyond Existing Tests:** Proves that complex multi-module querying, filtering, and aggregate calculations have zero state mutation side-effects.

### Test 4: Category 4 - Cross-Feature Regression
- **Test Name:** `T15 Category 4 - Deactivated Resident Rejects Subsequent Service Request Submission and Preserves Dashboard Counts`
- **Category:** Cross-Feature Regression
- **What It Verifies:** Integrates Resident Deactivation (T07/T12), Service Request Eligibility (T09/T13), and Dashboard Aggregation (T14). Deactivates an active resident, confirms dashboard active/inactive counts update immediately, attempts to file a service request for that resident, verifies rejection with HTTP 400, confirms zero requests persisted, and validates dashboard totals remain zero.
- **Why It Adds Value Beyond Existing Tests:** Verifies whole-system cohesion across three distinct CSMS domains, ensuring lifecycle constraints are strictly enforced end-to-end.

### Test 5: Category 5 - Repeatability or Boundary Behavior
- **Test Name:** `T15 Category 5 - Recent Service Requests Ordering Handles Deterministic Tie-Breaking with High Volume Boundary`
- **Category:** Repeatability or Boundary Behavior
- **What It Verifies:** Inserts 7 service requests sharing the exact same calendar date (`2026-11-10`) with sequential IDs (1 to 7). Verifies `findRecent(5)` caps results strictly to 5, resolves date ties using descending ID order (`[7, 6, 5, 4, 3]`), excludes boundary records 1 and 2, and produces identical results on repeated execution.
- **Why It Adds Value Beyond Existing Tests:** Validates strict SQL LIMIT capping and deterministic multi-tier sorting under high-volume boundary conditions.

---

## 5. Full Regression Test Results
- **Test Command Used:** `npm test` (`node --test`)
- **Run 1 Result:** 168 passed, 0 failed, 0 skipped (duration: ~2.44s)
- **Run 2 Result:** 168 passed, 0 failed, 0 skipped (duration: ~2.46s)
- **Total Passing Tests:** 168

---

## 6. Manual Release Verification

| Verification Item | Result | Notes |
| :--- | :---: | :--- |
| Application starts | **PASS** | Server starts cleanly on port 3000 without errors or warnings. |
| /health works | **PASS** | Responds HTTP 200 with application name and version 0.1.0. |
| Dashboard loads | **PASS** | GET `/dashboard` displays operational metric cards and recent requests table. |
| Resident listing/search works | **PASS** | Displays resident records in T05 order; search input filters case-insensitively. |
| Valid Resident registration works | **PASS** | Submitting form persists active resident and redirects to index with success message. |
| Invalid Resident registration is rejected | **PASS** | Rejects missing/invalid fields with HTTP 400 and clear error banner; zero records created. |
| Resident update works | **PASS** | Modifies contact/address details while preserving original status and ID. |
| Resident deactivation works and record remains visible | **PASS** | Soft deactivation marks status Inactive; record remains visible and searchable. |
| Valid Service Request submission for Active Resident works | **PASS** | Submits request in Pending status with auto-generated ID; redirects with flash confirmation. |
| Missing/Inactive Resident submission is rejected | **PASS** | Rejects invalid resident association with HTTP 400; zero requests inserted into database. |
| Service Request search/filter/details work | **PASS** | Text search, dropdown status filter, and `/service-requests/:id` view all functional. |
| Valid Service Request workflow works | **PASS** | Follows Pending -> In Progress -> Completed lifecycle transitions with PRG redirects. |
| Invalid/terminal transition is rejected | **PASS** | Direct invalid transitions (e.g. Pending -> Completed) rejected; terminal records protected. |
| Dashboard reflects Resident/Service Request changes | **PASS** | Metrics update immediately after resident deactivation and service request transitions. |
| Read-only GET operations do not modify persistence | **PASS** | Repeated GET requests across all modules cause zero database mutations or side effects. |

---

## 7. Repository Hygiene Review
- **Debug Output:** Audited; no leftover `console.log` statements or temporary debug logging in production code.
- **Temporary Files:** Working tree clean; zero temporary scratch files committed.
- **Generated Build/Runtime Artifacts:** Runtime test database files (`:memory:`) properly scoped; no persistent test databases committed.
- **Accidental Local Database Files:** Local `.sqlite` files are ignored via `.gitignore`.
- **Commented-Out Abandoned Code:** Audited; no blocks of commented-out obsolete implementation.
- **Secrets & Credentials:** No API keys, tokens, or credentials exist in the codebase.
- **Broken Navigation / Links:** Verified reciprocal navigation across Dashboard, Residents, and Service Requests.
- **Direct SQL Parameter Binding:** All repository SQL queries strictly use parameterized statements (`?`).

---

## 8. Known Limitations
No known release-blocking limitations identified within the defined CSMS scope.

---

## 9. Release Candidate Statement
**READY FOR T16 FINAL EXAM**
