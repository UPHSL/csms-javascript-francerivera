import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createDatabaseConnection } from "../src/database/db.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { Resident } from "../src/models/Resident.js";

function createTestContext() {
  const db = createDatabaseConnection(":memory:");
  const app = createApp({ db });
  const repository = new ResidentRepository(db);

  return { db, app, repository };
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

test("Test 1 - Resident Management Page Loads Successfully", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/residents");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Resident Management/i);
  assert.match(response.text, /Register Resident/i);
  assert.match(response.text, /No Residents found\./i);

  db.close();
});

test("Test 2 - Resident List Displays Persisted Residents", async () => {
  const { app, db, repository } = createTestContext();

  const r1 = persistResident(repository, {
    firstName: "Maria",
    lastName: "Santos",
    address: "123 Mabini St",
    contactNumber: "09171112233",
    email: "maria@example.com"
  });

  const r2 = persistResident(repository, {
    firstName: "Juan",
    lastName: "Dela Cruz",
    address: "456 Rizal Ave",
    contactNumber: "09182223344",
    email: "juan@example.com"
  });

  const response = await request(app).get("/residents");

  assert.equal(response.statusCode, 200);
  // Verify details for both residents are displayed
  assert.match(response.text, new RegExp(String(r1.id)));
  assert.match(response.text, /Maria/);
  assert.match(response.text, /Santos/);
  assert.match(response.text, /123 Mabini St/);
  assert.match(response.text, /09171112233/);
  assert.match(response.text, /maria@example\.com/);

  assert.match(response.text, new RegExp(String(r2.id)));
  assert.match(response.text, /Juan/);
  assert.match(response.text, /Dela Cruz/);
  assert.match(response.text, /456 Rizal Ave/);
  assert.match(response.text, /09182223344/);
  assert.match(response.text, /juan@example\.com/);

  // Verify T05 ordering: Dela Cruz before Santos
  const delaCruzIndex = response.text.indexOf("Dela Cruz");
  const santosIndex = response.text.indexOf("Santos");
  assert.ok(delaCruzIndex !== -1 && santosIndex !== -1);
  assert.ok(delaCruzIndex < santosIndex, "Expected Dela Cruz to appear before Santos in T05 order");

  db.close();
});

test("Test 3 - Resident Search Uses Existing Search Behavior", async () => {
  const { app, db, repository } = createTestContext();

  persistResident(repository, { firstName: "Maria", lastName: "Santos" });
  persistResident(repository, { firstName: "Juan", lastName: "Dela Cruz" });
  persistResident(repository, { firstName: "Pedro", lastName: "Santos" });

  // Partial, case-insensitive search for "santos"
  const response = await request(app).get("/residents?search=santos");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Maria/);
  assert.match(response.text, /Pedro/);
  assert.ok(!response.text.includes("Dela Cruz"), "Non-matching resident Juan Dela Cruz should not appear");

  // Partial search for "DELA"
  const responseDela = await request(app).get("/residents?search=DELA");
  assert.equal(responseDela.statusCode, 200);
  assert.match(responseDela.text, /Dela Cruz/);
  assert.ok(!responseDela.text.includes("Pedro"), "Non-matching Pedro Santos should not appear");

  db.close();
});

test("Test 4 - Blank Search Displays All Residents", async () => {
  const { app, db, repository } = createTestContext();

  persistResident(repository, { firstName: "Maria", lastName: "Santos" });
  persistResident(repository, { firstName: "Juan", lastName: "Dela Cruz" });

  const response = await request(app).get("/residents?search=%20%20");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Santos/);
  assert.match(response.text, /Dela Cruz/);

  db.close();
});

test("Test 5 - Registration Form Is Accessible", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/residents/register");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Register Resident/i);
  assert.match(response.text, /First Name/i);
  assert.match(response.text, /Last Name/i);
  assert.match(response.text, /Address/i);
  assert.match(response.text, /Contact Number/i);
  assert.match(response.text, /Email/i);

  // Confirm no inputs for ID or status
  assert.ok(!response.text.includes('name="id"'));
  assert.ok(!response.text.includes('name="status"'));

  db.close();
});

