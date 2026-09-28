import { Resident } from "../models/Resident.js";
import { createDatabaseConnection } from "../database/db.js";

export class ResidentRepository {
  constructor(db = null) {
    this.db = db || createDatabaseConnection();
  }

  save(resident) {
    const insertStmt = this.db.prepare(`
      INSERT INTO residents (first_name, last_name, address, contact_number, email, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      resident.firstName,
      resident.lastName,
      resident.address,
      resident.contactNumber,
      resident.email,
      resident.status
    );

    resident.id = Number(result.lastInsertRowid);
    return resident;
  }

  update(resident) {
    const updateStmt = this.db.prepare(`
      UPDATE residents
      SET first_name = ?, last_name = ?, address = ?, contact_number = ?, email = ?, status = ?
      WHERE id = ?
    `);

    updateStmt.run(
      resident.firstName,
      resident.lastName,
      resident.address,
      resident.contactNumber,
      resident.email,
      resident.status,
      resident.id
    );

    return resident;
  }

  deactivateById(residentId) {
    const deactivateStmt = this.db.prepare(`
      UPDATE residents
      SET status = 'Inactive'
      WHERE id = ?
    `);

    deactivateStmt.run(residentId);
    return this.findById(residentId);
  }

  findById(residentId) {
    const selectStmt = this.db.prepare(`
      SELECT id, first_name, last_name, address, contact_number, email, status
      FROM residents
      WHERE id = ?
    `);

    const row = selectStmt.get(residentId);

    if (!row) {
      return null;
    }

    return this.mapRowToResident(row);
  }

  findAll() {
    const selectStmt = this.db.prepare(`
      SELECT id, first_name, last_name, address, contact_number, email, status
      FROM residents
      ORDER BY last_name ASC, first_name ASC, id ASC
    `);

    const rows = selectStmt.all();
    return rows.map((row) => this.mapRowToResident(row));
  }

  searchByName(searchTerm) {
    const normalizedTerm = (searchTerm || "").trim();

    if (normalizedTerm.length === 0) {
      return this.findAll();
    }

    const selectStmt = this.db.prepare(`
      SELECT id, first_name, last_name, address, contact_number, email, status
      FROM residents
      WHERE LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?
      ORDER BY last_name ASC, first_name ASC, id ASC
    `);

    const pattern = `%${normalizedTerm.toLowerCase()}%`;
    const rows = selectStmt.all(pattern, pattern);

    return rows.map((row) => this.mapRowToResident(row));
  }

  mapRowToResident(row) {
    return new Resident({
      id: Number(row.id),
      firstName: row.first_name,
      lastName: row.last_name,
      address: row.address,
      contactNumber: String(row.contact_number),
      email: row.email,
      status: row.status
    });
  }

  close() {
    if (this.db && typeof this.db.close === "function") {
      this.db.close();
    }
  }
}