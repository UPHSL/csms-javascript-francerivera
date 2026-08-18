import assert from "node:assert/strict";
import test from "node:test";

import { Resident } from "../src/models/Resident.js";

test("Test 1: Resident Creation - verifies a Resident can be created with valid information", () => {
  const residentData = {
    id: 1,
    firstName: "Juan",
    lastName: "Dela Cruz",
    address: "123 Sampaguita St., Barangay 1",
    contactNumber: "09171234567",
    email: "juan.delacruz@example.com",
    status: "Active"
  };

  const resident = new Resident(residentData);

  assert.ok(resident instanceof Resident);
  assert.equal(resident.id, 1);
  assert.equal(resident.firstName, "Juan");
  assert.equal(resident.lastName, "Dela Cruz");
  assert.equal(resident.address, "123 Sampaguita St., Barangay 1");
  assert.equal(resident.contactNumber, "09171234567");
  assert.equal(resident.email, "juan.delacruz@example.com");
  assert.equal(resident.status, "Active");
});

test("Test 2: Resident Information Access - verifies properties can be assigned and retrieved", () => {
  const resident = new Resident({
    id: "RES-002",
    firstName: "Maria",
    lastName: "Santos",
    address: "456 Mabini Ave., Barangay 2",
    contactNumber: "09189876543",
    email: "maria.santos@example.com",
    status: "Active"
  });

  // Verify initial assignment
  assert.equal(resident.id, "RES-002");
  assert.equal(resident.firstName, "Maria");
  assert.equal(resident.lastName, "Santos");
  assert.equal(resident.address, "456 Mabini Ave., Barangay 2");
  assert.equal(resident.contactNumber, "09189876543");
  assert.equal(resident.email, "maria.santos@example.com");

  // Verify properties can be modified/updated directly
  resident.firstName = "Maria Clara";
  resident.address = "789 Rizal St., Barangay 3";

  assert.equal(resident.firstName, "Maria Clara");
  assert.equal(resident.address, "789 Rizal St., Barangay 3");
});

test("Test 3: Resident Status - verifies the Resident model defaults to and represents Active status", () => {
  // Test explicit status assignment
  const activeResident = new Resident({
    id: 3,
    firstName: "Pedro",
    lastName: "Penduko",
    status: "Active"
  });
  assert.equal(activeResident.status, "Active");

  // Test default status when status is omitted
  const defaultResident = new Resident({
    id: 4,
    firstName: "Ana",
    lastName: "Rizal"
  });
  assert.equal(defaultResident.status, "Active");
});
