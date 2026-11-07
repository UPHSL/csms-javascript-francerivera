export class DashboardService {
  constructor(residentRepository, serviceRequestRepository) {
    this.residentRepository = residentRepository;
    this.serviceRequestRepository = serviceRequestRepository;
  }

  /**
   * Compose the complete operational summary for the CSMS dashboard.
   *
   * @returns {object} Dashboard summary metrics and recent service requests.
   */
  getDashboardSummary() {
    // 1. Resident Summary (Persistence-level aggregates)
    const totalResidents = this.residentRepository.countAll();
    const activeResidents = this.residentRepository.countByStatus("Active");
    const inactiveResidents = this.residentRepository.countByStatus("Inactive");

    // 2. Service Request Summary (Persistence-level aggregates)
    const totalServiceRequests = this.serviceRequestRepository.countAll();
    const pendingRequests = this.serviceRequestRepository.countByStatus("Pending");
    const inProgressRequests = this.serviceRequestRepository.countByStatus("In Progress");
    const completedRequests = this.serviceRequestRepository.countByStatus("Completed");
    const cancelledRequests = this.serviceRequestRepository.countByStatus("Cancelled");

    // 3. Derived Open Service Requests Metric (Pending + In Progress)
    const openServiceRequests = pendingRequests + inProgressRequests;

    // 4. Five Most Recent Service Requests (T11 ordering: dateRequested DESC, then id DESC, max 5)
    const recentServiceRequests = this.serviceRequestRepository.findRecent(5);

    return {
      residents: {
        total: totalResidents,
        active: activeResidents,
        inactive: inactiveResidents
      },
      serviceRequests: {
        total: totalServiceRequests,
        open: openServiceRequests,
        pending: pendingRequests,
        inProgress: inProgressRequests,
        completed: completedRequests,
        cancelled: cancelledRequests
      },
      recentServiceRequests
    };
  }
}

