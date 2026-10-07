import { Resident } from "../models/Resident.js";

export class ResidentUpdateService {
  constructor(validator, repository) {
    this.validator = validator;
    this.repository = repository;
  }

  updateResident(residentId, proposedData = {}) {
    const existingResident = this.repository.findById(residentId);

    if (!existingResident) {
      return {
        success: false,
        notFound: true,
        resident: null,
        errors: []
      };
    }

    const candidate = new Resident({
      id: existingResident.id,
      firstName: proposedData.firstName !== undefined ? proposedData.firstName : existingResident.firstName,
      lastName: proposedData.lastName !== undefined ? proposedData.lastName : existingResident.lastName,
      address: proposedData.address !== undefined ? proposedData.address : existingResident.address,
      contactNumber: proposedData.contactNumber !== undefined ? proposedData.contactNumber : existingResident.contactNumber,
      email: proposedData.email !== undefined ? proposedData.email : existingResident.email,
      status: existingResident.status
    });

    const errors = this.validator.validate(candidate);

    if (errors.length > 0) {
      return {
        success: false,
        notFound: false,
        resident: null,
        errors
      };
    }

    const updatedResident = this.repository.update(candidate);

    return {
      success: true,
      notFound: false,
      resident: updatedResident,
      errors: []
    };
  }
}
