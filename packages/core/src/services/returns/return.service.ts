import { dueAt, overdue } from "../../calendar";
import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { checkDecisionNote } from "./decision-note";
import { returnStateMachine } from "./transitions";
import {
  RETURN_STATUSES,
  type NewReturnRequest,
  type ReturnDetailView,
  type ReturnListFilter,
  type ReturnListItem,
  type ReturnRepository,
  type ReturnRequest,
  type ReturnStatus,
  type StoredReturnStatus,
} from "./types";

export function isReturnStatus(value: unknown): value is ReturnStatus {
  return (RETURN_STATUSES as readonly unknown[]).includes(value);
}

/** Maps a stored value to a known status, or `"unknown"` for anything else (never falls back to a workable status). */
export function toReturnStatus(value: unknown): StoredReturnStatus {
  return isReturnStatus(value) ? value : "unknown";
}

export class ReturnService {
  private readonly returnRepository: ReturnRepository;
  private readonly clock: () => Date;

  constructor({ returnRepository, clock }: { returnRepository: ReturnRepository; clock: () => Date }) {
    this.returnRepository = returnRepository;
    this.clock = clock;
  }

  async list(filter?: ReturnListFilter): Promise<ReturnListItem[]> {
    const now = this.clock();
    const rows = await this.returnRepository.list(filter);
    return rows.map((row) => this.toListItem(row, now));
  }

  create(input: NewReturnRequest): Promise<ReturnRequest> {
    return this.returnRepository.create(input);
  }

  async getDetail(id: number): Promise<ReturnDetailView> {
    const detail = await this.returnRepository.findDetail(id);
    if (!detail) throw new NotFoundError(`Return ${id} not found`);
    return { ...detail, request: this.toListItem(detail.request, this.clock()) };
  }

  /**
   * Moves a request along the state machine. Checks run in the order the API documents: note rules (400), existence
   * (404), allowed move (409); the repository's compare-and-set then settles a race between two agents (409).
   */
  async transition(id: number, status: ReturnStatus, decisionNote?: string): Promise<ReturnListItem> {
    const check = checkDecisionNote(status, decisionNote);
    if (!check.ok) throw new ValidationError("Invalid input", { decisionNote: check.message });

    const current = await this.returnRepository.findStatus(id);
    if (current === null) throw new NotFoundError(`Return ${id} not found`);
    returnStateMachine.assert(current, status);
    // `assert` only passes for a known status, so `current` is one of the nine here.
    const from = current as ReturnStatus;

    const outcome = await this.returnRepository.transition(id, from, status, check.note);
    switch (outcome.result) {
      case "moved":
        return this.toListItem(outcome.request, this.clock());
      case "conflict":
        throw new ConflictError(`Return ${id} is now ${outcome.currentStatus}`, { status: outcome.currentStatus });
      case "not_found":
        throw new NotFoundError(`Return ${id} not found`);
    }
  }

  private toListItem(request: ReturnRequest, now: Date): ReturnListItem {
    const due = dueAt(request.createdAt);
    return {
      ...request,
      dueAt: due,
      overdue: overdue(request.status, due, now),
      allowedTransitions: [...returnStateMachine.allowed(request.status)],
    };
  }
}
