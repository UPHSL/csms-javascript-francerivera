import test from 'node:test';
import assert from 'node:assert/strict';

import { createDatabaseConnection } from '../src/database/db.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { ServiceRequestQueryService } from '../src/services/ServiceRequestQueryService.js';
import { ServiceRequest } from '../src/models/ServiceRequest.js';
import { Resident } from '../src/models/Resident.js';

function createInMemoryTestSetup() {
  const db = createDatabaseConnection(':memory:');
  const residentRepo = new ResidentRepository(db);
  const serviceRequestRepo = new ServiceRequestRepository(db);
  const queryService = new ServiceRequestQueryService(serviceRequestRepo);
  return { db, residentRepo, serviceRequestRepo, queryService };
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

test('Test 1 - List All Persisted Service Requests', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'First request',
    dateRequested: '2026-10-01'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Certificate Request',
    description: 'Second request',
    dateRequested: '2026-10-02'
  }));

  const results = queryService.listServiceRequests();

  assert.equal(Array.isArray(results), true);
  assert.equal(results.length, 2);
  const serviceTypes = results.map((r) => r.serviceType);
  assert.ok(serviceTypes.includes('Barangay Clearance'));
  assert.ok(serviceTypes.includes('Certificate Request'));
});

test('Test 2 - Empty Listing Returns an Empty Collection', () => {
  const { queryService } = createInMemoryTestSetup();

  const results = queryService.listServiceRequests();

  assert.equal(Array.isArray(results), true);
  assert.equal(results.length, 0);
  assert.deepEqual(results, []);
});

test('Test 3 - Listing Uses Required Ordering', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  // Insert out of order
  const req1 = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Permit Request',
    description: 'Older date',
    dateRequested: '2026-09-10'
  }));

  const req2 = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Shared date lower ID',
    dateRequested: '2026-09-18'
  }));

  const req3 = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Certificate Request',
    description: 'Shared date higher ID',
    dateRequested: '2026-09-18'
  }));

  const req4 = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Community Assistance',
    description: 'Intermediate date',
    dateRequested: '2026-09-15'
  }));

  const results = queryService.listServiceRequests();

  assert.equal(results.length, 4);
  // Expected order: dateRequested DESC, then id DESC
  // req3 (2026-09-18, higher id), req2 (2026-09-18, lower id), req4 (2026-09-15), req1 (2026-09-10)
  assert.equal(results[0].id, req3.id);
  assert.equal(results[0].dateRequested, '2026-09-18');

  assert.equal(results[1].id, req2.id);
  assert.equal(results[1].dateRequested, '2026-09-18');

  assert.equal(results[2].id, req4.id);
  assert.equal(results[2].dateRequested, '2026-09-15');

  assert.equal(results[3].id, req1.id);
  assert.equal(results[3].dateRequested, '2026-09-10');
});

test('Test 4 - View Existing Service Request by ID', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const saved = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Employment clearance request',
    dateRequested: '2026-10-05'
  }));

  const retrieved = queryService.viewServiceRequest(saved.id);

  assert.ok(retrieved);
  assert.equal(retrieved.id, saved.id);
  assert.equal(retrieved.residentId, resident.id);
  assert.equal(retrieved.serviceType, 'Barangay Clearance');
  assert.equal(retrieved.description, 'Employment clearance request');
  assert.equal(retrieved.dateRequested, '2026-10-05');
  assert.equal(retrieved.status, 'Pending');
});

test('Test 5 - Viewing an Unknown ID Is Handled Safely', () => {
  const { serviceRequestRepo, queryService } = createInMemoryTestSetup();

  const countBefore = serviceRequestRepo.count();
  const result = queryService.viewServiceRequest(999999);

  assert.equal(result, null);
  assert.equal(serviceRequestRepo.count(), countBefore);
});

test('Test 6 - Partial Service-Type Search Is Case-Insensitive', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Job requirement',
    dateRequested: '2026-10-10'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Community Assistance',
    description: 'Medical support',
    dateRequested: '2026-10-11'
  }));

  const results = queryService.searchServiceRequests('cLeAr');

  assert.equal(results.length, 1);
  assert.equal(results[0].serviceType, 'Barangay Clearance');
});

