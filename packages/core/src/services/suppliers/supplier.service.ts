import { NotFoundError } from "../../errors";
import type { NewSupplier, Supplier, SupplierChanges, SupplierRepository } from "./types";

export class SupplierService {
  private readonly supplierRepository: SupplierRepository;

  constructor(deps: { supplierRepository: SupplierRepository }) {
    this.supplierRepository = deps.supplierRepository;
  }

  list(): Promise<Supplier[]> {
    return this.supplierRepository.list();
  }

  async get(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepository.findById(id);
    if (!supplier) throw new NotFoundError(`Supplier ${id} not found`);
    return supplier;
  }

  create(input: NewSupplier): Promise<Supplier> {
    return this.supplierRepository.create(input);
  }

  async update(id: number, changes: SupplierChanges): Promise<Supplier> {
    const supplier = await this.supplierRepository.update(id, changes);
    if (!supplier) throw new NotFoundError(`Supplier ${id} not found`);
    return supplier;
  }
}
