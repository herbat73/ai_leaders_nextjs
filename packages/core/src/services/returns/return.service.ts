import { NotFoundError, ValidationError } from "../../errors";
import {
  RETURN_STATUSES,
  type NewReturnRequest,
  type ReturnRepository,
  type ReturnRequest,
  type ReturnStatus,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const orderNumber = input.orderNumber?.trim() ?? "";
    const customerEmail = input.customerEmail?.trim() ?? "";
    const reason = input.reason?.trim() ?? "";

    const fields: Record<string, string> = {};
    if (!orderNumber) fields.orderNumber = "Order number is required";
    if (!EMAIL_PATTERN.test(customerEmail)) fields.customerEmail = "A valid email is required";
    if (!reason) fields.reason = "Please tell us why you are returning the item";
    if (Object.keys(fields).length > 0) {
      throw new ValidationError("Invalid return request", fields);
    }

    return this.returnRepository.create({ orderNumber, customerEmail, reason });
  }

  async updateStatus(id: number, status: ReturnStatus): Promise<ReturnRequest> {
    if (!isReturnStatus(status)) {
      throw new ValidationError("Invalid status", { status: "Unknown status" });
    }
    const updated = await this.returnRepository.updateStatus(id, status);
    if (!updated) throw new NotFoundError(`Return ${id} not found`);
    return updated;
  }
}
