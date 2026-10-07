export class ResidentDeactivationService {
  constructor(repository) {
    this.repository = repository;
  }

  deactivateResident(residentId) {
    const existingResident = this.repository.findById(residentId);

    if (!existingResident) {
      return {
        success: false,
        notFound: true,
        alreadyInactive: false,
        resident: null
      };
    }

    if (existingResident.status === "Inactive") {
      return {
        success: true,
        notFound: false,
        alreadyInactive: true,
        resident: existingResident
      };
    }

    const deactivatedResident = this.repository.deactivateById(residentId);

    return {
      success: true,
      notFound: false,
      alreadyInactive: false,
      resident: deactivatedResident
    };
  }
}
