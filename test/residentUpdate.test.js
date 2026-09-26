import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { Resident } from "../src/models/Resident.js";
import { ResidentValidator } from "../src/services/ResidentValidator.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { ResidentUpdateService } from "../src/services/ResidentUpdateService.js";
import { ResidentSearchService } from "../src/services/ResidentSearchService.js";
import { createDatabaseConnection } from "../src/database/db.js";

function createTemporaryDatabasePath() {
  const fileName = `csms-t06-${crypto.randomUUID()}.sqlite`;
  return path.join(os.tmpdir(), fileName);
}

function removeDatabase(databasePath) {
  try {
    if (fs.existsSync(databasePath)) {
      fs.unlinkSync(databasePath);
    }
  } catch (err) {
    // Ignore cleanup error if file locked
  }
}

function createUpdateSetup() {
  const databasePath = createTemporaryDatabasePath();
  const db = createDatabaseConnection(databasePath);
  const repository = new ResidentRepository(db);
  const validator = new ResidentValidator();
  const updateService = new ResidentUpdateService(validator, repository);
  const searchService = new ResidentSearchService(repository);
  return { databasePath, repository, validator, updateService, searchService };
}

function countResidents(databasePath) {
  const database = new DatabaseSync(databasePath);
  try {
    const statement = database.prepare("SELECT COUNT(*) AS count FROM residents");
    const row = statement.get();
    return Number(row.count);
  } finally {
    database.close();
  }
}

function makeValidResident(overrides = {}) {
  return new Resident({
    firstName: "Juan",
    lastName: "Dela Cruz",
    address: "Barangay Santo Tomas",
    contactNumber: "09171234567",
    email: "juan@example.com",
    status: "Active",
    ...overrides
  });
}

test("Test 1 - Valid Resident Update Succeeds - verifies valid update returns success", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const original = repository.save(makeValidResident());
    const result = updateService.updateResident(original.id, {
      firstName: "Juan Miguel",
      lastName: "Santos",
      address: "New Address",
      contactNumber: "09181234567",
      email: "juan.miguel@example.com"
    });

    assert.equal(result.success, true);
    assert.equal(result.notFound, false);
    assert.ok(result.resident);
    assert.equal(result.resident.firstName, "Juan Miguel");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 2 - Resident ID Is Preserved - verifies updated resident retains original ID", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const original = repository.save(makeValidResident());
    const originalId = original.id;

    const result = updateService.updateResident(originalId, {
      firstName: "UpdatedName"
    });

    assert.equal(result.success, true);
    assert.equal(result.resident.id, originalId);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 3 - Permitted Resident Information Is Persisted - verifies all 5 editable fields persist in SQLite", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const original = repository.save(makeValidResident());

    updateService.updateResident(original.id, {
      firstName: "Pedro",
      lastName: "Reyes",
      address: "456 Rizal St.",
      contactNumber: "09991234567",
      email: "pedro.reyes@example.com"
    });

    const stored = repository.findById(original.id);
    assert.equal(stored.firstName, "Pedro");
    assert.equal(stored.lastName, "Reyes");
    assert.equal(stored.address, "456 Rizal St.");
    assert.equal(stored.contactNumber, "09991234567");
    assert.equal(stored.email, "pedro.reyes@example.com");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 4 - Resident Status Is Preserved - verifies Active and Inactive statuses are preserved during update", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const activeRes = repository.save(makeValidResident({ status: "Active" }));
    const inactiveRes = repository.save(makeValidResident({ status: "Inactive" }));

    const res1 = updateService.updateResident(activeRes.id, { firstName: "NewActive" });
    const res2 = updateService.updateResident(inactiveRes.id, { firstName: "NewInactive" });

    assert.equal(res1.resident.status, "Active");
    assert.equal(res2.resident.status, "Inactive");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 5 - Invalid Update Fails - verifies invalid field fails validation check", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const original = repository.save(makeValidResident());
    const result = updateService.updateResident(original.id, {
      firstName: ""
    });

    assert.equal(result.success, false);
    assert.equal(result.notFound, false);
    assert.equal(result.resident, null);
    assert.ok(result.errors.includes("firstName"));
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 6 - Invalid Update Does Not Modify Persisted Information - verifies SQLite data remains unchanged on failure", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const original = repository.save(makeValidResident());

    updateService.updateResident(original.id, {
      firstName: "",
      contactNumber: "INVALID_NUMBER"
    });

    const stored = repository.findById(original.id);
    assert.equal(stored.firstName, "Juan");
    assert.equal(stored.contactNumber, "09171234567");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 7 - Updating a Nonexistent Resident Is Handled Safely - verifies nonexistent ID returns notFound: true", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const result = updateService.updateResident(999999, {
      firstName: "Ghost"
    });

    assert.equal(result.success, false);
    assert.equal(result.notFound, true);
    assert.equal(result.resident, null);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 8 - Nonexistent Update Does Not Create a Resident - verifies count remains unchanged", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    repository.save(makeValidResident());
    const countBefore = countResidents(databasePath);

    updateService.updateResident(999999, {
      firstName: "Ghost"
    });

    const countAfter = countResidents(databasePath);
    assert.equal(countAfter, countBefore);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 9 - Updated Resident Is Visible Through T05 Querying - verifies search algorithm retrieves updated name", () => {
  const { databasePath, repository, updateService, searchService } = createUpdateSetup();
  try {
    const original = repository.save(makeValidResident({ firstName: "Juan", lastName: "Cruz" }));

    updateService.updateResident(original.id, {
      firstName: "Miguel",
      lastName: "Santos"
    });

    const searchResults = searchService.searchResidents("Miguel");
    assert.equal(searchResults.length, 1);
    assert.equal(searchResults[0].id, original.id);
    assert.equal(searchResults[0].lastName, "Santos");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 10 - Updated Information and Contact Number Are Preserved - verifies leading zero in contact number after update", () => {
  const { databasePath, repository, updateService } = createUpdateSetup();
  try {
    const original = repository.save(makeValidResident());

    const result = updateService.updateResident(original.id, {
      contactNumber: "09181234567"
    });

    assert.equal(result.success, true);
    assert.equal(result.resident.contactNumber, "09181234567");

    const stored = repository.findById(original.id);
    assert.equal(stored.contactNumber, "09181234567");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});
