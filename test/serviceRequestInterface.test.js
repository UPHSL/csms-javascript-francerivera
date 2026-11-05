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

test("Test 1 - Service Request Management Page Loads", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/service-requests");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Service Request Management/i);
  assert.match(response.text, /Submit Service Request/i);
  assert.match(response.text, /No Service Requests found\./i);

  db.close();
});

test("Test 2 - Persisted Service Requests Are Displayed", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  const req1 = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Health Certificate",
    description: "Annual medical clearance for school",
    dateRequested: "2026-10-10",
    status: "Pending"
  });

  const req2 = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Business Permit",
    description: "Sari-sari store permit renewal",
    dateRequested: "2026-10-15",
    status: "In Progress"
  });

  const response = await request(app).get("/service-requests");

  assert.equal(response.statusCode, 200);
  // Both requests must be rendered
  assert.match(response.text, new RegExp(String(req1.id)));
  assert.match(response.text, /Health Certificate/);
  assert.match(response.text, /2026-10-10/);
  assert.match(response.text, /Pending/);

  assert.match(response.text, new RegExp(String(req2.id)));
  assert.match(response.text, /Business Permit/);
  assert.match(response.text, /2026-10-15/);
  assert.match(response.text, /In Progress/);
  assert.match(response.text, new RegExp(String(resident.id)));

  db.close();
});

test("Test 3 - Required Ordering Is Preserved", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  // Insert in non-sorted order
  const rOlder = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Older Request",
    dateRequested: "2026-09-01"
  });
  const rNewer1 = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Newer Request A",
    dateRequested: "2026-10-05"
  });
  const rNewer2 = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Newer Request B",
    dateRequested: "2026-10-05"
  });

  const response = await request(app).get("/service-requests");
  assert.equal(response.statusCode, 200);

  // T11 ordering: dateRequested DESC, id DESC
  // Expected order: rNewer2 (id higher), rNewer1, rOlder
  const idxNewer2 = response.text.indexOf("Newer Request B");
  const idxNewer1 = response.text.indexOf("Newer Request A");
  const idxOlder = response.text.indexOf("Older Request");

  assert.ok(idxNewer2 !== -1 && idxNewer1 !== -1 && idxOlder !== -1);
  assert.ok(idxNewer2 < idxNewer1, "Higher ID on same date should appear first");
  assert.ok(idxNewer1 < idxOlder, "Newer date should appear before older date");

  db.close();
});

test("Test 4 - Text Search Uses T11 Behavior", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Barangay Clearance",
    description: "Needed for local job employment",
    dateRequested: "2026-10-01"
  });

  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Certificate of Indigency",
    description: "Financial hospital aid assistance",
    dateRequested: "2026-10-02"
  });

  // Partial, case-insensitive search by serviceType
  const res1 = await request(app).get("/service-requests?search=cLeArAnCe");
  assert.equal(res1.statusCode, 200);
  assert.match(res1.text, /Barangay Clearance/);
  assert.ok(!res1.text.includes("Certificate of Indigency"));

  // Partial, case-insensitive search by description
  const res2 = await request(app).get("/service-requests?search=hOsPiTaL");
  assert.equal(res2.statusCode, 200);
  assert.match(res2.text, /Certificate of Indigency/);
  assert.ok(!res2.text.includes("Barangay Clearance"));

  // Blank search returns all
  const resBlank = await request(app).get("/service-requests?search=%20%20%20");
  assert.equal(resBlank.statusCode, 200);
  assert.match(resBlank.text, /Barangay Clearance/);
  assert.match(resBlank.text, /Certificate of Indigency/);

  db.close();
});

test("Test 5 - Status Filter Uses T11 Behavior", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Request Pending",
    status: "Pending"
  });
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Request In Progress",
    status: "In Progress"
  });
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Request Completed",
    status: "Completed"
  });
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Request Cancelled",
    status: "Cancelled"
  });

  // Filter Pending
  const resPending = await request(app).get("/service-requests?status=Pending");
  assert.equal(resPending.statusCode, 200);
  assert.match(resPending.text, /Request Pending/);
  assert.ok(!resPending.text.includes("Request In Progress"));
  assert.ok(!resPending.text.includes("Request Completed"));
  assert.ok(!resPending.text.includes("Request Cancelled"));

  // Filter Completed
  const resCompleted = await request(app).get("/service-requests?status=Completed");
  assert.equal(resCompleted.statusCode, 200);
  assert.match(resCompleted.text, /Request Completed/);
  assert.ok(!resCompleted.text.includes("Request Pending"));

  db.close();
});

