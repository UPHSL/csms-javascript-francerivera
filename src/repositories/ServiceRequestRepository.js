import { ServiceRequest } from "../models/ServiceRequest.js";
import { createDatabaseConnection } from "../database/db.js";

export class ServiceRequestRepository {
  constructor(db = null) {
    this.db = db || createDatabaseConnection();
  }

  save(serviceRequest) {
    const insertStmt = this.db.prepare(`
      INSERT INTO service_requests (resident_id, service_type, description, date_requested, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      serviceRequest.residentId,
      serviceRequest.serviceType,
      serviceRequest.description,
      serviceRequest.dateRequested,
      serviceRequest.status
    );

    serviceRequest.id = Number(result.lastInsertRowid);
    return serviceRequest;
  }

  findById(serviceRequestId) {
    const selectStmt = this.db.prepare(`
      SELECT id, resident_id, service_type, description, date_requested, status
      FROM service_requests
      WHERE id = ?
    `);

    const row = selectStmt.get(serviceRequestId);

    if (!row) {
      return null;
    }

    return this.mapRowToServiceRequest(row);
  }

  count() {
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM service_requests`);
    const row = countStmt.get();
    return Number(row.total);
  }

  mapRowToServiceRequest(row) {
    return new ServiceRequest({
      id: Number(row.id),
      residentId: Number(row.resident_id),
      serviceType: row.service_type,
      description: row.description,
      dateRequested: row.date_requested,
      status: row.status
    });
  }

  close() {
    if (this.db && typeof this.db.close === "function") {
      this.db.close();
    }
  }
}
