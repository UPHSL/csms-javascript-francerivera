import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceRequest } from '../src/models/ServiceRequest.js';

test('Test 1 - Service Request Can Be Created', () => {
  const request = new ServiceRequest({
    residentId: 25,
    serviceType: 'Barangay Clearance',
    description: 'Request for employment requirement',
    dateRequested: '2026-09-27'
  });

  assert.ok(request instanceof ServiceRequest);
});

test('Test 2 - Service Request Information Is Accessible', () => {
  const request = new ServiceRequest({
    residentId: 25,
    serviceType: 'Certificate Request',
    description: 'Need certificate for scholarship',
    dateRequested: '2026-09-27'
  });

  assert.equal(request.residentId, 25);
  assert.equal(request.serviceType, 'Certificate Request');
  assert.equal(request.description, 'Need certificate for scholarship');
  assert.equal(request.dateRequested, '2026-09-27');
});

test('Test 3 - Resident ID Is Preserved', () => {
  const request = new ServiceRequest({
    residentId: 25,
    serviceType: 'Barangay Clearance',
    description: 'Employment requirement',
    dateRequested: '2026-09-27'
  });

  assert.equal(request.residentId, 25);
});

test('Test 4 - New Service Request Has an Unassigned ID', () => {
  const request = new ServiceRequest({
    residentId: 25,
    serviceType: 'Community Assistance',
    description: 'Request for medical assistance',
    dateRequested: '2026-09-27'
  });

  assert.equal(request.id, null);
});

test('Test 5 - New Service Request Defaults to Pending', () => {
  const request = new ServiceRequest({
    residentId: 25,
    serviceType: 'Permit Request',
    description: 'Business permit clearance',
    dateRequested: '2026-09-27'
  });

  assert.equal(request.status, 'Pending');
});

test('Test 6 - Service Request Information Is Independent Between Objects', () => {
  const request1 = new ServiceRequest({
    residentId: 10,
    serviceType: 'Barangay Clearance',
    description: 'First request details',
    dateRequested: '2026-09-20'
  });

  const request2 = new ServiceRequest({
    residentId: 99,
    serviceType: 'Community Assistance',
    description: 'Second request details',
    dateRequested: '2026-09-25'
  });

  assert.equal(request1.residentId, 10);
  assert.equal(request1.serviceType, 'Barangay Clearance');
  assert.equal(request1.description, 'First request details');
  assert.equal(request1.dateRequested, '2026-09-20');
  assert.equal(request1.status, 'Pending');

  assert.equal(request2.residentId, 99);
  assert.equal(request2.serviceType, 'Community Assistance');
  assert.equal(request2.description, 'Second request details');
  assert.equal(request2.dateRequested, '2026-09-25');
  assert.equal(request2.status, 'Pending');
});
