export const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export interface ReturnRequest {
  id: number;
  orderNumber: string;
  customerEmail: string;
  reason: string;
  status: ReturnStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewReturnRequest {
  orderNumber: string;
  customerEmail: string;
  reason: string;
}

/** Port implemented by `@easyrms/db`. */
export interface ReturnRepository {
  list(): Promise<ReturnRequest[]>;
  findById(id: number): Promise<ReturnRequest | null>;
  create(input: NewReturnRequest): Promise<ReturnRequest>;
  updateStatus(id: number, status: ReturnStatus): Promise<ReturnRequest | null>;
}