test('Test 7 - Partial Description Search Is Case-Insensitive', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Permit Request',
    description: 'Requesting clearance for employment requirements.',
    dateRequested: '2026-10-12'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Community Assistance',
    description: 'Food package assistance.',
    dateRequested: '2026-10-13'
  }));

  const results = queryService.searchServiceRequests('eMpLoYmEnT');

  assert.equal(results.length, 1);
  assert.equal(results[0].serviceType, 'Permit Request');
  assert.ok(results[0].description.includes('employment'));
});

test('Test 8 - Blank Search Returns All Service Requests', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'First',
    dateRequested: '2026-10-01'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Certificate Request',
    description: 'Second',
    dateRequested: '2026-10-02'
  }));

  const listAll = queryService.listServiceRequests();
  const whitespaceSearch = queryService.searchServiceRequests('   ');
  const emptySearch = queryService.searchServiceRequests('');

  assert.equal(whitespaceSearch.length, 2);
  assert.deepEqual(
    whitespaceSearch.map((r) => r.id),
    listAll.map((r) => r.id)
  );
  assert.deepEqual(
    emptySearch.map((r) => r.id),
    listAll.map((r) => r.id)
  );
});

test('Test 9 - No Text Match Returns an Empty Collection', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Valid request',
    dateRequested: '2026-10-01'
  }));

  const results = queryService.searchServiceRequests('NonExistentTermXYZ');

  assert.equal(Array.isArray(results), true);
  assert.equal(results.length, 0);
  assert.deepEqual(results, []);
});

test('Test 10 - Status Filter Returns Only Matching Status', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Request 1',
    description: 'Desc 1',
    dateRequested: '2026-10-01',
    status: 'Pending'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Request 2',
    description: 'Desc 2',
    dateRequested: '2026-10-02',
    status: 'In Progress'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Request 3',
    description: 'Desc 3',
    dateRequested: '2026-10-03',
    status: 'Completed'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Request 4',
    description: 'Desc 4',
    dateRequested: '2026-10-04',
    status: 'Cancelled'
  }));

  const pendingResults = queryService.searchServiceRequests('', 'Pending');

  assert.equal(pendingResults.length, 1);
  assert.equal(pendingResults[0].status, 'Pending');
  assert.equal(pendingResults[0].serviceType, 'Request 1');

  const completedResults = queryService.searchServiceRequests(null, 'Completed');
  assert.equal(completedResults.length, 1);
  assert.equal(completedResults[0].status, 'Completed');
});

test('Test 11 - Unfiltered Query Includes All Statuses', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Req Pending',
    description: 'Desc',
    dateRequested: '2026-10-01',
    status: 'Pending'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Req In Progress',
    description: 'Desc',
    dateRequested: '2026-10-02',
    status: 'In Progress'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Req Completed',
    description: 'Desc',
    dateRequested: '2026-10-03',
    status: 'Completed'
  }));

  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Req Cancelled',
    description: 'Desc',
    dateRequested: '2026-10-04',
    status: 'Cancelled'
  }));

  const allRequests = queryService.listServiceRequests();

  assert.equal(allRequests.length, 4);
  const statuses = allRequests.map((r) => r.status);
  assert.ok(statuses.includes('Pending'));
  assert.ok(statuses.includes('In Progress'));
  assert.ok(statuses.includes('Completed'));
  assert.ok(statuses.includes('Cancelled'));
});

