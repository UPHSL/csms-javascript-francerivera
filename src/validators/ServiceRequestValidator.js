export class ServiceRequestValidator {
  /**
   * Validates intrinsic ServiceRequest fields.
   * Does NOT perform database lookups or Resident existence checks.
   *
   * @param {import("../models/ServiceRequest.js").ServiceRequest} request
   * @returns {string[]} List of field names that failed validation, or empty array if valid.
   */
  validate(request) {
    const errors = [];

    if (!request) {
      return ["request"];
    }

    // Rule 1: ID must be unassigned before submission (null or undefined)
    if (request.id !== null && request.id !== undefined) {
      errors.push("id");
    }

    // Rule 2: residentId is required and must be a positive integer/number
    if (
      request.residentId === null ||
      request.residentId === undefined ||
      typeof request.residentId !== "number" ||
      isNaN(request.residentId) ||
      request.residentId <= 0
    ) {
      errors.push("residentId");
    }

    // Rule 3: serviceType is required and non-whitespace
    if (
      !request.serviceType ||
      typeof request.serviceType !== "string" ||
      request.serviceType.trim().length === 0
    ) {
      errors.push("serviceType");
    }

    // Rule 4: description is required and non-whitespace
    if (
      !request.description ||
      typeof request.description !== "string" ||
      request.description.trim().length === 0
    ) {
      errors.push("description");
    }

    // Rule 5: dateRequested is required and valid
    if (
      !request.dateRequested ||
      (typeof request.dateRequested === "string" && request.dateRequested.trim().length === 0)
    ) {
      errors.push("dateRequested");
    } else if (typeof request.dateRequested === "string") {
      const parsed = Date.parse(request.dateRequested);
      if (isNaN(parsed)) {
        errors.push("dateRequested");
      }
    }

    // Rule 6: Status must be "Pending" for a new submission
    if (request.status !== "Pending") {
      errors.push("status");
    }

    return errors;
  }
}
