import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { Resident } from "../src/models/Resident.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { ResidentDeactivationService } from "../src/services/ResidentDeactivationService.js";
import { ResidentSearchService } from "../src/services/ResidentSearchService.js";
import { createDatabaseConnection } from "../src/database/db.js";

function createTemporaryDatabasePath() {
  const fileName = `csms-t07-${crypto.randomUUID()}.sqlite`;
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

function createDeactivationSetup() {
  const databasePath = createTemporaryDatabasePath();
  const db = createDatabaseConnection(databasePath);
  const repository = new ResidentRepository(db);
  const deactivationService = new ResidentDeactivationService(repository);
  const searchService = new ResidentSearchService(repository);
  return { databasePath, repository, deactivationService, searchService };
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

test("Test 1 - Active Resident Can Be Deactivated - verifies deactivation operation reports success", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const original = repository.save(makeValidResident({ status: "Active" }));
    const result = deactivationService.deactivateResident(original.id);

    assert.equal(result.success, true);
    assert.equal(result.notFound, false);
    assert.equal(result.alreadyInactive, false);
    assert.ok(result.resident);
    assert.equal(result.resident.status, "Inactive");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 2 - Resident Status Becomes Inactive in Persistence - verifies status in SQLite is updated", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const original = repository.save(makeValidResident({ status: "Active" }));
    deactivationService.deactivateResident(original.id);

    const stored = repository.findById(original.id);
    assert.ok(stored);
    assert.equal(stored.status, "Inactive");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 3 - Resident ID Is Preserved - verifies ID remains unchanged after deactivation", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const original = repository.save(makeValidResident());
    const originalId = original.id;

    const result = deactivationService.deactivateResident(originalId);
    assert.equal(result.success, true);
    assert.equal(result.resident.id, originalId);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 4 - Resident Information Is Preserved - verifies all personal/contact fields match original values", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const original = repository.save(makeValidResident({
      firstName: "Maria",
      lastName: "Santos",
      address: "123 Mabini St.",
      contactNumber: "09181234567",
      email: "maria@example.com"
    }));

    deactivationService.deactivateResident(original.id);

    const stored = repository.findById(original.id);
    assert.equal(stored.firstName, "Maria");
    assert.equal(stored.lastName, "Santos");
    assert.equal(stored.address, "123 Mabini St.");
    assert.equal(stored.contactNumber, "09181234567");
    assert.equal(stored.email, "maria@example.com");
    assert.equal(stored.status, "Inactive");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 5 - Deactivated Resident Remains Persisted and Retrievable - verifies record is not physically deleted", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const original = repository.save(makeValidResident());
    deactivationService.deactivateResident(original.id);

    const count = countResidents(databasePath);
    assert.equal(count, 1);

    const retrieved = repository.findById(original.id);
    assert.ok(retrieved);
    assert.equal(retrieved.status, "Inactive");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 6 - Deactivated Resident Remains Available Through T05 - verifies search/list still finds Inactive resident", () => {
  const { databasePath, repository, deactivationService, searchService } = createDeactivationSetup();
  try {
    const original = repository.save(makeValidResident({ firstName: "Juan", lastName: "SearchableName" }));
    deactivationService.deactivateResident(original.id);

    const searchResults = searchService.searchResidents("SearchableName");
    assert.equal(searchResults.length, 1);
    assert.equal(searchResults[0].id, original.id);
    assert.equal(searchResults[0].status, "Inactive");

    const allResidents = searchService.listResidents();
    assert.equal(allResidents.length, 1);
    assert.equal(allResidents[0].status, "Inactive");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 7 - Already-Inactive Resident Is Handled Safely - verifies repeated deactivation is idempotent and safe", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const original = repository.save(makeValidResident({ status: "Inactive" }));

    const result = deactivationService.deactivateResident(original.id);
    assert.equal(result.success, true);
    assert.equal(result.notFound, false);
    assert.equal(result.alreadyInactive, true);
    assert.equal(result.resident.status, "Inactive");
    assert.equal(result.resident.id, original.id);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 8 - Nonexistent Resident Is Handled Safely - verifies nonexistent ID returns notFound: true", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const result = deactivationService.deactivateResident(999999);
    assert.equal(result.success, false);
    assert.equal(result.notFound, true);
    assert.equal(result.alreadyInactive, false);
    assert.equal(result.resident, null);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 9 - Nonexistent Deactivation Does Not Create or Delete Records - verifies count remains unchanged", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    repository.save(makeValidResident());
    const countBefore = countResidents(databasePath);

    deactivationService.deactivateResident(999999);

    const countAfter = countResidents(databasePath);
    assert.equal(countAfter, countBefore);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 10 - Deactivating One Resident Does Not Affect Another - verifies targeted update strictly affects requested ID", () => {
  const { databasePath, repository, deactivationService } = createDeactivationSetup();
  try {
    const r1 = repository.save(makeValidResident({ firstName: "First", status: "Active" }));
    const r2 = repository.save(makeValidResident({ firstName: "Second", status: "Active" }));

    deactivationService.deactivateResident(r2.id);

    const stored1 = repository.findById(r1.id);
    const stored2 = repository.findById(r2.id);

    assert.equal(stored1.status, "Active");
    assert.equal(stored2.status, "Inactive");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});
