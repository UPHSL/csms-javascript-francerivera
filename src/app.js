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

  app.locals.services = {
    db,
    residentRepository,
    residentValidator,
    residentSearchService,
    residentRegistrationService,
    residentUpdateService,
    residentDeactivationService,
    ...(options.services || {})
  };

  app.use(mainRoutes);

  app.use(notFound);

  return app;
}