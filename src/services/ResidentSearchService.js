export class ResidentSearchService {
  constructor(repository) {
    this.repository = repository;
  }

  listResidents() {
    return this.repository.findAll();
  }

  searchResidents(searchTerm) {
    const normalizedTerm = (searchTerm || "").trim();

    if (normalizedTerm.length === 0) {
      return this.listResidents();
    }

    return this.repository.searchByName(normalizedTerm);
  }
}
