"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { agentInviteSchema, type AgentRecord } from "@easyrms/core";
import {
  apiCall,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ErrorMessage,
  Input,
  Label,
  type DataTableColumn,
} from "@easyrms/ui/admin";

import { agentsCopy as copy } from "./copy";

const NAME_MAX = 100;
const statusVariant = { invited: "warning", active: "success", disabled: "secondary" } as const;

interface InviteResult {
  displayName: string;
  token: string;
}

function InviteDialog(): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  function changeOpen(next: boolean): void {
    setOpen(next);
    if (!next) {
      // The token is gone for good once the dialog closes; refresh so the list shows the new or re-invited agent.
      setErrors({});
      setResult(null);
      setCopyState("idle");
      router.refresh();
    }
  }

  function validate(email: string, displayName: string): Record<string, string> {
    const found: Record<string, string> = {};
    if (!email.trim()) found.email = copy.invite.emailRequired;
    else if (!agentInviteSchema.safeParse({ email, displayName: "x", permissions: [] }).success) found.email = copy.invite.emailInvalid;
    if (!displayName.trim()) found.displayName = copy.invite.nameRequired;
    else if (displayName.trim().length > NAME_MAX) found.displayName = copy.invite.nameTooLong(NAME_MAX);
    return found;
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const displayName = String(data.get("displayName") ?? "");
    const manages = data.get("manages") === "on";
    const clientErrors = validate(email, displayName);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    setPending(true);
    const response = await apiCall<{ agent: AgentRecord; inviteToken: string }>("/api/agents", {
      method: "POST",
      body: { email, displayName, permissions: manages ? ["MANAGE_RULES"] : [] },
    });
    setPending(false);
    if (!response.ok) {
      setErrors({
        form:
          response.status === 409
            ? copy.invite.alreadyActive
            : response.status === 403
              ? copy.invite.forbidden
              : copy.invite.genericError,
      });
      return;
    }
    setErrors({});
    setResult({ displayName: response.data.agent.displayName, token: response.data.inviteToken });
  }

  const link = result ? `${window.location.origin}/admin/invite/${result.token}` : "";

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button>{copy.invite.open}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={copy.invite.close}>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{copy.invite.resultTitle}</DialogTitle>
              <DialogDescription>{copy.invite.resultDescription(result.displayName)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="invite-link">{copy.invite.linkLabel}</Label>
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
                <Button type="button" variant="outline" className="shrink-0 whitespace-nowrap" onClick={copyLink}>
                  {copyState === "copied" ? copy.invite.copied : copy.invite.copy}
                </Button>
              </div>
              {copyState === "failed" && <ErrorMessage message={copy.invite.copyFailed} />}
            </div>
            <Alert variant="warning">
              <AlertTitle>{copy.invite.shownOnceTitle}</AlertTitle>
              <AlertDescription>{copy.invite.shownOnce}</AlertDescription>
            </Alert>
            <DialogFooter>
              <DialogClose asChild>
                <Button>{copy.invite.close}</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>{copy.invite.title}</DialogTitle>
              <DialogDescription>{copy.invite.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="invite-email">{copy.invite.email}</Label>
              <Input id="invite-email" name="email" type="email" autoComplete="off" />
              {errors.email && <ErrorMessage message={errors.email} />}
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-name">{copy.invite.displayName}</Label>
              <Input id="invite-name" name="displayName" autoComplete="off" />
              {errors.displayName && <ErrorMessage message={errors.displayName} />}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="invite-manages" name="manages" />
              <Label htmlFor="invite-manages">{copy.invite.manages}</Label>
            </div>
            {errors.form && <ErrorMessage message={errors.form} />}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {copy.invite.cancel}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? copy.invite.pending : copy.invite.submit}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DisableDialog({ agent }: { agent: AgentRecord }): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disable(): Promise<void> {
    setPending(true);
    setError(null);
    const response = await apiCall(`/api/agents/${agent.id}`, { method: "PATCH", body: { status: "disabled" } });
    setPending(false);
    if (!response.ok) {
      setError(
        response.error.code === "last_manager"
          ? copy.disable.lastManagerConflict
          : response.error.code === "self_disable"
            ? copy.disable.selfConflict
            : response.status === 403
              ? copy.disable.forbidden
              : copy.disable.genericError,
      );
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {copy.disable.action}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={copy.invite.close}>
        <DialogHeader>
          <DialogTitle>{copy.disable.title(agent.displayName)}</DialogTitle>
          <DialogDescription>{copy.disable.description}</DialogDescription>
        </DialogHeader>
        {error && <ErrorMessage message={error} />}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {copy.disable.cancel}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={disable}>
            {pending ? copy.disable.pending : copy.disable.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Client island of the agents screen: the table, the invite dialog (one-time link) and the disable confirmation. */
export function AgentsManager({ agents, currentAgentId }: { agents: AgentRecord[]; currentAgentId: number }): ReactElement {
  const activeManagers = agents.filter((agent) => agent.status === "active" && agent.permissions.includes("MANAGE_RULES"));

  const columns: DataTableColumn<AgentRecord>[] = [
    {
      key: "name",
      header: copy.columns.name,
      className: "font-medium",
      cell: (agent) => (
        <>
          {agent.displayName}
          {agent.id === currentAgentId && <span className="ml-2 text-xs text-muted-foreground">({copy.you})</span>}
        </>
      ),
    },
    { key: "email", header: copy.columns.email, cell: (agent) => agent.email },
    {
      key: "status",
      header: copy.columns.status,
      cell: (agent) => <Badge variant={statusVariant[agent.status]}>{copy.statusLabels[agent.status]}</Badge>,
    },
    {
      key: "permissions",
      header: copy.columns.permissions,
      cell: (agent) => (agent.permissions.includes("MANAGE_RULES") ? copy.manager : copy.noPermissions),
    },
    {
      key: "actions",
      header: copy.columns.actions,
      cell: (agent) => {
        if (agent.status === "disabled" || agent.id === currentAgentId) return null;
        const isLastManager = activeManagers.length <= 1 && activeManagers.some((manager) => manager.id === agent.id);
        if (isLastManager) {
          return (
            <span className="flex flex-col items-start gap-1">
              <Button size="sm" variant="outline" disabled aria-describedby={`last-manager-${agent.id}`}>
                {copy.disable.action}
              </Button>
              <span id={`last-manager-${agent.id}`} className="text-xs text-muted-foreground">
                {copy.disable.lastManager}
              </span>
            </span>
          );
        }
        return <DisableDialog agent={agent} />;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InviteDialog />
      </div>
      <DataTable columns={columns} rows={agents} getRowKey={(agent) => agent.id} caption={copy.caption} emptyMessage={copy.empty} />
    </div>
  );
}
