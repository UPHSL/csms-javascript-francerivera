import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createDatabaseConnection } from "../src/database/db.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { ServiceRequestRepository } from "../src/repositories/ServiceRequestRepository.js";
import { Resident } from "../src/models/Resident.js";
import { ServiceRequest } from "../src/models/ServiceRequest.js";

/**
 * Helper to build an isolated in-memory test environment.
 */
function createTestContext() {
  const db = createDatabaseConnection(":memory:");
  const residentRepository = new ResidentRepository(db);
  const serviceRequestRepository = new ServiceRequestRepository(db);
  const app = createApp({ db, residentRepository, serviceRequestRepository });

  return { db, app, residentRepository, serviceRequestRepository };
}

function persistResident(repository, overrides = {}) {
  const resident = new Resident({
    firstName: "Maria",
    lastName: "Santos",
    address: "Barangay Santo Tomas",
    contactNumber: "09171234567",
    email: "maria.santos@example.com",
    status: "Active",
    ...overrides
  });
  return repository.save(resident);
}

function persistServiceRequest(repository, overrides = {}) {
  const serviceRequest = new ServiceRequest({
    residentId: 1,
    serviceType: "Barangay Clearance",
    description: "Proof of residency for employment",
    dateRequested: "2026-11-10",
    status: "Pending",
    ...overrides
  });
  return repository.save(serviceRequest);
}

// ==============================================================================
// Category 1: Invalid or Malformed Input
// ==============================================================================
test("T15 Category 1 - Malformed Route Identifiers Return Controlled 404 Without Crashing or Exposing Stack Traces", async () => {
  const { app, db } = createTestContext();

  // Test 1a: Malformed resident edit route (non-numeric ID)
  const resResidentMalformed = await request(app).get("/residents/not-a-number/edit");
  assert.equal(resResidentMalformed.statusCode, 404);
  assert.match(resResidentMalformed.text, /Resident Not Found/i);
  assert.ok(!resResidentMalformed.text.includes("Error:"), "Stack trace must not be exposed");
  assert.ok(!resResidentMalformed.text.includes("node_modules"), "File paths must not be exposed");

  // Test 1b: Malformed service request details route (string ID)
  const resRequestMalformed = await request(app).get("/service-requests/abc-invalid-id");
  assert.equal(resRequestMalformed.statusCode, 404);
  assert.match(resRequestMalformed.text, /Service Request Not Found/i);
  assert.ok(!resRequestMalformed.text.includes("Error:"), "Stack trace must not be exposed");
  assert.ok(!resRequestMalformed.text.includes("SELECT"), "Raw SQL queries must not be exposed");

  // Test 1c: Negative numeric identifier
  const resNegativeId = await request(app).get("/service-requests/-99");
  assert.equal(resNegativeId.statusCode, 404);
  assert.match(resNegativeId.text, /Service Request Not Found/i);

  db.close();
});

// ==============================================================================
// Category 2: Rejected Mutation Protects Persistence
// ==============================================================================
test("T15 Category 2 - Rejected Resident Partial Update Protects Database State Atomically", async () => {
  const { app, db, residentRepository } = createTestContext();

  // Seed baseline valid resident
  const initial = persistResident(residentRepository, {
    firstName: "Maria",
    lastName: "Santos",
    address: "123 Mabini St",
    contactNumber: "09171112233",
    email: "maria.santos@example.com"
  });

  // Attempt update with valid first name but invalid contact number (12345 - fails 09XXXXXXXXX regex)
  const response = await request(app)
    .post(`/residents/${initial.id}/edit`)
    .type("form")
    .send({
      firstName: "HackedFirstName",
      lastName: "Santos",
      address: "123 Mabini St",
      contactNumber: "12345",
      email: "maria.santos@example.com"
    });

  // Must reject with HTTP 400
  assert.equal(response.statusCode, 400);
  assert.match(response.text, /Contact number must follow 09XXXXXXXXX/i);

  // Directly verify persistence: partial update MUST NOT have occurred
  const reloaded = residentRepository.findById(initial.id);
  assert.ok(reloaded !== null);
  assert.equal(reloaded.firstName, "Maria", "Original first name must remain unchanged");
  assert.equal(reloaded.contactNumber, "09171112233", "Original contact number must remain unchanged");
  assert.equal(reloaded.lastName, "Santos");
  assert.equal(reloaded.status, "Active");

  db.close();
});

