import { asClass, asValue, type AwilixContainer } from "awilix";

import { AgentService } from "./services/agents/agent.service";
import { CaseSampleService } from "./services/discovery/case-sample.service";
import { ReturnLookupService } from "./services/returns/return-lookup.service";
import { ReturnService } from "./services/returns/return.service";
import { SupplierService } from "./services/suppliers/supplier.service";

/** Registers core services. Dependencies (ports) are registered by other packages. */
export function registerCore(container: AwilixContainer): void {
  container.register({
    clock: asValue((): Date => new Date()),
    caseSampleService: asClass(CaseSampleService).singleton(),
    agentService: asClass(AgentService).scoped(),
    returnService: asClass(ReturnService).scoped(),
    returnLookupService: asClass(ReturnLookupService).scoped(),
    supplierService: asClass(SupplierService).scoped(),
  });
}
