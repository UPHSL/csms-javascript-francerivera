# Preliminary Examination Developer Checkpoint (T03)

## Developer Information
- **Name:** France Raphael Rivera
- **GitHub Username:** francerivera
- **Primary Technology Stack:** JavaScript with Express.js
- **T03 Branch:** feature/t03-resident-persistence

---

## My T03 Implementation
In our CSMS JavaScript application, Resident data is stored in a file-backed SQLite database located at `data/csms.db`. Resident persistence is handled by the `ResidentRepository` class in `src/repositories/ResidentRepository.js` using Node.js built-in `node:sqlite` (`DatabaseSync`). When a Resident is saved via `save(resident)`, a parameterized SQL `INSERT` statement executes against SQLite. SQLite generates an autoincrement integer identifier (`lastInsertRowid`), which is assigned to `resident.id`. To retrieve a Resident, `findById(residentId)` prepares a parameterized `SELECT` statement querying the `residents` table by ID. If found, the database row is mapped back into an instance of the `Resident` domain model; if no matching record exists, `findById()` safely returns `null`.

---

## My Persistence Design Decision
- **What I Decided:** I decided to use Node.js built-in `DatabaseSync` from `node:sqlite` directly rather than an external ORM like Sequelize or Prisma.
- **Why I Implemented It That Way:** Using `node:sqlite` directly ensures a zero-dependency, lightweight, native persistence layer that satisfies the examination requirement of working directly with SQL statements and database connections.
- **Alternatives Considered:** I considered using an in-memory array or in-memory SQLite database, but rejected those because T03 explicitly requires file-backed persistence that survives distinct repository and connection instances.

---

## My Database Initialization Design
- **Database Initialization File/Module:** `src/database/db.js`
- **Where the Database Path Comes From:** `createDatabaseConnection(dbPath)` accepts a custom `dbPath` parameter (used by automated tests for path isolation) or defaults to `data/csms.db`.
- **How the Resident Table Is Initialized:** Using `db.exec()` with a `CREATE TABLE IF NOT EXISTS residents` SQL DDL statement.
- **How Repeated Initialization Is Handled:** The `IF NOT EXISTS` clause guarantees that calling initialization multiple times on application startup or across test runs will never crash the system, duplicate tables, or wipe existing records.

---

## Files I Changed
1. **File:** `src/database/db.js`  
   **Purpose:** Establishes the SQLite database connection, manages directory creation, and safely initializes the `residents` table schema.
2. **File:** `src/repositories/ResidentRepository.js`  
   **Purpose:** Implemented the repository layer containing `save(resident)` and `findById(residentId)` parameterized SQL operations and SQLite row-to-model mapping.
3. **File:** `test/residentRepository.test.js`  
   **Purpose:** Automated persistence tests covering all 7 required T03 scenarios and 1 student-designed test using isolated temporary SQLite files.
4. **File:** `.gitignore`  
   **Purpose:** Added `*.db`, `*.sqlite`, `*.sqlite3`, and `data/` ignore rules to prevent runtime database files from being committed to Git.

---

## SQL I Can Explain
```sql
INSERT INTO residents (first_name, last_name, address, contact_number, email, status)
VALUES (?, ?, ?, ?, ?, ?);
```
- **What the statement does:** Inserts a new resident record into the `residents` table in SQLite.
- **What each parameter represents:** The 6 positional `?` placeholders represent `firstName`, `lastName`, `address`, `contactNumber`, `email`, and `status`. Using `?` placeholders prevents SQL injection vulnerabilities.
- **Which repository operation uses it:** Used by `ResidentRepository.save(resident)`.

---

## My Resident Mapping
When `findById(residentId)` executes `SELECT * FROM residents WHERE id = ?`, SQLite returns a database row object containing snake_case column names (`first_name`, `last_name`, `contact_number`). I reconstruct the domain model by mapping snake_case database columns to camelCase JavaScript properties:
```javascript
return new Resident({
  id: Number(row.id),
  firstName: row.first_name,
  lastName: row.last_name,
  address: row.address,
  contactNumber: String(row.contact_number),
  email: row.email,
  status: row.status
});
```
This guarantees that `contactNumber` remains a string with its leading zero preserved, and the returned object is a true instance of `Resident`.

---

## Problem I Encountered
- **Problem or Error:** In `Test 7: Persistence Is Not Limited to One Repository Object`, attempting to instantiate a second `ResidentRepository` instance on the same test database file resulted in a SQLite file locking error (`EBUSY: resource locked`).
- **Cause:** The first `ResidentRepository` connection was left open while the second repository connection attempted to write and read from the same database file.
- **How I Resolved It:** Added a `close()` method to `ResidentRepository` and explicitly closed `repo1.close()` before opening `repo2`, ensuring clean file locks across distinct repository connections.

---

## My Student-Designed Test
- **Test Name:** `Student-Designed Test: Multiple Residents Distinct Retrieval`
- **What It Verifies:** Verifies that storing multiple distinct `Resident` objects sequentially assigns unique autoincrement IDs (`1`, `2`, etc.) and that querying each ID retrieves its own unique resident without data corruption or overwriting.
- **Why I Chose This Scenario:** To prove that SQLite autoincrement identity assignment works reliably for multiple records and that `findById()` retrieves the exact matching record rather than returning the first row in the table.

---

## Tools and References Used
- **Node.js Official Documentation**: Node.js v24 `node:sqlite` (`DatabaseSync`, `prepare()`, `run()`, `get()`).
- **SQLite SQL Reference**: SQL syntax for `CREATE TABLE IF NOT EXISTS`, `INSERT INTO`, `SELECT`.
- **Git & GitHub Classroom**: Feature branches, Pull Requests, and Git workflow.
- **IDE & Testing Tools**: VS Code, Git Bash, and Node.js built-in Test Runner (`node:test`).
