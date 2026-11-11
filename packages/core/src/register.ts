import { asClass, asValue, type AwilixContainer } from "awilix";

import { AgentService } from "./services/agents/agent.service";
import { CaseSampleService } from "./services/discovery/case-sample.service";
import { EvidenceService } from "./services/evidence/evidence.service";
import { RetentionService } from "./services/retention/retention.service";
import { ReturnLookupService } from "./services/returns/return-lookup.service";
import { ReturnService } from "./services/returns/return.service";
import { RulesService } from "./services/rules/rules.service";
import { SupplierClaimService } from "./services/supplier-claims/supplier-claim.service";
import { SupplierService } from "./services/suppliers/supplier.service";

/** Registers core services. Dependencies (ports) are registered by other packages. */
export function registerCore(container: AwilixContainer): void {
  container.register({
    clock: asValue((): Date => new Date()),
    caseSampleService: asClass(CaseSampleService).singleton(),
    agentService: asClass(AgentService).scoped(),
    evidenceService: asClass(EvidenceService).scoped(),
    retentionService: asClass(RetentionService).scoped(),
    returnService: asClass(ReturnService).scoped(),
    returnLookupService: asClass(ReturnLookupService).scoped(),
    rulesService: asClass(RulesService).scoped(),
    supplierService: asClass(SupplierService).scoped(),
    supplierClaimService: asClass(SupplierClaimService).scoped(),
  });
}
