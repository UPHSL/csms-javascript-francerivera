import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { notFound } from "./middleware/notFound.js";
import mainRoutes from "./routes/index.js";
import { createDatabaseConnection } from "./database/db.js";
import { ResidentRepository } from "./repositories/ResidentRepository.js";
import { ResidentValidator } from "./services/ResidentValidator.js";
import { ResidentSearchService } from "./services/ResidentSearchService.js";
import { ResidentRegistrationService } from "./services/ResidentRegistrationService.js";
import { ResidentUpdateService } from "./services/ResidentUpdateService.js";
import { ResidentDeactivationService } from "./services/ResidentDeactivationService.js";
import { ServiceRequestRepository } from "./repositories/ServiceRequestRepository.js";
import { ServiceRequestValidator } from "./validators/ServiceRequestValidator.js";
import { ServiceRequestSubmissionService } from "./services/ServiceRequestSubmissionService.js";
import { ServiceRequestStatusService } from "./services/ServiceRequestStatusService.js";
import { ServiceRequestQueryService } from "./services/ServiceRequestQueryService.js";
import { DashboardService } from "./services/DashboardService.js";
import { applicationConfig } from "./config/application.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

/**
 * Create and configure the CSMS Express application.
 *
 * @param {object} [options] Optional dependencies and configuration
 * @returns {import("express").Express} Configured Express application.
 */
export function createApp(options = {}) {
  const app = express();

  app.disable("x-powered-by");

  app.set("views", path.join(currentDirectory, "views"));
  app.set("view engine", "ejs");

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(currentDirectory, "..", "public")));

  const db = options.db || createDatabaseConnection(options.dbPath || null);
  const residentRepository = options.residentRepository || new ResidentRepository(db);
  const residentValidator = options.residentValidator || new ResidentValidator();
  const residentSearchService =
    options.residentSearchService || new ResidentSearchService(residentRepository);
  const residentRegistrationService =
    options.residentRegistrationService ||
    new ResidentRegistrationService(residentValidator, residentRepository);
  const residentUpdateService =
    options.residentUpdateService ||
    new ResidentUpdateService(residentValidator, residentRepository);
  const residentDeactivationService =
    options.residentDeactivationService ||
    new ResidentDeactivationService(residentRepository);

  const serviceRequestRepository =
    options.serviceRequestRepository || new ServiceRequestRepository(db);
  const serviceRequestValidator =
    options.serviceRequestValidator || new ServiceRequestValidator();
  const serviceRequestSubmissionService =
    options.serviceRequestSubmissionService ||
    new ServiceRequestSubmissionService(
      serviceRequestValidator,
      serviceRequestRepository,
      residentRepository
    );
  const serviceRequestStatusService =
    options.serviceRequestStatusService ||
    new ServiceRequestStatusService(serviceRequestRepository);
  const serviceRequestQueryService =
    options.serviceRequestQueryService ||
    new ServiceRequestQueryService(serviceRequestRepository);

  const dashboardService =
    options.dashboardService ||
    new DashboardService(residentRepository, serviceRequestRepository);

  app.locals.services = {
    db,
    residentRepository,
    residentValidator,
    residentSearchService,
    residentRegistrationService,
    residentUpdateService,
    residentDeactivationService,
    serviceRequestRepository,
    serviceRequestValidator,
    serviceRequestSubmissionService,
    serviceRequestStatusService,
    serviceRequestQueryService,
    dashboardService,
    ...(options.services || {})
  };

  app.locals.applicationVersion = applicationConfig.version;
  app.locals.applicationName = applicationConfig.name;
  app.locals.shortName = applicationConfig.shortName;

  app.use(mainRoutes);

  app.use(notFound);

  // Global defensive error handler: prevents raw internal stack trace leaks
  app.use((err, req, res, _next) => {
    if (res.headersSent) {
      return _next(err);
    }
    const statusCode = err.status || err.statusCode || 500;
    if (req.accepts("html")) {
      return res.status(statusCode).render("residents/not-found", {
        message: "An internal server error occurred."
      });
    }
    return res.status(statusCode).json({
      status: "error",
      message: "An internal server error occurred"
    });
  });

  return app;
}
