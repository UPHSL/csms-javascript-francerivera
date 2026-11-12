import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createDatabaseConnection } from "../src/database/db.js";
import { applicationConfig } from "../src/config/application.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { ServiceRequestRepository } from "../src/repositories/ServiceRequestRepository.js";

function createTestContext() {
  const db = createDatabaseConnection(":memory:");
  const app = createApp({ db });
  const residentRepository = new ResidentRepository(db);
  const serviceRequestRepository = new ServiceRequestRepository(db);

  return { db, app, residentRepository, serviceRequestRepository };
}

// ---------------------------------------------------------------------------
// PART B - AUTOMATED VERIFICATION OF THE RELEASE IDENTITY
// ---------------------------------------------------------------------------

test("Release Identity - Authoritative configuration reports CSMS v1.0.0", () => {
  assert.equal(applicationConfig.version, "1.0.0");
  assert.equal(applicationConfig.name, "Community Services Management System");
  assert.equal(applicationConfig.shortName, "CSMS");
});

test("Release Identity - Health status endpoint returns release metadata payload", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/health");

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"].includes("application/json"), true);
  assert.deepEqual(response.body, {
    status: "ok",
    application: "Community Services Management System",
    version: "1.0.0"
  });

  db.close();
});

test("Release Identity - Major interface views render authoritative v1.0.0 badge and footer", async () => {
  const { app, db } = createTestContext();

  const viewsToTest = [
    { route: "/", expectedBadge: /v1\.0\.0/ },
    { route: "/dashboard", expectedBadge: /v1\.0\.0/ },
    { route: "/residents", expectedBadge: /v1\.0\.0/ },
    { route: "/service-requests", expectedBadge: /v1\.0\.0/ }
  ];

  for (const { route, expectedBadge } of viewsToTest) {
    const res = await request(app).get(route);
    assert.equal(res.statusCode, 200, `Failed loading ${route}`);
    assert.match(res.text, expectedBadge, `Version badge missing on ${route}`);
    assert.match(
      res.text,
      /Community Services Management System/,
      `Application name missing on ${route}`
    );
    assert.match(
      res.text,
      /class="release-version"[^>]*>v1\.0\.0<\/span>/,
      `Standard release version footer missing on ${route}`
    );
  }

  db.close();
});

// ---------------------------------------------------------------------------
// PART C - STUDENT-DESIGNED FINAL EXAMINATION TEST
// Cross-module integration across Resident Management, Service Request Management,
// and Operational Dashboard backed by real SQLite persistence.
// ---------------------------------------------------------------------------

