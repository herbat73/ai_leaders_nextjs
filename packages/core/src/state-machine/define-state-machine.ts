import { ConflictError } from "../errors";

export interface StateMachineDefinition<TStatus extends string> {
  /** Every move that is allowed, keyed by the status it starts from. A missing key means a terminal status. */
  transitions: Readonly<Partial<Record<TStatus, readonly TStatus[]>>>;
}

export interface StateMachine<TStatus extends string> {
  /** Whether `from → to` is an allowed move. Accepts any string so callers can pass unvalidated stored values. */
  can(from: string, to: string): boolean;
  /** Throws `ConflictError` when `from → to` is not allowed. */
  assert(from: string, to: TStatus): void;
  /** Asserts the move and returns the new status. */
  next(from: string, to: TStatus): TStatus;
  /** The statuses reachable from `status`; empty for a terminal or unknown status. */
  allowed(status: string): readonly TStatus[];
}

const NONE: readonly never[] = [];

export function defineStateMachine<TStatus extends string>({
  transitions,
}: StateMachineDefinition<TStatus>): StateMachine<TStatus> {
  const table = new Map<string, readonly TStatus[]>(Object.entries(transitions) as [string, readonly TStatus[]][]);

  const allowed = (status: string): readonly TStatus[] => table.get(status) ?? NONE;
  const can = (from: string, to: string): boolean => allowed(from).some((candidate) => candidate === to);

  const assert = (from: string, to: TStatus): void => {
    if (!can(from, to)) throw new ConflictError(`Cannot move from ${from} to ${to}`, { status: from });
  };

  return {
    can,
    assert,
    allowed,
    next(from, to) {
      assert(from, to);
      return to;
    },
  };
}
