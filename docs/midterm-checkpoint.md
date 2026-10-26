# Midterm Checkpoint: T10 - Manage Service Request Status

## 1. Developer Information
- **Name:** France Rivera
- **GitHub Username:** francerivera
- **Primary Technology Stack:** JavaScript (Node.js / Express.js / SQLite)
- **T10 Branch:** `feature/t10-service-request-status`

---

## 2. My T10 Implementation
The status workflow is managed by `ServiceRequestStatusService` located in `src/services/ServiceRequestStatusService.js`. When a status update is requested, the service retrieves the target record from SQLite using `ServiceRequestRepository.findById(serviceRequestId)`. If the request does not exist, it safely returns `{ success: false, notFound: true }` without modifying persistence. Next, the requested target status is validated against supported status values (`Pending`, `In Progress`, `Completed`, `Cancelled`); unsupported values or same-status requests are rejected. The current persisted status is inspected against an explicit state-transition map (`allowedTransitions`) to ensure valid progression (`Pending` -> `In Progress`/`Cancelled`, `In Progress` -> `Completed`/`Cancelled`). If valid, `ServiceRequestRepository.updateStatus(serviceRequestId, newStatus)` executes a parameterized SQL `UPDATE` statement targeting strictly `WHERE id = ?`, and the updated `ServiceRequest` model object is returned.

---

## 3. My Transition Rules
My implementation enforces the following lifecycle transition matrix:
- **`Pending` -> `In Progress`**: Allowed.
- **`Pending` -> `Cancelled`**: Allowed.
- **`In Progress` -> `Completed`**: Allowed.
- **`In Progress` -> `Cancelled`**: Allowed.

### Key Rationale & Enforcement:
- **`Pending` to `Completed` is rejected**: A service request must first be assigned and set to `In Progress` before work can be marked as `Completed`. Jumping directly to `Completed` bypasses operational processing.
- **`Completed` is terminal**: A completed request represents a finished transaction; no further transitions (`Pending`, `In Progress`, or `Cancelled`) are allowed.
- **`Cancelled` is terminal**: A cancelled request represents a terminated workflow; requests cannot be reopened or transitioned once cancelled.
- **Same-status requests are rejected**: Requesting the current status (e.g., `Pending` to `Pending`) returns `invalidTransition: true` and `sameStatus: true` to evaluate actual state change behavior rather than no-op assignments.

---

## 4. Files I Changed
1. **`src/repositories/ServiceRequestRepository.js`**: Extended the repository with `updateStatus(serviceRequestId, newStatus)`, executing parameterized SQL `UPDATE service_requests SET status = ? WHERE id = ?`.
2. **`src/services/ServiceRequestStatusService.js`**: Created the application service layer enforcing status lookup, supported status checks, transition rule validation, and persistence coordination.
3. **`test/serviceRequestStatus.test.js`**: Created 14 automated unit test scenarios covering all 13 required T10 requirements plus 1 student-designed test.

---

## 5. Problem I Encountered
During initial test setup for terminal states (`Completed` and `Cancelled`), attempting sequential status updates in test helpers threw a TypeError when calling `statusService.updateStatus` without passing the repository instance correctly. Investigation showed that `ServiceRequestStatusService` constructor defaulted to creating a new `ServiceRequestRepository` instance with the default disk file connection (`data/csms.db`) instead of sharing the test's `:memory:` database connection. This was resolved by explicitly injecting the shared `:memory:` `serviceRequestRepo` into `new ServiceRequestStatusService(serviceRequestRepo)` during test setup.

---

## 6. My Student-Designed Test
- **Test Name:** `Student-Designed Test - Full Lifecycle Status Progression and Sequential Independence`
- **What the Test Verifies:** Verifies that multiple distinct Service Requests belonging to the same Resident undergo completely independent lifecycle progressions (`Pending` -> `In Progress` -> `Completed` vs. `Pending` -> `Cancelled`), and that once both reach their respective terminal states (`Completed` and `Cancelled`), further transition attempts on either object fail independently while keeping SQLite persistence consistent.
- **Why I Added This Test:** To prove that state transitions strictly isolate target records by primary key `id` without causing side effects across multiple requests owned by the same resident.

---

## 7. Tools and References Used
- **Official Documentation:** Node.js v24 `DatabaseSync` (SQLite) & `node:test` runner documentation.
- **IDE / Developer Tools:** VS Code / Antigravity IDE for code editing, debugging, and automated test execution.
- **AI Coding Assistant:** Antigravity AI Assistant was utilized to verify state transition matrix completeness, maintain strict domain layer separation, and draft automated test cases according to project rubrics.
