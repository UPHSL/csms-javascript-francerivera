import { ServiceRequest } from "../models/ServiceRequest.js";

const VALIDATION_ERROR_MESSAGES = {
  serviceType: "Service type is required.",
  description: "Description is required.",
  dateRequested: "Date requested is required and must be valid.",
  residentId: "Resident ID is required and must be a valid positive number.",
  status: "Status is invalid.",
  id: "Service Request ID must not be assigned manually."
};

/**
 * Format raw validator field names into human-readable error messages.
 *
 * @param {string[]} errors
 * @returns {string[]}
 */
function formatValidationErrors(errors = []) {
  return errors.map((field) => VALIDATION_ERROR_MESSAGES[field] || `Invalid ${field}.`);
}

/**
 * Defensively parse and validate a route parameter as a positive integer identifier.
 *
 * @param {string|number} idParam
 * @returns {number|null} Valid integer ID or null if malformed.
 */
function parseIdentifier(idParam) {
  const parsed = Number(idParam);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Handle listing, searching, and filtering of Service Requests.
 * Reuses ServiceRequestQueryService (T11).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function listServiceRequests(req, res) {
  const { serviceRequestQueryService } = req.app.locals.services;
  const searchTerm = req.query.search !== undefined ? req.query.search : "";
  const statusFilter = req.query.status !== undefined ? req.query.status : "";
  const message = req.query.message || null;
  const error = req.query.error || null;

  let serviceRequests = [];
  try {
    serviceRequests = serviceRequestQueryService.searchServiceRequests(searchTerm, statusFilter);
  } catch (err) {
    // If an invalid status filter was provided, fall back safely
    serviceRequests = [];
  }

  res.render("service-requests/index", {
    serviceRequests,
    searchTerm: typeof searchTerm === "string" ? searchTerm.trim() : "",
    statusFilter: typeof statusFilter === "string" ? statusFilter.trim() : "",
    message,
    error
  });
}

/**
 * Render the Service Request submission form.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function showNewForm(req, res) {
  res.render("service-requests/new", {
    serviceRequest: {
      residentId: req.query.residentId || "",
      serviceType: "",
      description: "",
      dateRequested: new Date().toISOString().split("T")[0]
    },
    errors: []
  });
}

/**
 * Handle Service Request submission.
 * Reuses ServiceRequestSubmissionService (T09).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function submitServiceRequest(req, res) {
  const { serviceRequestSubmissionService } = req.app.locals.services;
  const { residentId, serviceType, description, dateRequested } = req.body;

  const parsedResidentId = residentId !== undefined && residentId !== "" ? Number(residentId) : null;

  const candidate = new ServiceRequest({
    residentId: parsedResidentId,
    serviceType,
    description,
    dateRequested,
    status: "Pending"
  });

  const result = serviceRequestSubmissionService.submitServiceRequest(candidate);

  if (result.success) {
    return res.redirect(
      "/service-requests?message=" + encodeURIComponent("Service Request submitted successfully.")
    );
  }

  // Handle specific T09 rejection reasons
  const errors = [];
  if (result.notFound) {
    errors.push("Resident not found.");
  } else if (result.inactive) {
    errors.push("Inactive Residents cannot submit new Service Requests.");
  } else if (result.validationFailed && result.errors) {
    errors.push(...formatValidationErrors(result.errors));
  } else if (result.errors && result.errors.length > 0) {
    errors.push(...formatValidationErrors(result.errors));
  } else {
    errors.push("Unable to submit Service Request. Please verify your input.");
  }

  return res.status(400).render("service-requests/new", {
    serviceRequest: {
      residentId: residentId || "",
      serviceType: serviceType || "",
      description: description || "",
      dateRequested: dateRequested || ""
    },
    errors
  });
}

/**
 * View one Service Request by ID.
 * Reuses ServiceRequestQueryService (T11).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function viewServiceRequest(req, res) {
  const { serviceRequestQueryService } = req.app.locals.services;
  const requestId = parseIdentifier(req.params.id);

  if (!requestId) {
    return res.status(404).render("service-requests/not-found", {
      message: "Service Request not found."
    });
  }

  const serviceRequest = serviceRequestQueryService.viewServiceRequest(requestId);

  if (!serviceRequest) {
    return res.status(404).render("service-requests/not-found", {
      message: "Service Request not found."
    });
  }

  const message = req.query.message || null;
  const error = req.query.error || null;

  return res.render("service-requests/view", {
    serviceRequest,
    message,
    error
  });
}

/**
 * Transition status of a Service Request.
 * Reuses ServiceRequestStatusService (T10).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function updateStatus(req, res) {
  const { serviceRequestStatusService } = req.app.locals.services;
  const requestId = parseIdentifier(req.params.id);

  if (!requestId) {
    return res.status(404).render("service-requests/not-found", {
      message: "Service Request not found."
    });
  }

  const requestedStatus = req.body.status;

  const result = serviceRequestStatusService.updateStatus(requestId, requestedStatus);

  if (result.notFound) {
    return res.status(404).render("service-requests/not-found", {
      message: "Service Request not found."
    });
  }

  if (!result.success) {
    let errorMessage = "Invalid status transition.";
    if (result.unsupportedStatus) {
      errorMessage = `Unsupported status: '${requestedStatus}'.`;
    } else if (result.sameStatus) {
      errorMessage = `Service Request is already in '${requestedStatus}' status.`;
    } else if (result.invalidTransition) {
      errorMessage = `Cannot transition Service Request to '${requestedStatus}'.`;
    }

    return res.status(400).render("service-requests/view", {
      serviceRequest: result.serviceRequest,
      message: null,
      error: errorMessage
    });
  }

  let successMsg = "Service Request status updated successfully.";
  if (requestedStatus === "In Progress") {
    successMsg = "Service Request is now In Progress.";
  } else if (requestedStatus === "Completed") {
    successMsg = "Service Request completed successfully.";
  } else if (requestedStatus === "Cancelled") {
    successMsg = "Service Request cancelled successfully.";
  }

  // Redirect to details view with message
  return res.redirect(
    `/service-requests/${requestId}?message=` + encodeURIComponent(successMsg)
  );
}

/**
 * Shortcut handler: Start processing (Pending -> In Progress)
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function startProcessing(req, res) {
  req.body = req.body || {};
  req.body.status = "In Progress";
  return updateStatus(req, res);
}

/**
 * Shortcut handler: Complete (In Progress -> Completed)
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function completeRequest(req, res) {
  req.body = req.body || {};
  req.body.status = "Completed";
  return updateStatus(req, res);
}

/**
 * Shortcut handler: Cancel (Pending / In Progress -> Cancelled)
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function cancelRequest(req, res) {
  req.body = req.body || {};
  req.body.status = "Cancelled";
  return updateStatus(req, res);
}
