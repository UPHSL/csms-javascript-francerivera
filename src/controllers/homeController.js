import { applicationConfig } from "../config/application.js";

/**
 * Render the CSMS starter page.
 *
 * @param {import("express").Request} request Express request.
 * @param {import("express").Response} response Express response.
 */
export function showHome(request, response) {
  response.status(200).render("index", {
    applicationName: applicationConfig.name,
    applicationVersion: applicationConfig.version,
    currentSprint: applicationConfig.currentSprint,
    technology: applicationConfig.technology
  });
}