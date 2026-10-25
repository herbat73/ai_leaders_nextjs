/** A vendor that receives claims for defective products. Managed by agents; never deleted, only deactivated. */
export interface Supplier {
  id: number;
  name: string;
  /** Where claims are sent. Normalised (trimmed, lower-cased). */
  email: string;
  /** Free text the agent reads before sending a claim (e.g. "video required"); not checked automatically. */
  guidelines: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSupplier {
  name: string;
  email: string;
  guidelines: string | null;
}

export interface SupplierChanges {
  name?: string;
  email?: string;
  guidelines?: string | null;
  active?: boolean;
}

/** Port implemented by `@easyrms/db`. */
export interface SupplierRepository {
  /** Active suppliers first, then by name. */
  list(): Promise<Supplier[]>;
  findById(id: number): Promise<Supplier | null>;
  /** A duplicate name (case-insensitive) is a `ConflictError` (409 `supplier_exists`). */
  create(input: NewSupplier): Promise<Supplier>;
  /** `null` when the supplier does not exist. A duplicate name is a `ConflictError`. */
  update(id: number, changes: SupplierChanges): Promise<Supplier | null>;
}
