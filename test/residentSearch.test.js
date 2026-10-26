import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { Resident } from "../src/models/Resident.js";
import { ResidentRepository } from "../src/repositories/ResidentRepository.js";
import { ResidentSearchService } from "../src/services/ResidentSearchService.js";
import { createDatabaseConnection } from "../src/database/db.js";

function createTemporaryDatabasePath() {
  const fileName = `csms-t05-${crypto.randomUUID()}.sqlite`;
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

function createSearchSetup() {
  const databasePath = createTemporaryDatabasePath();
  const db = createDatabaseConnection(databasePath);
  const repository = new ResidentRepository(db);
  const service = new ResidentSearchService(repository);
  return { databasePath, repository, service };
}

test("Test 1 - List All Persisted Residents - verifies all stored residents are returned", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Dela Cruz",
        address: "Barangay 1",
        contactNumber: "09171234567",
        email: "juan@example.com"
      })
    );
    repository.save(
      new Resident({
        firstName: "Maria",
        lastName: "Santos",
        address: "Barangay 2",
        contactNumber: "09181234567",
        email: "maria@example.com"
      })
    );

    const residents = service.listResidents();
    assert.equal(residents.length, 2);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 2 - Empty Resident Listing - verifies empty database returns empty array []", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    const residents = service.listResidents();
    assert.ok(Array.isArray(residents));
    assert.equal(residents.length, 0);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 3 - Resident Listing Uses Required Ordering - verifies lastName ASC, firstName ASC, id ASC", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Ana",
        lastName: "Santos",
        address: "Barangay 1",
        contactNumber: "09171111111",
        email: "ana@example.com"
      })
    );
    repository.save(
      new Resident({
        firstName: "Pedro",
        lastName: "Cruz",
        address: "Barangay 2",
        contactNumber: "09172222222",
        email: "pedro@example.com"
      })
    );
    repository.save(
      new Resident({
        firstName: "Maria",
        lastName: "Andres",
        address: "Barangay 3",
        contactNumber: "09173333333",
        email: "maria@example.com"
      })
    );
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Cruz",
        address: "Barangay 4",
        contactNumber: "09174444444",
        email: "juan@example.com"
      })
    );

    const residents = service.listResidents();
    assert.equal(residents.length, 4);
    assert.equal(residents[0].lastName, "Andres");
    assert.equal(residents[0].firstName, "Maria");

    assert.equal(residents[1].lastName, "Cruz");
    assert.equal(residents[1].firstName, "Juan");

    assert.equal(residents[2].lastName, "Cruz");
    assert.equal(residents[2].firstName, "Pedro");

    assert.equal(residents[3].lastName, "Santos");
    assert.equal(residents[3].firstName, "Ana");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 4 - Partial First Name Search Is Case-Insensitive - verifies jUa matches Juan", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Dela Cruz",
        address: "Barangay 1",
        contactNumber: "09171234567",
        email: "juan@example.com"
      })
    );

    const results = service.searchResidents("jUa");
    assert.equal(results.length, 1);
    assert.equal(results[0].firstName, "Juan");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 5 - Partial Last Name Search Is Case-Insensitive - verifies cRuZ matches Dela Cruz", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Dela Cruz",
        address: "Barangay 1",
        contactNumber: "09171234567",
        email: "juan@example.com"
      })
    );

    const results = service.searchResidents("cRuZ");
    assert.equal(results.length, 1);
    assert.equal(results[0].lastName, "Dela Cruz");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 6 - Blank Search Returns All Residents - verifies whitespace search returns full listing", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Dela Cruz",
        address: "Barangay 1",
        contactNumber: "09171234567",
        email: "juan@example.com"
      })
    );
    repository.save(
      new Resident({
        firstName: "Maria",
        lastName: "Santos",
        address: "Barangay 2",
        contactNumber: "09181234567",
        email: "maria@example.com"
      })
    );

    const results = service.searchResidents("   ");
    assert.equal(results.length, 2);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 7 - Search With No Match Returns Empty Collection - verifies no match returns []", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Dela Cruz",
        address: "Barangay 1",
        contactNumber: "09171234567",
        email: "juan@example.com"
      })
    );

    const results = service.searchResidents("ZzzUnknownResident");
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 8 - Search Results Preserve Resident Information - verifies leading zero in contact number is preserved", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Dela Cruz",
        address: "123 Mabini St.",
        contactNumber: "09171234567",
        email: "juan@example.com",
        status: "Active"
      })
    );

    const results = service.searchResidents("Juan");
    assert.equal(results.length, 1);
    const r = results[0];
    assert.ok(r.id);
    assert.equal(r.firstName, "Juan");
    assert.equal(r.lastName, "Dela Cruz");
    assert.equal(r.address, "123 Mabini St.");
    assert.equal(r.contactNumber, "09171234567");
    assert.equal(r.email, "juan@example.com");
    assert.equal(r.status, "Active");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 9 - Active and Inactive Residents Are Included - verifies search does not filter by status", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "ActivePerson",
        address: "Barangay 1",
        contactNumber: "09171111111",
        email: "active@example.com",
        status: "Active"
      })
    );
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "InactivePerson",
        address: "Barangay 2",
        contactNumber: "09172222222",
        email: "inactive@example.com",
        status: "Inactive"
      })
    );

    const results = service.searchResidents("Juan");
    assert.equal(results.length, 2);
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});

test("Test 10 - Matching Resident Is Not Duplicated - verifies single matching resident appears only once", () => {
  const { databasePath, repository, service } = createSearchSetup();
  try {
    // Both first and last name contain 'an'
    repository.save(
      new Resident({
        firstName: "Juan",
        lastName: "Santos",
        address: "Barangay 1",
        contactNumber: "09171234567",
        email: "juan@example.com"
      })
    );

    const results = service.searchResidents("an");
    assert.equal(results.length, 1);
    assert.equal(results[0].firstName, "Juan");
  } finally {
    repository.close();
    removeDatabase(databasePath);
  }
});
