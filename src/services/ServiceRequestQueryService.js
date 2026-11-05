import { ServiceRequestRepository } from "../repositories/ServiceRequestRepository.js";

const SUPPORTED_STATUSES = Object.freeze(["Pending", "In Progress", "Completed", "Cancelled"]);

export class ServiceRequestQueryService {
  constructor(repository = new ServiceRequestRepository()) {
    this.repository = repository;
  }

  /**
   * List all persisted Service Requests ordered by dateRequested DESC, then id DESC.
   *
   * @returns {import("../models/ServiceRequest.js").ServiceRequest[]} List of service requests or empty array.
   */
  listServiceRequests() {
    return this.repository.findAll();
  }

  /**
   * Alias for listServiceRequests().
   */
  getAll() {
    return this.listServiceRequests();
  }

  /**
   * View one persisted Service Request by its unique identifier.
   *
   * @param {number|string} serviceRequestId Persisted identifier of the service request.
   * @returns {import("../models/ServiceRequest.js").ServiceRequest|null} The service request, or null if not found.
   */
  viewServiceRequest(serviceRequestId) {
    const numericId = Number(serviceRequestId);
    if (isNaN(numericId) || numericId <= 0) {
      return null;
    }
    return this.repository.findById(numericId);
  }

  /**
   * Alias for viewServiceRequest().
   */
  findById(serviceRequestId) {
    return this.viewServiceRequest(serviceRequestId);
  }

  /**
   * Alias for viewServiceRequest().
   */
  getById(serviceRequestId) {
    return this.viewServiceRequest(serviceRequestId);
  }

  /**
   * Search and filter persisted Service Requests by text and/or status.
   *
   * @param {string|object} [searchTerm] Partial search term or options object { searchTerm, statusFilter }.
   * @param {string} [statusFilter] Optional lifecycle status filter (Pending, In Progress, Completed, Cancelled).
   * @returns {import("../models/ServiceRequest.js").ServiceRequest[]} Filtered list ordered by dateRequested DESC, then id DESC.
   */
  searchServiceRequests(searchTerm, statusFilter) {
    let term = searchTerm;
    let status = statusFilter;

    if (typeof searchTerm === "object" && searchTerm !== null) {
      term = searchTerm.searchTerm;
      status = searchTerm.statusFilter;
    }

    const normalizedStatus = (status || "").trim();

    // Validate status filter if non-empty
    if (normalizedStatus.length > 0 && !SUPPORTED_STATUSES.includes(normalizedStatus)) {
      throw new Error(
        `Unsupported status filter: '${normalizedStatus}'. Supported statuses are: ${SUPPORTED_STATUSES.join(", ")}`
      );
    }

    const normalizedTerm = (term || "").trim();

    // Blank search with no status filter returns full listing
    if (normalizedTerm.length === 0 && normalizedStatus.length === 0) {
      return this.listServiceRequests();
    }

    return this.repository.search(normalizedTerm, normalizedStatus || null);
  }
}

// Also export alias for compatibility with alternative search naming conventions
export const ServiceRequestSearchService = ServiceRequestQueryService;