// ==============================================================================
// Category 3: Read-Only Request Safety
// ==============================================================================
test("T15 Category 3 - Repeated Read-Only Queries and Filter Requests Cause Zero Mutations in Persistence", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();

  // Seed baseline data
  const resident = persistResident(residentRepository, { firstName: "Juan", lastName: "Luna" });
  const serviceReq = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Health Clearance",
    status: "Pending"
  });

  const initialResidentCount = residentRepository.countAll();
  const initialServiceReqCount = serviceRequestRepository.countAll();

  // Execute multiple read-only GET requests across diverse endpoints
  const getDashboard1 = await request(app).get("/dashboard");
  assert.equal(getDashboard1.statusCode, 200);

  const getResidentsSearch = await request(app).get("/residents?search=Juan");
  assert.equal(getResidentsSearch.statusCode, 200);

  const getServiceReqFilter = await request(app).get("/service-requests?status=Pending");
  assert.equal(getServiceReqFilter.statusCode, 200);

  const getServiceReqView = await request(app).get(`/service-requests/${serviceReq.id}`);
  assert.equal(getServiceReqView.statusCode, 200);

  const getDashboard2 = await request(app).get("/dashboard");
  assert.equal(getDashboard2.statusCode, 200);

  // Verify persistence is completely untouched
  assert.equal(residentRepository.countAll(), initialResidentCount);
  assert.equal(serviceRequestRepository.countAll(), initialServiceReqCount);

  const reloadedReq = serviceRequestRepository.findById(serviceReq.id);
  assert.equal(reloadedReq.status, "Pending");
  assert.equal(reloadedReq.serviceType, "Health Clearance");

  db.close();
});

// ==============================================================================
// Category 4: Cross-Feature Regression
// ==============================================================================
test("T15 Category 4 - Deactivated Resident Rejects Subsequent Service Request Submission and Preserves Dashboard Counts", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();

  // Step 1: Create active resident
  const resident = persistResident(residentRepository, {
    firstName: "Carlos",
    lastName: "Mendoza",
    status: "Active"
  });

  // Verify initial dashboard state
  const dashInitial = await request(app).get("/dashboard");
  assert.match(dashInitial.text, /id="activeResidentsValue">1<\/span>/);
  assert.match(dashInitial.text, /id="inactiveResidentsValue">0<\/span>/);

  // Step 2: Deactivate resident via T07/T12 interface
  const deactRes = await request(app).post(`/residents/${resident.id}/deactivate`);
  assert.equal(deactRes.statusCode, 302);

  // Step 3: Verify dashboard immediately updates active/inactive counts
  const dashAfterDeact = await request(app).get("/dashboard");
  assert.match(dashAfterDeact.text, /id="activeResidentsValue">0<\/span>/);
  assert.match(dashAfterDeact.text, /id="inactiveResidentsValue">1<\/span>/);

  // Step 4: Attempt to submit new Service Request for the now-Inactive resident (T09/T13)
  const submitRes = await request(app)
    .post("/service-requests/new")
    .type("form")
    .send({
      residentId: resident.id,
      serviceType: "Business Permit",
      description: "Permit for community grocery store",
      dateRequested: "2026-11-10"
    });

  // Must reject submission with HTTP 400 and clear eligibility feedback
  assert.equal(submitRes.statusCode, 400);
  assert.match(submitRes.text, /Inactive Residents cannot submit new Service Requests/i);

  // Step 5: Verify persistence integrity - zero service requests should exist
  assert.equal(serviceRequestRepository.countAll(), 0);

  // Step 6: Verify dashboard service request metrics remain zero
  const dashFinal = await request(app).get("/dashboard");
  assert.match(dashFinal.text, /id="totalRequestsValue">0<\/span>/);
  assert.match(dashFinal.text, /id="openRequestsValue">0<\/span>/);

  db.close();
});

// ==============================================================================
// Category 5: Repeatability or Boundary Behavior
// ==============================================================================
test("T15 Category 5 - Recent Service Requests Ordering Handles Deterministic Tie-Breaking with High Volume Boundary", async () => {
  const { db, residentRepository, serviceRequestRepository } = createTestContext();

  const resident = persistResident(residentRepository);

  // Seed 7 requests on the EXACT same date ("2026-11-10") with sequential IDs 1 through 7
  for (let i = 1; i <= 7; i++) {
    persistServiceRequest(serviceRequestRepository, {
      residentId: resident.id,
      serviceType: `Permit ${i}`,
      dateRequested: "2026-11-10"
    });
  }

  // Verify total is 7
  assert.equal(serviceRequestRepository.countAll(), 7);

  // Query recent records with default limit = 5
  const recentFirstQuery = serviceRequestRepository.findRecent(5);

  // Boundary 1: Maximum limit of 5 is strictly enforced
  assert.equal(recentFirstQuery.length, 5, "findRecent must cap at 5 even when 7 records exist");

  // Boundary 2: Deterministic descending ID tie-breaker (same date -> higher ID first)
  const idsFirst = recentFirstQuery.map((r) => r.id);
  assert.deepEqual(idsFirst, [7, 6, 5, 4, 3], "Must return latest 5 records in descending ID order");

  // Boundary 3: Oldest records (IDs 1 and 2) are properly excluded
  assert.ok(!idsFirst.includes(2), "ID 2 must be excluded beyond the limit boundary of 5");
  assert.ok(!idsFirst.includes(1), "ID 1 must be excluded beyond the limit boundary of 5");

  // Boundary 4: Repeatability / Idempotency - a subsequent execution produces identical deterministic output
  const recentSecondQuery = serviceRequestRepository.findRecent(5);
  const idsSecond = recentSecondQuery.map((r) => r.id);
  assert.deepEqual(idsSecond, idsFirst, "Query must be 100% deterministic and repeatable");

  db.close();
});