test("Test 6 - Combined Search and Status Filter Works", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  // 1. Text only match
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Clearance Request A",
    description: "Legal document for employment",
    status: "In Progress"
  });
  // 2. Status only match
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Health Permit",
    description: "Medical consultation assistance",
    status: "Pending"
  });
  // 3. Both match
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Clearance Request B",
    description: "Barangay clearance document",
    status: "Pending"
  });
  // 4. Neither match
  persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Sanitation Inspection",
    description: "Store sanitation review",
    status: "Completed"
  });

  const response = await request(app).get("/service-requests?search=Clearance&status=Pending");
  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Clearance Request B/);
  assert.ok(!response.text.includes("Clearance Request A"));
  assert.ok(!response.text.includes("Health Permit"));
  assert.ok(!response.text.includes("Sanitation Inspection"));

  db.close();
});

test("Test 7 - Submission Form Is Accessible", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/service-requests/new");
  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Submit Service Request/i);
  assert.match(response.text, /Resident ID/i);
  assert.match(response.text, /Service Type/i);
  assert.match(response.text, /Description/i);
  assert.match(response.text, /Date Requested/i);

  // Ensure user cannot manually input Service Request ID or initial status
  assert.ok(!response.text.includes('name="id"'));
  assert.ok(!response.text.includes('name="status"'));

  db.close();
});

test("Test 8 - Valid Submission Persists a Pending Request", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository, { status: "Active" });

  const payload = {
    residentId: String(resident.id),
    serviceType: "Certificate of Residency",
    description: "Proof of residence for bank account opening",
    dateRequested: "2026-10-20"
  };

  const response = await request(app)
    .post("/service-requests/new")
    .type("form")
    .send(payload);

  // Post/Redirect/Get pattern
  assert.equal(response.statusCode, 302);
  assert.match(response.headers.location, /\/service-requests/);

  // Check persistence
  const all = serviceRequestRepository.findAll();
  assert.equal(all.length, 1);
  const created = all[0];
  assert.ok(created.id > 0);
  assert.equal(created.residentId, resident.id);
  assert.equal(created.serviceType, "Certificate of Residency");
  assert.equal(created.description, "Proof of residence for bank account opening");
  assert.equal(created.dateRequested, "2026-10-20");
  assert.equal(created.status, "Pending");

  db.close();
});

test("Test 9 - Invalid Submission Shows Validation Feedback", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  const invalidPayload = {
    residentId: String(resident.id),
    serviceType: "   ", // blank service type
    description: "",    // blank description
    dateRequested: "invalid-date"
  };

  const response = await request(app)
    .post("/service-requests/new")
    .type("form")
    .send(invalidPayload);

  assert.equal(response.statusCode, 400);
  assert.match(response.text, /Service type is required/i);
  assert.match(response.text, /Description is required/i);

  // Ensure nothing persisted
  const all = serviceRequestRepository.findAll();
  assert.equal(all.length, 0);

  db.close();
});

test("Test 10 - Missing Resident Submission Is Rejected", async () => {
  const { app, db, serviceRequestRepository } = createTestContext();

  const payload = {
    residentId: "99999", // nonexistent resident
    serviceType: "Barangay Clearance",
    description: "Request for employment",
    dateRequested: "2026-10-20"
  };

  const response = await request(app)
    .post("/service-requests/new")
    .type("form")
    .send(payload);

  assert.equal(response.statusCode, 400);
  assert.match(response.text, /Resident not found/i);

  // Ensure nothing persisted
  const all = serviceRequestRepository.findAll();
  assert.equal(all.length, 0);

  db.close();
});

test("Test 11 - Inactive Resident Submission Is Rejected", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const inactiveResident = persistResident(residentRepository, { status: "Inactive" });

  const payload = {
    residentId: String(inactiveResident.id),
    serviceType: "Barangay Clearance",
    description: "Request for employment",
    dateRequested: "2026-10-20"
  };

  const response = await request(app)
    .post("/service-requests/new")
    .type("form")
    .send(payload);

  assert.equal(response.statusCode, 400);
  assert.match(response.text, /Inactive Residents cannot submit new Service Requests/i);

  // Ensure nothing persisted
  const all = serviceRequestRepository.findAll();
  assert.equal(all.length, 0);

  db.close();
});

test("Test 12 - Existing Service Request Details Can Be Viewed", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Community Tax Certificate",
    description: "Cedula for government transaction",
    dateRequested: "2026-10-18",
    status: "Pending"
  });

  const response = await request(app).get(`/service-requests/${req.id}`);
  assert.equal(response.statusCode, 200);

  assert.match(response.text, new RegExp(String(req.id)));
  assert.match(response.text, new RegExp(String(resident.id)));
  assert.match(response.text, /Community Tax Certificate/);
  assert.match(response.text, /Cedula for government transaction/);
  assert.match(response.text, /2026-10-18/);
  assert.match(response.text, /Pending/);

  db.close();
});

