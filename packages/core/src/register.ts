import { asClass, asValue, type AwilixContainer } from "awilix";

import { CaseSampleService } from "./services/discovery/case-sample.service";
import { ReturnLookupService } from "./services/returns/return-lookup.service";
import { ReturnService } from "./services/returns/return.service";

/** Registers core services. Dependencies (ports) are registered by other packages. */
export function registerCore(container: AwilixContainer): void {
  container.register({
    clock: asValue((): Date => new Date()),
    caseSampleService: asClass(CaseSampleService).singleton(),
    returnService: asClass(ReturnService).scoped(),
    returnLookupService: asClass(ReturnLookupService).scoped(),
  });
}