test("Test 6 - Valid Registration Persists Resident", async () => {
  const { app, db, repository } = createTestContext();

  const registrationData = {
    firstName: "Carlos",
    lastName: "Mendoza",
    address: "789 Bonifacio Street",
    contactNumber: "09191234567",
    email: "carlos.mendoza@example.com"
  };

  const response = await request(app)
    .post("/residents/register")
    .type("form")
    .send(registrationData);

  // Verifies Post/Redirect/Get pattern
  assert.equal(response.statusCode, 302);
  assert.match(response.headers.location, /\/residents/);

  // Verifies resident is persisted in database
  const allResidents = repository.findAll();
  assert.equal(allResidents.length, 1);
  const created = allResidents[0];
  assert.equal(created.firstName, "Carlos");
  assert.equal(created.lastName, "Mendoza");
  assert.equal(created.status, "Active");
  assert.ok(created.id > 0);

  // Verifies resident appears in listing
  const listResponse = await request(app).get("/residents");
  assert.match(listResponse.text, /Carlos/);
  assert.match(listResponse.text, /Mendoza/);
  assert.match(listResponse.text, /Active/);

  db.close();
});

test("Test 7 - Invalid Registration Shows Validation Feedback and Does Not Persist", async () => {
  const { app, db, repository } = createTestContext();

  const invalidData = {
    firstName: "",
    lastName: "Mendoza",
    address: "789 Bonifacio Street",
    contactNumber: "12345", // invalid format
    email: "not-an-email" // invalid email
  };

  const response = await request(app)
    .post("/residents/register")
    .type("form")
    .send(invalidData);

  assert.equal(response.statusCode, 400);
  assert.match(response.text, /First name is required/i);
  assert.match(response.text, /Contact number must follow 09XXXXXXXXX/i);
  assert.match(response.text, /Email address is invalid/i);

  // Verifies entered non-sensitive values are preserved in form
  assert.match(response.text, /value="Mendoza"/);
  assert.match(response.text, /value="789 Bonifacio Street"/);

  // Verifies nothing was persisted
  const allResidents = repository.findAll();
  assert.equal(allResidents.length, 0);

  db.close();
});

test("Test 8 - Edit Form Displays Existing Resident Information", async () => {
  const { app, db, repository } = createTestContext();

  const resident = persistResident(repository, {
    firstName: "Elena",
    lastName: "Reyes",
    address: "321 Luna St",
    contactNumber: "09201112233",
    email: "elena.reyes@example.com",
    status: "Active"
  });

  const response = await request(app).get(`/residents/${resident.id}/edit`);

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Edit Resident/i);
  assert.match(response.text, /Elena/);
  assert.match(response.text, /Reyes/);
  assert.match(response.text, /321 Luna St/);
  assert.match(response.text, /09201112233/);
  assert.match(response.text, /elena\.reyes@example\.com/);

  // Verify ID and status are visible for reference
  assert.match(response.text, new RegExp(String(resident.id)));
  assert.match(response.text, /Active/);

  // Verify ID and status are NOT offered as normal editable inputs
  assert.ok(!response.text.includes('name="id"'));
  assert.ok(!response.text.includes('name="status"'));

  db.close();
});

test("Test 9 - Valid Update Persists Changes", async () => {
  const { app, db, repository } = createTestContext();

  const resident = persistResident(repository, {
    firstName: "Elena",
    lastName: "Reyes",
    address: "321 Luna St",
    contactNumber: "09201112233",
    email: "elena.reyes@example.com",
    status: "Active"
  });

  const updatedData = {
    firstName: "Elena Maria",
    lastName: "Reyes-Cruz",
    address: "999 Aurora Blvd",
    contactNumber: "09229998877",
    email: "elena.updated@example.com"
  };

  const response = await request(app)
    .post(`/residents/${resident.id}/edit`)
    .type("form")
    .send(updatedData);

  assert.equal(response.statusCode, 302);
  assert.match(response.headers.location, /\/residents/);

  const updated = repository.findById(resident.id);
  assert.equal(updated.id, resident.id);
  assert.equal(updated.firstName, "Elena Maria");
  assert.equal(updated.lastName, "Reyes-Cruz");
  assert.equal(updated.address, "999 Aurora Blvd");
  assert.equal(updated.contactNumber, "09229998877");
  assert.equal(updated.email, "elena.updated@example.com");
  assert.equal(updated.status, "Active"); // status preserved!

  db.close();
});

