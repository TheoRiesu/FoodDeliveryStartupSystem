/**
 * Shared abstract entity. Demonstrates ABSTRACTION: cannot be instantiated
 * directly; concrete domain classes inherit id/createdAt handling from here.
 */
export class BaseEntity {
  /** @type {number|null} */
  id;
  /** @type {string|null} */
  createdAt;

  constructor(id = null, createdAt = null) {
    if (new.target === BaseEntity) {
      throw new Error("BaseEntity is abstract and cannot be instantiated directly.");
    }
    this.id = id;
    this.createdAt = createdAt;
  }

  toJSON() {
    return { id: this.id, createdAt: this.createdAt };
  }
}