test("Test 13 - Missing Service Request View Is Handled Safely", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/service-requests/99999");
  assert.equal(response.statusCode, 404);
  assert.match(response.text, /Service Request Not Found/i);

  db.close();
});

test("Test 14 - Pending Request Can Start Processing", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "Pending"
  });

  const response = await request(app)
    .post(`/service-requests/${req.id}/start-processing`)
    .type("form")
    .send();

  assert.equal(response.statusCode, 302);
  assert.match(response.headers.location, new RegExp(`/service-requests/${req.id}`));

  // Verify database update
  const updated = serviceRequestRepository.findById(req.id);
  assert.equal(updated.status, "In Progress");
  assert.equal(updated.residentId, resident.id);
  assert.equal(updated.serviceType, req.serviceType);

  db.close();
});

test("Test 15 - Pending Request Can Be Cancelled", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "Pending"
  });

  const response = await request(app)
    .post(`/service-requests/${req.id}/cancel`)
    .type("form")
    .send();

  assert.equal(response.statusCode, 302);

  const updated = serviceRequestRepository.findById(req.id);
  assert.equal(updated.status, "Cancelled");

  db.close();
});

test("Test 16 - In-Progress Request Can Be Completed", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "In Progress"
  });

  const response = await request(app)
    .post(`/service-requests/${req.id}/complete`)
    .type("form")
    .send();

  assert.equal(response.statusCode, 302);

  const updated = serviceRequestRepository.findById(req.id);
  assert.equal(updated.status, "Completed");

  db.close();
});

test("Test 17 - In-Progress Request Can Be Cancelled", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "In Progress"
  });

  const response = await request(app)
    .post(`/service-requests/${req.id}/cancel`)
    .type("form")
    .send();

  assert.equal(response.statusCode, 302);

  const updated = serviceRequestRepository.findById(req.id);
  assert.equal(updated.status, "Cancelled");

  db.close();
});

test("Test 18 - Invalid Direct Transition Is Still Rejected", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "Pending"
  });

  // Attempt direct Pending -> Completed via HTTP status endpoint
  const response = await request(app)
    .post(`/service-requests/${req.id}/status`)
    .type("form")
    .send({ status: "Completed" });

  assert.equal(response.statusCode, 400);
  assert.match(response.text, /Cannot transition Service Request to (?:'|&#39;)Completed(?:'|&#39;)/i);

  // Persistence status must still be Pending
  const unchanged = serviceRequestRepository.findById(req.id);
  assert.equal(unchanged.status, "Pending");

  db.close();
});

test("Test 19 - Completed and Cancelled Requests Remain Visible", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);

  const reqCompleted = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Completed Document",
    status: "Completed"
  });
  const reqCancelled = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    serviceType: "Cancelled Document",
    status: "Cancelled"
  });

  // Verify visible in listing
  const listRes = await request(app).get("/service-requests");
  assert.equal(listRes.statusCode, 200);
  assert.match(listRes.text, /Completed Document/);
  assert.match(listRes.text, /Cancelled Document/);
  assert.match(listRes.text, /Completed/);
  assert.match(listRes.text, /Cancelled/);

  // Verify searchable
  const searchRes = await request(app).get("/service-requests?search=Cancelled");
  assert.equal(searchRes.statusCode, 200);
  assert.match(searchRes.text, /Cancelled Document/);

  // Verify viewable with terminal indication
  const viewCompletedRes = await request(app).get(`/service-requests/${reqCompleted.id}`);
  assert.equal(viewCompletedRes.statusCode, 200);
  assert.match(viewCompletedRes.text, /terminal/i);
  // Ensure no start-processing or cancel button is rendered
  assert.ok(!viewCompletedRes.text.includes("/start-processing"));
  assert.ok(!viewCompletedRes.text.includes("/complete"));

  db.close();
});

test("Test 20 - GET Requests Do Not Change Service Request State", async () => {
  const { app, db, residentRepository, serviceRequestRepository } = createTestContext();
  const resident = persistResident(residentRepository);
  const req = persistServiceRequest(serviceRequestRepository, {
    residentId: resident.id,
    status: "Pending"
  });

  // Perform multiple GET requests
  await request(app).get("/service-requests");
  await request(app).get(`/service-requests?search=${req.serviceType}`);
  await request(app).get("/service-requests?status=Pending");
  await request(app).get("/service-requests/new");
  await request(app).get(`/service-requests/${req.id}`);

  // Confirm state in DB is still untouched
  const checked = serviceRequestRepository.findById(req.id);
  assert.equal(checked.status, "Pending");

  // Total count remains 1
  const all = serviceRequestRepository.findAll();
  assert.equal(all.length, 1);

  db.close();
});