test("Test 10 - Invalid Update Does Not Modify Resident", async () => {
  const { app, db, repository } = createTestContext();

  const resident = persistResident(repository, {
    firstName: "Elena",
    lastName: "Reyes",
    address: "321 Luna St",
    contactNumber: "09201112233",
    email: "elena.reyes@example.com",
    status: "Active"
  });

  const invalidData = {
    firstName: "",
    lastName: "Reyes",
    address: "321 Luna St",
    contactNumber: "invalid-num",
    email: "invalid-email"
  };

  const response = await request(app)
    .post(`/residents/${resident.id}/edit`)
    .type("form")
    .send(invalidData);

  assert.equal(response.statusCode, 400);
  assert.match(response.text, /First name is required/i);
  assert.match(response.text, /Contact number must follow 09XXXXXXXXX/i);

  // Verify persisted information in database remains unmodified
  const unchanged = repository.findById(resident.id);
  assert.equal(unchanged.firstName, "Elena");
  assert.equal(unchanged.contactNumber, "09201112233");
  assert.equal(unchanged.email, "elena.reyes@example.com");

  db.close();
});

test("Test 11 - Missing Resident Edit Is Handled Safely", async () => {
  const { app, db } = createTestContext();

  const response = await request(app).get("/residents/999999/edit");

  assert.equal(response.statusCode, 404);
  assert.match(response.text, /Resident Not Found/i);

  db.close();
});

test("Test 12 - Active Resident Can Be Deactivated Through the Interface", async () => {
  const { app, db, repository } = createTestContext();

  const resident = persistResident(repository, { status: "Active" });

  const response = await request(app)
    .post(`/residents/${resident.id}/deactivate`)
    .type("form")
    .send();

  assert.equal(response.statusCode, 302);
  assert.match(response.headers.location, /\/residents/);

  // Verify soft deactivation in database
  const deactivated = repository.findById(resident.id);
  assert.ok(deactivated !== null);
  assert.equal(deactivated.id, resident.id);
  assert.equal(deactivated.status, "Inactive");
  assert.equal(deactivated.firstName, resident.firstName);
  assert.equal(deactivated.lastName, resident.lastName);
  assert.equal(deactivated.contactNumber, resident.contactNumber);

  db.close();
});

test("Test 13 - Inactive Resident Remains Visible", async () => {
  const { app, db, repository } = createTestContext();

  const resident = persistResident(repository, {
    firstName: "Teresa",
    lastName: "Aquino",
    status: "Inactive"
  });

  const response = await request(app).get("/residents");

  assert.equal(response.statusCode, 200);
  assert.match(response.text, /Teresa/);
  assert.match(response.text, /Aquino/);
  assert.match(response.text, /Inactive/);

  // Inactive resident should not offer an active deactivation button
  assert.ok(!response.text.includes(`/residents/${resident.id}/deactivate`));

  // Search includes Inactive resident
  const searchResponse = await request(app).get("/residents?search=teresa");
  assert.equal(searchResponse.statusCode, 200);
  assert.match(searchResponse.text, /Teresa/);
  assert.match(searchResponse.text, /Inactive/);

  db.close();
});

test("Test 14 - GET Requests Do Not Deactivate Residents", async () => {
  const { app, db, repository } = createTestContext();

  const resident = persistResident(repository, { status: "Active" });

  // Normal GET page requests
  await request(app).get("/residents");
  await request(app).get(`/residents?search=${resident.firstName}`);
  await request(app).get(`/residents/${resident.id}/edit`);

  // Verify status is still Active
  const check = repository.findById(resident.id);
  assert.equal(check.status, "Active");

  db.close();
});
