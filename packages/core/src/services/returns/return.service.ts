import { NotFoundError } from "../../errors";
import {
  RETURN_STATUSES,
  type NewReturnRequest,
  type ReturnRepository,
  type ReturnRequest,
  type ReturnStatus,
} from "./types";

export function isReturnStatus(value: unknown): value is ReturnStatus {
  return (RETURN_STATUSES as readonly unknown[]).includes(value);
}

export class ReturnService {
  private readonly returnRepository: ReturnRepository;

  constructor({ returnRepository }: { returnRepository: ReturnRepository }) {
    this.returnRepository = returnRepository;
  }

  list(): Promise<ReturnRequest[]> {
    return this.returnRepository.list();
  }

  create(input: NewReturnRequest): Promise<ReturnRequest> {
    return this.returnRepository.create(input);
  }

  async updateStatus(id: number, status: ReturnStatus): Promise<ReturnRequest> {
    const updated = await this.returnRepository.updateStatus(id, status);
    if (!updated) throw new NotFoundError(`Return ${id} not found`);
    return updated;
  }
}
