import { ReturnRequestSchema } from "./returns/return-request.entity";
import { ReturnRequestEventSchema } from "./returns/return-request-event.entity";

export * from "./returns/return-request.entity";
export * from "./returns/return-request-event.entity";

export const entities = [ReturnRequestSchema, ReturnRequestEventSchema];
