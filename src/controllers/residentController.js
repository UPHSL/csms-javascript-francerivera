import { Resident } from "../models/Resident.js";

const ERROR_MESSAGES = {
  firstName: "First name is required.",
  lastName: "Last name is required.",
  address: "Address is required.",
  contactNumber: "Contact number must follow 09XXXXXXXXX.",
  email: "Email address is invalid.",
  status: "Status is invalid."
};

/**
 * Format raw validator field names into human-readable error messages.
 *
 * @param {string[]} errors
 * @returns {string[]}
 */
function formatValidationErrors(errors = []) {
  return errors.map((field) => ERROR_MESSAGES[field] || `Invalid ${field}.`);
}

/**
 * Handle listing and searching of Residents.
 * Reuses ResidentSearchService (T05).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function listResidents(req, res) {
  const { residentSearchService } = req.app.locals.services;
  const searchTerm = req.query.search !== undefined ? req.query.search : "";
  const residents = residentSearchService.searchResidents(searchTerm);
  const message = req.query.message || null;
  const error = req.query.error || null;

  res.render("residents/index", {
    residents,
    searchTerm: searchTerm.trim(),
    message,
    error
  });
}

/**
 * Render the Resident registration form.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function showRegisterForm(req, res) {
  res.render("residents/register", {
    resident: {
      firstName: "",
      lastName: "",
      address: "",
      contactNumber: "",
      email: ""
    },
    errors: []
  });
}

/**
 * Handle registration submission.
 * Reuses ResidentRegistrationService (T04) and ResidentValidator (T02).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function registerResident(req, res) {
  const { residentRegistrationService } = req.app.locals.services;
  const { firstName, lastName, address, contactNumber, email } = req.body;

  const candidate = new Resident({
    firstName,
    lastName,
    address,
    contactNumber,
    email,
    status: "Active"
  });

  const result = residentRegistrationService.registerResident(candidate);

  if (result.success) {
    return res.redirect(
      "/residents?message=" + encodeURIComponent("Resident registered successfully.")
    );
  }

  return res.status(400).render("residents/register", {
    resident: candidate,
    errors: formatValidationErrors(result.errors)
  });
}

/**
 * Render the edit form for an existing Resident.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function showEditForm(req, res) {
  const { residentRepository } = req.app.locals.services;
  const residentId = Number(req.params.id);

  const resident = residentRepository.findById(residentId);

  if (!resident) {
    return res.status(404).render("residents/not-found", {
      message: "Resident not found."
    });
  }

  return res.render("residents/edit", {
    resident,
    errors: []
  });
}

/**
 * Handle update submission for an existing Resident.
 * Reuses ResidentUpdateService (T06) and ResidentValidator (T02).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function updateResident(req, res) {
  const { residentUpdateService, residentRepository } = req.app.locals.services;
  const residentId = Number(req.params.id);
  const { firstName, lastName, address, contactNumber, email } = req.body;

  const result = residentUpdateService.updateResident(residentId, {
    firstName,
    lastName,
    address,
    contactNumber,
    email
  });

  if (result.notFound) {
    return res.status(404).render("residents/not-found", {
      message: "Resident not found."
    });
  }

  if (!result.success) {
    const existing = residentRepository.findById(residentId);
    const preservedResident = {
      id: residentId,
      firstName,
      lastName,
      address,
      contactNumber,
      email,
      status: existing ? existing.status : "Active"
    };

    return res.status(400).render("residents/edit", {
      resident: preservedResident,
      errors: formatValidationErrors(result.errors)
    });
  }

  return res.redirect(
    "/residents?message=" + encodeURIComponent("Resident information updated successfully.")
  );
}

/**
 * Handle deactivation of an Active Resident.
 * Reuses ResidentDeactivationService (T07).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function deactivateResident(req, res) {
  const { residentDeactivationService } = req.app.locals.services;
  const residentId = Number(req.params.id);

  const result = residentDeactivationService.deactivateResident(residentId);

  if (result.notFound) {
    return res.status(404).render("residents/not-found", {
      message: "Resident not found."
    });
  }

  return res.redirect(
    "/residents?message=" + encodeURIComponent("Resident deactivated successfully.")
  );
}
