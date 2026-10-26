import test from 'node:test';
import assert from 'node:assert/strict';

import { createDatabaseConnection } from '../src/database/db.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { ServiceRequestSubmissionService } from '../src/services/ServiceRequestSubmissionService.js';
import { ServiceRequest } from '../src/models/ServiceRequest.js';
import { Resident } from '../src/models/Resident.js';

function createInMemoryTestSetup() {
  const db = createDatabaseConnection(':memory:');
  const residentRepo = new ResidentRepository(db);
  const serviceRequestRepo = new ServiceRequestRepository(db);
  const submissionService = new ServiceRequestSubmissionService(
    undefined,
    serviceRequestRepo,
    residentRepo
  );
  return { db, residentRepo, serviceRequestRepo, submissionService };
}

function createActiveResident(residentRepo) {
  const resident = new Resident({
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    address: '123 Main Street',
    contactNumber: '09171234567',
    email: 'juan@example.com',
    status: 'Active'
  });
  return residentRepo.save(resident);
}

function createInactiveResident(residentRepo) {
  const resident = new Resident({
    firstName: 'Maria',
    lastName: 'Santos',
    address: '456 Oak Avenue',
    contactNumber: '09189876543',
    email: 'maria@example.com',
    status: 'Inactive'
  });
  return residentRepo.save(resident);
}

test('Test 1 - Valid Service Request Submission Succeeds', () => {
  const { residentRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Request for employment requirement',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);

  assert.equal(result.success, true);
  assert.ok(result.serviceRequest);
  assert.equal(result.serviceRequest.status, 'Pending');
});

test('Test 2 - Submitted Service Request Receives a Generated ID', () => {
  const { residentRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Certificate Request',
    description: 'Need certificate for scholarship',
    dateRequested: '2026-09-28'
  });

  assert.equal(request.id, null);

  const result = submissionService.submitServiceRequest(request);

  assert.equal(result.success, true);
  assert.notEqual(result.serviceRequest.id, null);
  assert.equal(typeof result.serviceRequest.id, 'number');
  assert.ok(result.serviceRequest.id > 0);
});

test('Test 3 - Submitted Service Request Is Persisted and Retrievable', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Community Assistance',
    description: 'Request for medical assistance',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);
  const retrieved = serviceRequestRepo.findById(result.serviceRequest.id);

  assert.ok(retrieved);
  assert.equal(retrieved.id, result.serviceRequest.id);
  assert.equal(retrieved.residentId, resident.id);
  assert.equal(retrieved.serviceType, 'Community Assistance');
});

test('Test 4 - Submitted Service Request Information Is Preserved', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Permit Request',
    description: 'Business permit clearance',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);
  const retrieved = serviceRequestRepo.findById(result.serviceRequest.id);

  assert.equal(retrieved.residentId, resident.id);
  assert.equal(retrieved.serviceType, 'Permit Request');
  assert.equal(retrieved.description, 'Business permit clearance');
  assert.equal(retrieved.dateRequested, '2026-09-28');
  assert.equal(retrieved.status, 'Pending');
});

test('Test 5 - Submitted Service Request Status Is Pending', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'General purpose clearance',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);
  const retrieved = serviceRequestRepo.findById(result.serviceRequest.id);

  assert.equal(result.serviceRequest.status, 'Pending');
  assert.equal(retrieved.status, 'Pending');
});

test('Test 6 - Blank Service Type Fails Validation', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: '   ',
    description: 'Valid description',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);

  assert.equal(result.success, false);
  assert.equal(result.validationFailed, true);
  assert.ok(result.errors.includes('serviceType'));
  assert.equal(serviceRequestRepo.count(), 0);
});

test('Test 7 - Blank Description Fails Validation', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: '',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);

  assert.equal(result.success, false);
  assert.equal(result.validationFailed, true);
  assert.ok(result.errors.includes('description'));
  assert.equal(serviceRequestRepo.count(), 0);
});

test('Test 8 - Invalid Request Does Not Reach Persistence', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const initialCount = serviceRequestRepo.count();
  assert.equal(initialCount, 0);

  const invalidRequest = new ServiceRequest({
    residentId: resident.id,
    serviceType: '',
    description: '   ',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(invalidRequest);

  assert.equal(result.success, false);
  assert.equal(serviceRequestRepo.count(), 0);
});

test('Test 9 - Nonexistent Resident Prevents Submission', () => {
  const { serviceRequestRepo, submissionService } = createInMemoryTestSetup();

  const request = new ServiceRequest({
    residentId: 999999,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);

  assert.equal(result.success, false);
  assert.equal(result.notFound, true);
  assert.equal(serviceRequestRepo.count(), 0);
});

test('Test 10 - Inactive Resident Cannot Submit a New Service Request', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const inactiveResident = createInactiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: inactiveResident.id,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);

  assert.equal(result.success, false);
  assert.equal(result.inactive, true);
  assert.equal(serviceRequestRepo.count(), 0);
});

test('Test 11 - Non-Pending Initial Status Is Rejected', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: '2026-09-28',
    status: 'Completed'
  });

  const result = submissionService.submitServiceRequest(request);

  assert.equal(result.success, false);
  assert.equal(result.validationFailed, true);
  assert.ok(result.errors.includes('status'));
  assert.equal(serviceRequestRepo.count(), 0);
});

test('Test 12 - Service Request Persists Across Repository Access', () => {
  const { db, residentRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Cross instance persistence test',
    dateRequested: '2026-09-28'
  });

  const result = submissionService.submitServiceRequest(request);
  const generatedId = result.serviceRequest.id;

  const distinctServiceRequestRepo = new ServiceRequestRepository(db);
  const retrieved = distinctServiceRequestRepo.findById(generatedId);

  assert.ok(retrieved);
  assert.equal(retrieved.id, generatedId);
  assert.equal(retrieved.serviceType, 'Barangay Clearance');
});

test('Test 13 - Submission Does Not Modify the Resident', () => {
  const { residentRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: '2026-09-28'
  });

  submissionService.submitServiceRequest(request);

  const residentAfter = residentRepo.findById(resident.id);

  assert.equal(residentAfter.id, resident.id);
  assert.equal(residentAfter.firstName, 'Juan');
  assert.equal(residentAfter.lastName, 'Dela Cruz');
  assert.equal(residentAfter.address, '123 Main Street');
  assert.equal(residentAfter.contactNumber, '09171234567');
  assert.equal(residentAfter.email, 'juan@example.com');
  assert.equal(residentAfter.status, 'Active');
});

test('Date Validation Test - Invalid Request Date Is Rejected', () => {
  const { residentRepo, serviceRequestRepo, submissionService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const requestWithInvalidDate = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: 'invalid-date-string'
  });

  const result = submissionService.submitServiceRequest(requestWithInvalidDate);

  assert.equal(result.success, false);
  assert.equal(result.validationFailed, true);
  assert.ok(result.errors.includes('dateRequested'));
  assert.equal(serviceRequestRepo.count(), 0);
});