test("Final Exam - Cross-Module System Integration: Resident Lifecycle, Service Request Progression, Eligibility Enforcement, and Dashboard Synchronization", async () => {
  const { app, db } = createTestContext();

  // 1. Initial State: Clean database, Dashboard metrics report zero
  const initialDashRes = await request(app).get("/dashboard");
  assert.equal(initialDashRes.statusCode, 200);
  assert.match(initialDashRes.text, /id="totalResidentsValue">0</);
  assert.match(initialDashRes.text, /id="totalRequestsValue">0</);
  assert.match(initialDashRes.text, /id="openRequestsValue">0</);

  // 2. Module 1: Resident Registration (HTTP POST PRG)
  const registerRes = await request(app)
    .post("/residents/register")
    .type("form")
    .send({
      firstName: "Marcus",
      lastName: "Vance",
      address: "742 Evergreen Terrace",
      contactNumber: "09171234567",
      email: "marcus.vance@example.org"
    });

  assert.equal(registerRes.statusCode, 302);
  assert.match(registerRes.headers.location, /^\/residents/);

  // Verify resident was persisted with Active status and generated ID
  const residentsListRes = await request(app).get("/residents");
  assert.equal(residentsListRes.statusCode, 200);
  assert.match(residentsListRes.text, /<td>Marcus<\/td>/);
  assert.match(residentsListRes.text, /<td>Vance<\/td>/);
  assert.match(residentsListRes.text, /Active/);

  // 3. Module 3: Operational Dashboard updates reflecting new resident
  const dashAfterResident = await request(app).get("/dashboard");
  assert.equal(dashAfterResident.statusCode, 200);
  assert.match(dashAfterResident.text, /id="totalResidentsValue">1</);
  assert.match(dashAfterResident.text, /id="activeResidentsValue">1</);
  assert.match(dashAfterResident.text, /id="inactiveResidentsValue">0</);

  // 4. Module 2: Active Resident Submits Service Request (HTTP POST PRG)
  const submitRes = await request(app)
    .post("/service-requests/new")
    .type("form")
    .send({
      residentId: "1",
      serviceType: "Sanitation & Waste",
      description: "Bulky furniture pickup requested for curbside recycling.",
      dateRequested: "2026-11-12"
    });

  assert.equal(submitRes.statusCode, 302);
  assert.match(submitRes.headers.location, /^\/service-requests/);

  // Verify service request was persisted with Pending status
  const requestsListRes = await request(app).get("/service-requests");
  assert.equal(requestsListRes.statusCode, 200);
  assert.match(requestsListRes.text, /Sanitation &amp; Waste/);
  assert.match(requestsListRes.text, /Pending/);

  // 5. Module 3: Dashboard updates reflecting submitted request
  const dashAfterSubmit = await request(app).get("/dashboard");
  assert.equal(dashAfterSubmit.statusCode, 200);
  assert.match(dashAfterSubmit.text, /id="totalRequestsValue">1</);
  assert.match(dashAfterSubmit.text, /id="openRequestsValue">1</);
  assert.match(dashAfterSubmit.text, /id="pendingRequestsValue">1</);
  assert.match(dashAfterSubmit.text, /id="inProgressRequestsValue">0</);
  assert.match(dashAfterSubmit.text, /id="completedRequestsValue">0</);

  // 6. Module 2: Service Request Status Transition -> In Progress
  const progressRes = await request(app).post("/service-requests/1/start-processing");
  assert.equal(progressRes.statusCode, 302);
  assert.match(progressRes.headers.location, /^\/service-requests\/1/);

  // Verify dashboard reflects In Progress state (still open)
  const dashAfterProgress = await request(app).get("/dashboard");
  assert.equal(dashAfterProgress.statusCode, 200);
  assert.match(dashAfterProgress.text, /id="pendingRequestsValue">0</);
  assert.match(dashAfterProgress.text, /id="inProgressRequestsValue">1</);
  assert.match(dashAfterProgress.text, /id="openRequestsValue">1</);

  // 7. Module 2: Service Request Status Transition -> Completed (Terminal)
  const completeRes = await request(app).post("/service-requests/1/complete");
  assert.equal(completeRes.statusCode, 302);
  assert.match(completeRes.headers.location, /^\/service-requests\/1/);

  // Verify dashboard reflects Completed state (open count drops to 0)
  const dashAfterComplete = await request(app).get("/dashboard");
  assert.equal(dashAfterComplete.statusCode, 200);
  assert.match(dashAfterComplete.text, /id="inProgressRequestsValue">0</);
  assert.match(dashAfterComplete.text, /id="completedRequestsValue">1</);
  assert.match(dashAfterComplete.text, /id="openRequestsValue">0</);

  // 8. Module 1: Resident Information Update
  const updateRes = await request(app)
    .post("/residents/1/edit")
    .type("form")
    .send({
      firstName: "Marcus",
      lastName: "Vance",
      address: "742 Evergreen Terrace Suite 200",
      contactNumber: "09189998888",
      email: "marcus.vance.senior@example.org"
    });
  assert.equal(updateRes.statusCode, 302);
  assert.match(updateRes.headers.location, /^\/residents/);

  // 9. Module 1: Resident Deactivation
  const deactivateRes = await request(app).post("/residents/1/deactivate");
  assert.equal(deactivateRes.statusCode, 302);
  assert.match(deactivateRes.headers.location, /^\/residents/);

  // Verify resident is Inactive
  const residentsAfterDeactivation = await request(app).get("/residents");
  assert.match(residentsAfterDeactivation.text, /Inactive/);

  // Verify dashboard resident distribution
  const dashAfterDeactivation = await request(app).get("/dashboard");
  assert.equal(dashAfterDeactivation.statusCode, 200);
  assert.match(dashAfterDeactivation.text, /id="totalResidentsValue">1</);
  assert.match(dashAfterDeactivation.text, /id="activeResidentsValue">0</);
  assert.match(dashAfterDeactivation.text, /id="inactiveResidentsValue">1</);

  // 10. Module 2: Inactive Resident Eligibility Enforcement
  // Attempt to submit new service request for deactivated resident must be rejected
  const rejectedRes = await request(app)
    .post("/service-requests/new")
    .type("form")
    .send({
      residentId: "1",
      serviceType: "Tree Trimming",
      description: "Hazardous overhanging branches near power lines.",
      dateRequested: "2026-11-13"
    });

  assert.equal(rejectedRes.statusCode, 400);
  assert.match(rejectedRes.text, /Resident is not active|active/i);

  // 11. Final Module 3: Operational Dashboard State Integrity & Strict Reconciliation
  const finalDashRes = await request(app).get("/dashboard");
  assert.equal(finalDashRes.statusCode, 200);
  assert.match(finalDashRes.text, /id="totalResidentsValue">1</);
  assert.match(finalDashRes.text, /id="activeResidentsValue">0</);
  assert.match(finalDashRes.text, /id="inactiveResidentsValue">1</);
  assert.match(finalDashRes.text, /id="totalRequestsValue">1</);
  assert.match(finalDashRes.text, /id="openRequestsValue">0</);
  assert.match(finalDashRes.text, /id="pendingRequestsValue">0</);
  assert.match(finalDashRes.text, /id="inProgressRequestsValue">0</);
  assert.match(finalDashRes.text, /id="completedRequestsValue">1</);
  assert.match(finalDashRes.text, /id="cancelledRequestsValue">0</);

  // 12. State Idempotency: Multiple GET requests do not mutate persistence
  await request(app).get("/dashboard");
  await request(app).get("/residents");
  await request(app).get("/service-requests");
  await request(app).get("/service-requests/1");

  const checkFinalDash = await request(app).get("/dashboard");
  assert.match(checkFinalDash.text, /id="totalResidentsValue">1</);
  assert.match(checkFinalDash.text, /id="totalRequestsValue">1</);
  assert.match(checkFinalDash.text, /id="completedRequestsValue">1</);

  db.close();
});
