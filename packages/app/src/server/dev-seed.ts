/**
 * Dev-environment seed data (issue #156): two suppliers and one initial administrator, so a fresh checkout can try the
 * supplier-claim flow without inviting an agent and adding vendors by hand. The data is public on purpose (it is in the
 * repository), which is why this file must only ever seed a local development database: `seedDevData` refuses when
 * `NODE_ENV` is `production`, and `npm run setup` seeds only the default local database.
 *
 * Idempotent and non-destructive: an existing supplier (same name, case-insensitive) or agent (same e-mail, any status)
 * is left exactly as it is, so a rerun never resets a password a developer changed or re-enables a disabled account.
 * No `server-only` import and no container: `scripts/seed-dev.ts` passes in the services, tests pass in fakes.
 */
import {
  hashInviteToken,
  type AgentInviteInput,
  type AgentRepository,
  type InviteOutcome,
  type NewSupplier,
  type PasswordHasher,
  type Supplier,
} from "@easyrms/core";

export const DEV_SEED_SUPPLIERS: readonly NewSupplier[] = [
  { name: "First Supplier", email: "firstsupplier@example.com", guidelines: null },
  { name: "Another Supplier", email: "anothersupplier@example.com", guidelines: null },
];

/** The password is the one the issue asks for (12 characters, the policy minimum). Development databases only. */
export const DEV_SEED_ADMIN = {
  email: "admin@example.com",
  displayName: "Dev Admin",
  password: "123412341234",
  permissions: ["MANAGE_RULES"],
} as const satisfies AgentInviteInput & { password: string };

export interface DevSeedDeps {
  supplierService: { list(): Promise<Supplier[]>; create(input: NewSupplier): Promise<Supplier> };
  agentService: { invite(input: AgentInviteInput): Promise<InviteOutcome> };
  agentRepository: Pick<AgentRepository, "findCredentialsByEmail" | "consumeInvite">;
  passwordHasher: PasswordHasher;
  clock: () => Date;
  nodeEnv: string | undefined;
}

export interface DevSeedResult {
  suppliersCreated: string[];
  suppliersKept: string[];
  adminCreated: boolean;
}

/** Thrown when the seeder is pointed at a production process; never caught by the seeder itself. */
export class DevSeedRefusedError extends Error {
  constructor() {
    super("Refusing to seed: NODE_ENV is production. The dev seed data has a public password and is for local development only.");
    this.name = "DevSeedRefusedError";
  }
}

export async function seedDevData(deps: DevSeedDeps): Promise<DevSeedResult> {
  if (deps.nodeEnv === "production") throw new DevSeedRefusedError();

  const result: DevSeedResult = { suppliersCreated: [], suppliersKept: [], adminCreated: false };

  const existingNames = new Set((await deps.supplierService.list()).map((supplier) => supplier.name.toLowerCase()));
  for (const supplier of DEV_SEED_SUPPLIERS) {
    if (existingNames.has(supplier.name.toLowerCase())) {
      result.suppliersKept.push(supplier.name);
      continue;
    }
    await deps.supplierService.create(supplier);
    result.suppliersCreated.push(supplier.name);
  }

  if (!(await deps.agentRepository.findCredentialsByEmail(DEV_SEED_ADMIN.email))) {
    const { inviteToken } = await deps.agentService.invite({
      email: DEV_SEED_ADMIN.email,
      displayName: DEV_SEED_ADMIN.displayName,
      permissions: [...DEV_SEED_ADMIN.permissions],
    });
    // The same two calls as `AgentService.acceptInvite`, minus the session and the per-IP throttle a script has no use
    // for: the invite is consumed at once, so the token never leaves this function and the password is hashed by the
    // production hasher.
    const passwordHash = await deps.passwordHasher.hash(DEV_SEED_ADMIN.password);
    const accepted = await deps.agentRepository.consumeInvite(hashInviteToken(inviteToken), passwordHash, deps.clock());
    if (!accepted) throw new Error("The dev admin invite could not be accepted (it expired or was used already).");
    result.adminCreated = true;
  }

  return result;
}
