import { ReturnRequestSchema } from "./returns/return-request.entity";
import { ReturnRequestItemSchema } from "./returns/return-request-item.entity";
import { ReturnRequestEventSchema } from "./returns/return-request-event.entity";

export * from "./returns/return-request.entity";
export * from "./returns/return-request-event.entity";

export * from "./returns/return-request-item.entity";

export const entities = [ReturnRequestSchema, ReturnRequestEventSchema, ReturnRequestItemSchema];