test('Test 12 - Combined Text Search and Status Filter', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  // Request A: matches text AND status
  const reqA = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: '2026-10-01',
    status: 'Pending'
  }));

  // Request B: matches text only (status is Completed)
  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Scholarship requirement',
    dateRequested: '2026-10-02',
    status: 'Completed'
  }));

  // Request C: matches status only (text is Community Assistance)
  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Community Assistance',
    description: 'Employment support',
    dateRequested: '2026-10-03',
    status: 'Pending'
  }));

  // Request D: matches neither
  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Permit Request',
    description: 'Business permit',
    dateRequested: '2026-10-04',
    status: 'Cancelled'
  }));

  const results = queryService.searchServiceRequests('clearance', 'Pending');

  assert.equal(results.length, 1);
  assert.equal(results[0].id, reqA.id);
  assert.equal(results[0].serviceType, 'Barangay Clearance');
  assert.equal(results[0].status, 'Pending');
});

test('Test 13 - Matching Service Request Is Not Duplicated', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  // Both serviceType AND description contain 'assistance'
  serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Community Assistance',
    description: 'Assistance requested for medical aid',
    dateRequested: '2026-10-01',
    status: 'Pending'
  }));

  const results = queryService.searchServiceRequests('assistance');

  assert.equal(results.length, 1);
});

test('Test 14 - Query Result Preserves Complete Service Request Information', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const original = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Clearance for work application',
    dateRequested: '2026-10-05',
    status: 'Pending'
  }));

  const [listed] = queryService.listServiceRequests();
  const [searched] = queryService.searchServiceRequests('work');
  const viewed = queryService.viewServiceRequest(original.id);

  for (const item of [listed, searched, viewed]) {
    assert.equal(item.id, original.id);
    assert.equal(item.residentId, original.residentId);
    assert.equal(item.serviceType, 'Barangay Clearance');
    assert.equal(item.description, 'Clearance for work application');
    assert.equal(item.dateRequested, '2026-10-05');
    assert.equal(item.status, 'Pending');
  }
});

test('Additional Test - Unsupported Status Filter Throws Descriptive Error', () => {
  const { queryService } = createInMemoryTestSetup();

  assert.throws(
    () => queryService.searchServiceRequests('clearance', 'Approved'),
    /Unsupported status filter: 'Approved'/
  );

  assert.throws(
    () => queryService.searchServiceRequests('', 'Rejected'),
    /Unsupported status filter: 'Rejected'/
  );
});

test('Additional Test - Query Persistence Across Distinct Repository Instances', () => {
  const { db, residentRepo, serviceRequestRepo } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const saved = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Permit Request',
    description: 'Building permit clearance',
    dateRequested: '2026-10-15',
    status: 'In Progress'
  }));

  // Create a separate repository and query service sharing the same SQLite DB
  const distinctRepo = new ServiceRequestRepository(db);
  const distinctQueryService = new ServiceRequestQueryService(distinctRepo);

  const found = distinctQueryService.viewServiceRequest(saved.id);
  assert.ok(found);
  assert.equal(found.id, saved.id);
  assert.equal(found.serviceType, 'Permit Request');
  assert.equal(found.status, 'In Progress');

  const searchResults = distinctQueryService.searchServiceRequests('building', 'In Progress');
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, saved.id);
});

test('Additional Test - Query Operations Are Read-Only and Do Not Mutate State', () => {
  const { residentRepo, serviceRequestRepo, queryService } = createInMemoryTestSetup();
  const resident = createActiveResident(residentRepo);

  const req = serviceRequestRepo.save(new ServiceRequest({
    residentId: resident.id,
    serviceType: 'Barangay Clearance',
    description: 'Read-only check',
    dateRequested: '2026-10-01',
    status: 'Pending'
  }));

  const initialCount = serviceRequestRepo.count();

  // Perform multiple queries
  queryService.listServiceRequests();
  queryService.viewServiceRequest(req.id);
  queryService.viewServiceRequest(999999);
  queryService.searchServiceRequests('Barangay');
  queryService.searchServiceRequests('non-matching');
  queryService.searchServiceRequests('', 'Pending');

  // Verify count and record remain unchanged
  assert.equal(serviceRequestRepo.count(), initialCount);
  const after = serviceRequestRepo.findById(req.id);
  assert.equal(after.status, 'Pending');
  assert.equal(after.serviceType, 'Barangay Clearance');
  assert.equal(after.description, 'Read-only check');
});
