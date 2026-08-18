/**
 * Resident domain-model representing a person registered within the community.
 * CSMS Ticket: T01 - Define the Resident Domain Model
 */
export class Resident {
  /**
   * @param {Object} data
   * @param {string|number|null} [data.id=null]
   * @param {string} [data.firstName=""]
   * @param {string} [data.lastName=""]
   * @param {string} [data.address=""]
   * @param {string} [data.contactNumber=""]
   * @param {string} [data.email=""]
   * @param {string} [data.status="Active"]
   */
  constructor({
    id = null,
    firstName = "",
    lastName = "",
    address = "",
    contactNumber = "",
    email = "",
    status = "Active"
  } = {}) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.address = address;
    this.contactNumber = contactNumber;
    this.email = email;
    this.status = status;
  }
}