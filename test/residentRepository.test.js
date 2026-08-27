import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { Resident } from "../src/models/Resident.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { createDatabaseConnection } from "../src/database/db.js";

function getTempDbPath() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "csms-test-"));
  return path.join(tempDir, "test.db");
}

function cleanupTempDb(dbPath) {
  try {
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    // Ignore cleanup error if file locked
  }
}

test("Test 1: Persist a Resident - verifies that a valid Resident can be stored successfully", () => {
  const dbPath = getTempDbPath();
  const db = createDatabaseConnection(dbPath);
  const repo = new ResidentRepository(db);

  const resident = new Resident({
    firstName: "Juan",
    lastName: "Dela Cruz",
    address: "Barangay Santo Tomas",
    contactNumber: "09171234567",
    email: "juan@example.com",
    status: "Active"
  });

  const savedResident = repo.save(resident);
  assert.ok(savedResident);

  repo.close();
  cleanupTempDb(dbPath);
});

test("Test 2: Resident Receives an Identifier - verifies a newly persisted Resident receives a database ID", () => {
  const dbPath = getTempDbPath();
  const db = createDatabaseConnection(dbPath);
  const repo = new ResidentRepository(db);

  const resident = new Resident({
    firstName: "Maria",
    lastName: "Santos",
    address: "Barangay Santo Tomas",
    contactNumber: "09181234567",
    email: "maria@example.com",
    status: "Active"
  });

  assert.equal(resident.id, null);

  const savedResident = repo.save(resident);
  assert.notEqual(savedResident.id, null);
  assert.ok(Number.isInteger(savedResident.id));

  repo.close();
  cleanupTempDb(dbPath);
});

test("Test 3: Retrieve Resident by Identifier - verifies a stored Resident can be retrieved by assigned ID", () => {
  const dbPath = getTempDbPath();
  const db = createDatabaseConnection(dbPath);
  const repo = new ResidentRepository(db);

  const resident = new Resident({
    firstName: "Pedro",
    lastName: "Reyes",
    address: "Barangay Santo Tomas",
    contactNumber: "09191234567",
    email: "pedro@example.com",
    status: "Active"
  });

  const savedResident = repo.save(resident);
  const retrievedResident = repo.findById(savedResident.id);

  assert.ok(retrievedResident);
  assert.equal(retrievedResident.id, savedResident.id);
  assert.equal(retrievedResident.firstName, "Pedro");

  repo.close();
  cleanupTempDb(dbPath);
});

test("Test 4: Preserve Resident Information - verifies all properties match after persistence and retrieval", () => {
  const dbPath = getTempDbPath();
  const db = createDatabaseConnection(dbPath);
  const repo = new ResidentRepository(db);

  const residentData = {
    firstName: "Ana",
    lastName: "Cruz",
    address: "123 Mabini St., Barangay 4",
    contactNumber: "09171234567",
    email: "ana.cruz@example.com",
    status: "Active"
  };

  const resident = new Resident(residentData);
  const saved = repo.save(resident);
  const retrieved = repo.findById(saved.id);

  assert.equal(retrieved.firstName, residentData.firstName);
  assert.equal(retrieved.lastName, residentData.lastName);
  assert.equal(retrieved.address, residentData.address);
  assert.equal(retrieved.contactNumber, residentData.contactNumber);
  assert.equal(retrieved.email, residentData.email);
  assert.equal(retrieved.status, residentData.status);

  repo.close();
  cleanupTempDb(dbPath);
});

test("Test 5: Preserve Active Status - verifies Active status remains Active after persistence and retrieval", () => {
  const dbPath = getTempDbPath();
  const db = createDatabaseConnection(dbPath);
  const repo = new ResidentRepository(db);

  const resident = new Resident({
    firstName: "Elena",
    lastName: "Torres",
    address: "Barangay Santo Tomas",
    contactNumber: "09201234567",
    email: "elena@example.com",
    status: "Active"
  });

  const saved = repo.save(resident);
  const retrieved = repo.findById(saved.id);

  assert.equal(retrieved.status, "Active");

  repo.close();
  cleanupTempDb(dbPath);
});

test("Test 6: Missing Resident Is Handled - verifies retrieving a nonexistent ID safely returns null", () => {
  const dbPath = getTempDbPath();
  const db = createDatabaseConnection(dbPath);
  const repo = new ResidentRepository(db);

  const result = repo.findById(999999);
  assert.equal(result, null);

  repo.close();
  cleanupTempDb(dbPath);
});

test("Test 7: Persistence Is Not Limited to One Repository Object - verifies data remains stored across distinct repository instances", () => {
  const dbPath = getTempDbPath();

  // Instance 1: Save Resident
  const db1 = createDatabaseConnection(dbPath);
  const repo1 = new ResidentRepository(db1);
  const resident = new Resident({
    firstName: "Gabriel",
    lastName: "Mendoza",
    address: "Barangay Santo Tomas",
    contactNumber: "09211234567",
    email: "gabriel@example.com",
    status: "Active"
  });
  const saved = repo1.save(resident);
  repo1.close();

  // Instance 2: Retrieve Resident using a brand new connection/repository instance
  const db2 = createDatabaseConnection(dbPath);
  const repo2 = new ResidentRepository(db2);
  const retrieved = repo2.findById(saved.id);

  assert.ok(retrieved);
  assert.equal(retrieved.id, saved.id);
  assert.equal(retrieved.firstName, "Gabriel");
  assert.equal(retrieved.lastName, "Mendoza");

  repo2.close();
  cleanupTempDb(dbPath);
});

test("Student-Designed Test: Multiple Residents Distinct Retrieval - verifies multiple persisted residents receive distinct autoincrement IDs and don't overwrite each other", () => {
  const dbPath = getTempDbPath();
  const db = createDatabaseConnection(dbPath);
  const repo = new ResidentRepository(db);

  const r1 = new Resident({
    firstName: "First",
    lastName: "Resident",
    address: "Address 1",
    contactNumber: "09171111111",
    email: "first@example.com",
    status: "Active"
  });

  const r2 = new Resident({
    firstName: "Second",
    lastName: "Resident",
    address: "Address 2",
    contactNumber: "09172222222",
    email: "second@example.com",
    status: "Inactive"
  });

  const saved1 = repo.save(r1);
  const saved2 = repo.save(r2);

  assert.notEqual(saved1.id, saved2.id);

  const found1 = repo.findById(saved1.id);
  const found2 = repo.findById(saved2.id);

  assert.equal(found1.firstName, "First");
  assert.equal(found1.status, "Active");

  assert.equal(found2.firstName, "Second");
  assert.equal(found2.status, "Inactive");

  repo.close();
  cleanupTempDb(dbPath);
});
