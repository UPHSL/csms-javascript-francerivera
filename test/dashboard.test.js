import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createDatabaseConnection } from "../src/database/db.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { ServiceRequestRepository } from "../src/repositories/ServiceRequestRepository.js";
import { Resident } from "../src/models/Resident.js";
import { ServiceRequest } from "../src/models/ServiceRequest.js";

function createTestContext() {
  const db = createDatabaseConnection(":memory:");
  const app = createApp({ db });
  const residentRepository = new ResidentRepository(db);
  const serviceRequestRepository = new ServiceRequestRepository(db);

  return { db, app, residentRepository, serviceRequestRepository };
}

function persistResident(residentRepository, overrides = {}) {
  const resident = new Resident({
    firstName: "Maria",
    lastName: "Santos",
    address: "Barangay Santo Tomas",
    contactNumber: "09171234567",
    email: "maria.santos@example.com",
    status: "Active",
    ...overrides
  });
  return residentRepository.save(resident);
}

function persistServiceRequest(serviceRequestRepository, overrides = {}) {
  const req = new ServiceRequest({
    residentId: 1,
    serviceType: "Barangay Clearance",
    description: "Employment clearance request",
    dateRequested: "2026-10-01",
    status: "Pending",
    ...overrides
  });
  return serviceRequestRepository.save(req);
}

test("Test 1 - Dashboard Loads Successfully", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /CSMS Dashboard/i);
  assert.match(response.text, /Resident Summary/i);
  assert.match(response.text, /Service Request Summary/i);
  assert.match(response.text, /Recent Service Requests/i);

  db.close();
});

test("Test 2 - Empty Dashboard Displays Zero Counts", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);

  // Resident metrics must all be 0
  assert.match(response.text, /id="totalResidentsValue">0<\/span>/);
  assert.match(response.text, /id="activeResidentsValue">0<\/span>/);
  assert.match(response.text, /id="inactiveResidentsValue">0<\/span>/);

  // Service Request metrics must all be 0
  assert.match(response.text, /id="totalRequestsValue">0<\/span>/);
  assert.match(response.text, /id="openRequestsValue">0<\/span>/);
  assert.match(response.text, /id="pendingRequestsValue">0<\/span>/);
  assert.match(response.text, /id="inProgressRequestsValue">0<\/span>/);
  assert.match(response.text, /id="completedRequestsValue">0<\/span>/);
  assert.match(response.text, /id="cancelledRequestsValue">0<\/span>/);

  // Empty state for recent requests
  assert.match(response.text, /No Service Requests available\./i);

  db.close();
});

test("Test 3 - Total Resident Count Is Correct", async () => {
  const { app, db, residentRepository } = createTestContext();

  persistResident(residentRepository, { firstName: "Juan", lastName: "Dela Cruz" });
  persistResident(residentRepository, { firstName: "Maria", lastName: "Santos" });
  persistResident(residentRepository, { firstName: "Pedro", lastName: "Reyes" });

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /id="totalResidentsValue">3<\/span>/);

  db.close();
});

test("Test 4 - Resident Status Counts Are Correct", async () => {
  const { app, db, residentRepository } = createTestContext();

  persistResident(residentRepository, { firstName: "Resident 1", status: "Active" });
  persistResident(residentRepository, { firstName: "Resident 2", status: "Active" });
  persistResident(residentRepository, { firstName: "Resident 3", status: "Active" });
  persistResident(residentRepository, { firstName: "Resident 4", status: "Inactive" });

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /id="totalResidentsValue">4<\/span>/);
  assert.match(response.text, /id="activeResidentsValue">3<\/span>/);
  assert.match(response.text, /id="inactiveResidentsValue">1<\/span>/);

  db.close();
});

test("Test 5 - Total Service Request Count Is Correct", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, serviceType: "Type A" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, serviceType: "Type B" });

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /id="totalRequestsValue">2<\/span>/);

  db.close();
});

test("Test 6 - Service Request Status Counts Are Correct", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Pending" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Pending" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "In Progress" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Completed" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Cancelled" });

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /id="pendingRequestsValue">2<\/span>/);
  assert.match(response.text, /id="inProgressRequestsValue">1<\/span>/);
  assert.match(response.text, /id="completedRequestsValue">1<\/span>/);
  assert.match(response.text, /id="cancelledRequestsValue">1<\/span>/);

  db.close();
});

test("Test 7 - Service Request Counts Reconcile", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Pending" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "In Progress" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Completed" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Cancelled" });

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);
  // Total = Pending (1) + In Progress (1) + Completed (1) + Cancelled (1) = 4
  assert.match(response.text, /id="totalRequestsValue">4<\/span>/);

  db.close();
});

test("Test 8 - Open Request Count Is Correct", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  // 2 Pending + 3 In Progress = 5 Open
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Pending" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Pending" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "In Progress" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "In Progress" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "In Progress" });
  // Terminal states (must NOT be counted in Open)
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Completed" });
  persistServiceRequest(serviceRequestRepository, { residentId: resident.id, status: "Cancelled" });

  const response = await request(app).get("/dashboard");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /id="openRequestsValue">5<\/span>/);
  assert.match(response.text, /id="totalRequestsValue">7<\/span>/);

  db.close();
});

