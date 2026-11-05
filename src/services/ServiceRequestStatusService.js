import { ServiceRequestRepository } from "../repositories/ServiceRequestRepository.js";

export class ServiceRequestStatusService {
  constructor(serviceRequestRepository = new ServiceRequestRepository()) {
    this.serviceRequestRepository = serviceRequestRepository;
  }

  updateStatus(serviceRequestId, requestedStatus) {
    const numericId = Number(serviceRequestId);

    // Step 1: Retrieve existing Service Request from persistence
    const existing = this.serviceRequestRepository.findById(numericId);
    if (!existing) {
      return {
        success: false,
        notFound: true,
        unsupportedStatus: false,
        invalidTransition: false,
        serviceRequest: null,
        errors: ["id"]
      };
    }

    // Step 2: Validate supported statuses (Pending, In Progress, Completed, Cancelled)
    const supportedStatuses = ["Pending", "In Progress", "Completed", "Cancelled"];
    if (!supportedStatuses.includes(requestedStatus)) {
      return {
        success: false,
        notFound: false,
        unsupportedStatus: true,
        invalidTransition: false,
        serviceRequest: existing,
        errors: ["status"]
      };
    }

    // Step 3: Handle same-status requests (rejected for T10)
    if (existing.status === requestedStatus) {
      return {
        success: false,
        notFound: false,
        unsupportedStatus: false,
        invalidTransition: true,
        sameStatus: true,
        serviceRequest: existing,
        errors: ["status"]
      };
    }

    // Step 4: Enforce allowed state transition rules
    const allowedTransitions = {
      "Pending": ["In Progress", "Cancelled"],
      "In Progress": ["Completed", "Cancelled"],
      "Completed": [],
      "Cancelled": []
    };

    const allowedTargets = allowedTransitions[existing.status] || [];
    if (!allowedTargets.includes(requestedStatus)) {
      return {
        success: false,
        notFound: false,
        unsupportedStatus: false,
        invalidTransition: true,
        sameStatus: false,
        serviceRequest: existing,
        errors: ["status"]
      };
    }

    // Step 5: Persist valid status transition
    const updatedServiceRequest = this.serviceRequestRepository.updateStatus(numericId, requestedStatus);

    return {
      success: true,
      notFound: false,
      unsupportedStatus: false,
      invalidTransition: false,
      sameStatus: false,
      serviceRequest: updatedServiceRequest,
      errors: []
    };
  }
}
