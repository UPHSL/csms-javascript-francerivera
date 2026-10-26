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
import { ResidentRegistrationService } from "../src/services/ResidentRegistrationService.js";
import { createDatabaseConnection } from "../src/database/db.js";

function createTemporaryDatabasePath() {
  const fileName = `csms-t04-${crypto.randomUUID()}.sqlite`;
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

function makeResidentWithMissingFirstName() {
  return new Resident({
    firstName: "",
    lastName: "Dela Cruz",
    address: "Barangay Santo Tomas",
    contactNumber: "09171234567",
    email: "juan@example.com",
    status: "Active"
  });
}

function createRegistrationSetup() {
  const databasePath = createTemporaryDatabasePath();
  const db = createDatabaseConnection(databasePath);
  const repository = new ResidentRepository(db);
  const validator = new ResidentValidator();
  const service = new ResidentRegistrationService(validator, repository);
  return { databasePath, repository, validator, service };
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

test("Test 1 - Register a Valid Resident - verifies valid registration succeeds", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeValidResident();
    const result = service.registerResident(resident);
    assert.equal(result.success, true);
    assert.ok(result.resident);
    assert.deepEqual(result.errors, []);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 2 - Registered Resident Receives an Identifier - verifies persistence assigns ID", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeValidResident();
    assert.equal(resident.id, null);
    const result = service.registerResident(resident);
    assert.equal(result.success, true);
    assert.ok(result.resident);
    assert.notEqual(result.resident.id, null);
    assert.notEqual(result.resident.id, undefined);
    assert.ok(Number.isInteger(result.resident.id));
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 3 - Registered Resident Is Persisted - verifies stored resident can be retrieved from repository", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeValidResident();
    const result = service.registerResident(resident);
    assert.equal(result.success, true);
    assert.ok(result.resident);

    const storedResident = repository.findById(result.resident.id);
    assert.ok(storedResident);
    assert.equal(storedResident.id, result.resident.id);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 4 - Registered Resident Information Is Preserved - verifies all properties match original values", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeValidResident();
    const result = service.registerResident(resident);
    const storedResident = repository.findById(result.resident.id);

    assert.ok(storedResident);
    assert.equal(storedResident.firstName, "Juan");
    assert.equal(storedResident.lastName, "Dela Cruz");
    assert.equal(storedResident.address, "Barangay Santo Tomas");
    assert.equal(storedResident.contactNumber, "09171234567");
    assert.equal(storedResident.email, "juan@example.com");
    assert.equal(storedResident.status, "Active");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 5 - Default Active Status Is Preserved - verifies default Active status remains Active after registration", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeValidResident();
    assert.equal(resident.status, "Active");
    const result = service.registerResident(resident);
    assert.equal(result.success, true);
    assert.equal(result.resident.status, "Active");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 6 - Invalid Resident Registration Fails - verifies validation failure stops registration", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeResidentWithMissingFirstName();
    const result = service.registerResident(resident);
    assert.equal(result.success, false);
    assert.equal(result.resident, null);
    assert.ok(result.errors.length > 0);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 7 - Invalid Resident Is Not Persisted - verifies invalid registration does not insert database record", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeResidentWithMissingFirstName();
    const countBefore = countResidents(databasePath);
    const result = service.registerResident(resident);
    const countAfter = countResidents(databasePath);

    assert.equal(result.success, false);
    assert.equal(countAfter, countBefore);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 8 - Validation Failure Can Be Identified - verifies result contains failing field name", () => {
  const { databasePath, repository, service } = createRegistrationSetup();
  try {
    const resident = makeResidentWithMissingFirstName();
    const result = service.registerResident(resident);
    assert.equal(result.success, false);
    assert.ok(result.errors.includes("firstName"));
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});
