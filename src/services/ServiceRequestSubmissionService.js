import { ServiceRequestValidator } from "../validators/ServiceRequestValidator.js";
import { ServiceRequestRepository } from "../repositories/ServiceRequestRepository.js";
import { ResidentRepository } from "../repositories/ResidentRepository.js";

export class ServiceRequestSubmissionService {
  constructor(
    validator = new ServiceRequestValidator(),
    serviceRequestRepository = new ServiceRequestRepository(),
    residentRepository = new ResidentRepository()
  ) {
    this.validator = validator;
    this.serviceRequestRepository = serviceRequestRepository;
    this.residentRepository = residentRepository;
  }

  submitServiceRequest(serviceRequest) {
    // Step 1: Validate intrinsic Service Request fields
    const validationErrors = this.validator.validate(serviceRequest);
    if (validationErrors.length > 0) {
      return {
        success: false,
        validationFailed: true,
        notFound: false,
        inactive: false,
        serviceRequest: null,
        errors: validationErrors
      };
    }

    // Step 2: Retrieve Resident using residentId
    const resident = this.residentRepository.findById(serviceRequest.residentId);
    if (!resident) {
      return {
        success: false,
        validationFailed: false,
        notFound: true,
        inactive: false,
        serviceRequest: null,
        errors: ["residentId"]
      };
    }

    // Step 3: Check Resident's current lifecycle status
    if (resident.status !== "Active") {
      return {
        success: false,
        validationFailed: false,
        notFound: false,
        inactive: true,
        serviceRequest: null,
        errors: ["status"]
      };
    }

    // Step 4: Persist valid Service Request (maintains status = "Pending")
    const persistedRequest = this.serviceRequestRepository.save(serviceRequest);

    return {
      success: true,
      validationFailed: false,
      notFound: false,
      inactive: false,
      serviceRequest: persistedRequest,
      errors: []
    };
  }
}
