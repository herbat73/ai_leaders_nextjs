import { asClass, type AwilixContainer } from "awilix";

import { ReturnService } from "./returns/return-service";

/** Registers core services. Dependencies (ports) are registered by other packages. */
export function registerCore(container: AwilixContainer): void {
  container.register({
    returnService: asClass(ReturnService).scoped(),
  });
}
