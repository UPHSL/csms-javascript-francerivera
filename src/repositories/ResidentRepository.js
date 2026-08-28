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