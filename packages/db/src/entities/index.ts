import { AgentSchema } from "./agents/agent.entity";
import { ReturnRequestSchema } from "./returns/return-request.entity";
import { ReturnRequestItemSchema } from "./returns/return-request-item.entity";
import { ReturnRequestEventSchema } from "./returns/return-request-event.entity";
import { SupplierClaimSchema } from "./supplier-claims/supplier-claim.entity";
import { SupplierClaimEventSchema } from "./supplier-claims/supplier-claim-event.entity";
import { SupplierSchema } from "./suppliers/supplier.entity";

export * from "./agents/agent.entity";
export * from "./returns/return-request.entity";
export * from "./returns/return-request-event.entity";

export * from "./returns/return-request-item.entity";
export * from "./supplier-claims/supplier-claim.entity";
export * from "./supplier-claims/supplier-claim-event.entity";
export * from "./suppliers/supplier.entity";

export const entities = [AgentSchema, ReturnRequestSchema, ReturnRequestEventSchema, ReturnRequestItemSchema, SupplierSchema, SupplierClaimSchema, SupplierClaimEventSchema];
