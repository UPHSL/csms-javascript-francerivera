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

  updateStatus(serviceRequestId, newStatus) {
    const updateStmt = this.db.prepare(`
      UPDATE service_requests
      SET status = ?
      WHERE id = ?
    `);

    updateStmt.run(newStatus, serviceRequestId);
    return this.findById(serviceRequestId);
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

  findAll() {
    const selectStmt = this.db.prepare(`
      SELECT id, resident_id, service_type, description, date_requested, status
      FROM service_requests
      ORDER BY date_requested DESC, id DESC
    `);

    const rows = selectStmt.all();
    return rows.map((row) => this.mapRowToServiceRequest(row));
  }

  search(searchTerm, statusFilter) {
    let term = searchTerm;
    let status = statusFilter;
    if (typeof searchTerm === "object" && searchTerm !== null) {
      term = searchTerm.searchTerm;
      status = searchTerm.statusFilter;
    }

    const normalizedTerm = (term || "").trim();
    const normalizedStatus = (status || "").trim();

    if (normalizedTerm.length === 0 && normalizedStatus.length === 0) {
      return this.findAll();
    }

    const conditions = [];
    const params = [];

    if (normalizedTerm.length > 0) {
      conditions.push("(LOWER(service_type) LIKE ? OR LOWER(description) LIKE ?)");
      const pattern = `%${normalizedTerm.toLowerCase()}%`;
      params.push(pattern, pattern);
    }

    if (normalizedStatus.length > 0) {
      conditions.push("status = ?");
      params.push(normalizedStatus);
    }

    const query = `
      SELECT id, resident_id, service_type, description, date_requested, status
      FROM service_requests
      WHERE ${conditions.join(" AND ")}
      ORDER BY date_requested DESC, id DESC
    `;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map((row) => this.mapRowToServiceRequest(row));
  }

  searchByText(searchTerm) {
    return this.search(searchTerm, null);
  }

  findByStatus(status) {
    return this.search(null, status);
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
