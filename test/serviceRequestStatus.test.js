import test from 'node:test';
import assert from 'node:assert/strict';

import { createDatabaseConnection } from '../src/database/db.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { ServiceRequestSubmissionService } from '../src/services/ServiceRequestSubmissionService.js';
import { ServiceRequestStatusService } from '../src/services/ServiceRequestStatusService.js';
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
  const statusService = new ServiceRequestStatusService(serviceRequestRepo);
  return { db, residentRepo, serviceRequestRepo, submissionService, statusService };
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

function submitPendingRequest(residentRepo, submissionService) {
  const resident = createActiveResident(residentRepo);
  const request = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: '2026-10-07'
  });
  const result = submissionService.submitServiceRequest(request);
  return { resident, serviceRequest: result.serviceRequest };
}

test('Test 1 - Pending Can Move to In Progress', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  const result = statusService.updateStatus(serviceRequest.id, 'In Progress');

  assert.equal(result.success, true);
  assert.equal(result.serviceRequest.status, 'In Progress');

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'In Progress');
});

test('Test 2 - Pending Can Move to Cancelled', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  const result = statusService.updateStatus(serviceRequest.id, 'Cancelled');

  assert.equal(result.success, true);
  assert.equal(result.serviceRequest.status, 'Cancelled');

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Cancelled');
});

test('Test 3 - In Progress Can Move to Completed', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  statusService.updateStatus(serviceRequest.id, 'In Progress');
  const result = statusService.updateStatus(serviceRequest.id, 'Completed');

  assert.equal(result.success, true);
  assert.equal(result.serviceRequest.status, 'Completed');

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Completed');
});

test('Test 4 - In Progress Can Move to Cancelled', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  statusService.updateStatus(serviceRequest.id, 'In Progress');
  const result = statusService.updateStatus(serviceRequest.id, 'Cancelled');

  assert.equal(result.success, true);
  assert.equal(result.serviceRequest.status, 'Cancelled');

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Cancelled');
});

test('Test 5 - Pending Cannot Move Directly to Completed', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  const result = statusService.updateStatus(serviceRequest.id, 'Completed');

  assert.equal(result.success, false);
  assert.equal(result.invalidTransition, true);

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Pending');
});

test('Test 6 - In Progress Cannot Return to Pending', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  statusService.updateStatus(serviceRequest.id, 'In Progress');
  const result = statusService.updateStatus(serviceRequest.id, 'Pending');

  assert.equal(result.success, false);
  assert.equal(result.invalidTransition, true);

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'In Progress');
});

test('Test 7 - Completed Is Terminal', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  statusService.updateStatus(serviceRequest.id, 'In Progress');
  statusService.updateStatus(serviceRequest.id, 'Completed');

  const resultPending = statusService.updateStatus(serviceRequest.id, 'Pending');
  assert.equal(resultPending.success, false);
  assert.equal(resultPending.invalidTransition, true);

  const resultInProgress = statusService.updateStatus(serviceRequest.id, 'In Progress');
  assert.equal(resultInProgress.success, false);

  const resultCancelled = statusService.updateStatus(serviceRequest.id, 'Cancelled');
  assert.equal(resultCancelled.success, false);

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Completed');
});

test('Test 8 - Cancelled Is Terminal', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  statusService.updateStatus(serviceRequest.id, 'Cancelled');

  const resultPending = statusService.updateStatus(serviceRequest.id, 'Pending');
  assert.equal(resultPending.success, false);
  assert.equal(resultPending.invalidTransition, true);

  const resultInProgress = statusService.updateStatus(serviceRequest.id, 'In Progress');
  assert.equal(resultInProgress.success, false);

  const resultCompleted = statusService.updateStatus(serviceRequest.id, 'Completed');
  assert.equal(resultCompleted.success, false);

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Cancelled');
});

test('Test 9 - Unsupported Status Is Rejected', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  const result = statusService.updateStatus(serviceRequest.id, 'Approved');

  assert.equal(result.success, false);
  assert.equal(result.unsupportedStatus, true);

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Pending');
});

test('Test 10 - Nonexistent Service Request Is Handled Safely', () => {
  const { statusService } = createInMemoryTestSetup();

  const result = statusService.updateStatus(999999, 'In Progress');

  assert.equal(result.success, false);
  assert.equal(result.notFound, true);
  assert.equal(result.serviceRequest, null);
});

test('Test 11 - Successful Transition Preserves Service Request Information', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { resident, serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  const result = statusService.updateStatus(serviceRequest.id, 'In Progress');

  assert.equal(result.success, true);
  const retrieved = serviceRequestRepo.findById(serviceRequest.id);

  assert.equal(retrieved.id, serviceRequest.id);
  assert.equal(retrieved.residentId, resident.id);
  assert.equal(retrieved.serviceType, 'Barangay Clearance');
  assert.equal(retrieved.description, 'Employment requirement');
  assert.equal(retrieved.dateRequested, '2026-10-07');
  assert.equal(retrieved.status, 'In Progress');
});

test('Test 12 - Invalid Transition Does Not Modify Persistence', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  const result = statusService.updateStatus(serviceRequest.id, 'Completed');

  assert.equal(result.success, false);
  const retrieved = serviceRequestRepo.findById(serviceRequest.id);

  assert.equal(retrieved.status, 'Pending');
  assert.equal(retrieved.serviceType, 'Barangay Clearance');
  assert.equal(retrieved.description, 'Employment requirement');
});

test('Test 13 - Same-Status Request Is Rejected', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const { serviceRequest } = submitPendingRequest(residentRepo, submissionService);

  const result = statusService.updateStatus(serviceRequest.id, 'Pending');

  assert.equal(result.success, false);
  assert.equal(result.invalidTransition, true);
  assert.equal(result.sameStatus, true);

  const retrieved = serviceRequestRepo.findById(serviceRequest.id);
  assert.equal(retrieved.status, 'Pending');
});

test('Student-Designed Test - Full Lifecycle Status Progression and Sequential Independence', () => {
  const { residentRepo, submissionService, statusService, serviceRequestRepo } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const req1 = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'First request for employment',
    dateRequested: '2026-10-07'
  });
  const res1 = submissionService.submitServiceRequest(req1).serviceRequest;

  const req2 = new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Permit Request',
    description: 'Second request for business',
    dateRequested: '2026-10-07'
  });
  const res2 = submissionService.submitServiceRequest(req2).serviceRequest;

  // Progress res1: Pending -> In Progress -> Completed
  assert.equal(statusService.updateStatus(res1.id, 'In Progress').success, true);
  assert.equal(statusService.updateStatus(res1.id, 'Completed').success, true);

  // Progress res2: Pending -> Cancelled
  assert.equal(statusService.updateStatus(res2.id, 'Cancelled').success, true);

  // Verify res1 is Completed and res2 is Cancelled
  assert.equal(serviceRequestRepo.findById(res1.id).status, 'Completed');
  assert.equal(serviceRequestRepo.findById(res2.id).status, 'Cancelled');

  // Verify both terminal states reject further transition attempts
  assert.equal(statusService.updateStatus(res1.id, 'In Progress').success, false);
  assert.equal(statusService.updateStatus(res2.id, 'In Progress').success, false);
});
