import { applicationConfig } from "../config/application.js";

/**
 * Return the application health response.
 *
 * @param {import("express").Request} request Express request.
 * @param {import("express").Response} response Express response.
 */
export function showHealth(request, response) {
  response.status(200).json({
    status: "ok",
    application: applicationConfig.name,
    version: applicationConfig.version
  });
}