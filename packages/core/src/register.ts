import { asClass, asValue, type AwilixContainer } from "awilix";

import { ReturnService } from "./services/returns/return.service";

/** Registers core services. Dependencies (ports) are registered by other packages. */
export function registerCore(container: AwilixContainer): void {
  container.register({
    clock: asValue((): Date => new Date()),
    returnService: asClass(ReturnService).scoped(),
  });
}