test("Test 9 - Resident Deactivation Is Reflected", async () => {
  const { app, db, residentRepository } = createTestContext();
  const { residentDeactivationService } = app.locals.services;

  const resident = persistResident(residentRepository, { status: "Active" });

  // Initial check
  const resBefore = await request(app).get("/dashboard");
  assert.match(resBefore.text, /id="totalResidentsValue">1<\/span>/);
  assert.match(resBefore.text, /id="activeResidentsValue">1<\/span>/);
  assert.match(resBefore.text, /id="inactiveResidentsValue">0<\/span>/);

  // Deactivate via business service
  residentDeactivationService.deactivateResident(resident.id);

  // Refresh dashboard
  const resAfter = await request(app).get("/dashboard");
  assert.match(resAfter.text, /id="totalResidentsValue">1<\/span>/);
  assert.match(resAfter.text, /id="activeResidentsValue">0<\/span>/);
  assert.match(resAfter.text, /id="inactiveResidentsValue">1<\/span>/);

  db.close();
});

test("Test 10 - Service Request Transition Is Reflected", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const { serviceRequestStatusService } = app.locals.services;

  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "Pending"
  });

  // Initial check
  const resBefore = await request(app).get("/dashboard");
  assert.match(resBefore.text, /id="pendingRequestsValue">1<\/span>/);
  assert.match(resBefore.text, /id="inProgressRequestsValue">0<\/span>/);

  // Transition Pending -> In Progress
  serviceRequestStatusService.updateStatus(req.id, "In Progress");

  // Refresh dashboard
  const resAfter = await request(app).get("/dashboard");
  assert.match(resAfter.text, /id="pendingRequestsValue">0<\/span>/);
  assert.match(resAfter.text, /id="inProgressRequestsValue">1<\/span>/);
  assert.match(resAfter.text, /id="totalRequestsValue">1<\/span>/);

  db.close();
});

test("Test 11 - Terminal Transition Updates Open Count", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const { serviceRequestStatusService } = app.locals.services;

  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "In Progress"
  });

  // Before completion: 1 Open
  const resBefore = await request(app).get("/dashboard");
  assert.match(resBefore.text, /id="openRequestsValue">1<\/span>/);
  assert.match(resBefore.text, /id="completedRequestsValue">0<\/span>/);

  // Complete the request
  serviceRequestStatusService.updateStatus(req.id, "Completed");

  // After completion: 0 Open, 1 Completed, Total remains 1
  const resAfter = await request(app).get("/dashboard");
  assert.match(resAfter.text, /id="openRequestsValue">0<\/span>/);
  assert.match(resAfter.text, /id="completedRequestsValue">1<\/span>/);
  assert.match(resAfter.text, /id="totalRequestsValue">1<\/span>/);

  db.close();
});

test("Test 12 - Recent Requests Return No More Than Five", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  // Create 7 requests
  for (let i = 1; i <= 7; i++) {
    persistServiceRequest(serviceRequestRepository, {
      residentId: resident.id,
      serviceType: `Service Type ${i}`,
      dateRequested: `2026-10-0${i}`
    });
  }

  const response = await request(app).get("/dashboard");
  assert.equal(response.statusCode, 200);

  // Count the rendered table rows (data-request-id attributes)
  const matches = response.text.match(/data-request-id="/g);
  assert.ok(matches !== null);
  assert.equal(matches.length, 5, "Recent requests section should display at most 5 items");

  db.close();
});

test("Test 13 - Recent Requests Use Correct Ordering", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Older Request",
    dateRequested: "2026-10-01"
  });
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Newer Request Same Date A",
    dateRequested: "2026-10-10"
  });
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Newer Request Same Date B",
    dateRequested: "2026-10-10"
  });

  const response = await request(app).get("/dashboard");
  assert.equal(response.statusCode, 200);

  // T11 ordering: dateRequested DESC, id DESC
  const idxB = response.text.indexOf("Newer Request Same Date B");
  const idxA = response.text.indexOf("Newer Request Same Date A");
  const idxOlder = response.text.indexOf("Older Request");

  assert.ok(idxB !== -1 && idxA !== -1 && idxOlder !== -1);
  assert.ok(idxB < idxA, "Higher ID on same date must appear first");
  assert.ok(idxA < idxOlder, "Newer date must appear before older date");

  db.close();
});

test("Test 14 - Terminal Requests May Appear in Recent Results", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  const reqCompleted = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Recent Completed Clearance",
    dateRequested: "2026-10-25",
    status: "Completed"
  });

  const response = await request(app).get("/dashboard");
  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Recent Completed Clearance/);
  assert.match(response.text, /Completed/);
  assert.match(response.text, new RegExp(`/service-requests/${reqCompleted.id}`));

  db.close();
});

test("Test 15 - Dashboard GET Does Not Modify Persistence", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository, { status: "Active" });
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "Pending"
  });

  // Multiple GET requests to the dashboard
  await request(app).get("/dashboard");
  await request(app).get("/dashboard");
  await request(app).get("/dashboard");

  // Verify database state is untouched
  const verifiedResident = residentRepository.findById(resident.id);
  assert.equal(verifiedResident.status, "Active");

  const verifiedReq = serviceRequestRepository.findById(req.id);
  assert.equal(verifiedReq.status, "Pending");

  assert.equal(residentRepository.countAll(), 1);
  assert.equal(serviceRequestRepository.countAll(), 1);

  db.close();
});

