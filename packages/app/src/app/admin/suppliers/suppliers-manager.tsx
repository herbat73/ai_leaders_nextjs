"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { supplierCreateSchema, type Supplier } from "@easyrms/core";
import {
  apiCall,
  Badge,
  Button,
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
  Textarea,
  type DataTableColumn,
} from "@easyrms/ui/admin";

import { suppliersCopy as copy } from "./copy";

function SupplierDialog({ supplier }: { supplier?: Supplier }): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      guidelines: String(data.get("guidelines") ?? ""),
    };
    const found: Record<string, string> = {};
    if (!body.name.trim()) found.name = copy.form.nameRequired;
    if (!supplierCreateSchema.safeParse({ ...body, name: body.name || "x" }).success) found.email = copy.form.emailInvalid;
    if (Object.keys(found).length > 0) return setErrors(found);

    setPending(true);
    const response = await apiCall(supplier ? `/api/suppliers/${supplier.id}` : "/api/suppliers", {
      method: supplier ? "PATCH" : "POST",
      body,
    });
    setPending(false);
    if (!response.ok) {
      return setErrors({
        form:
          response.status === 409
            ? copy.form.nameExists
            : response.status === 403
              ? copy.form.forbidden
              : copy.form.genericError,
      });
    }
    setErrors({});
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setErrors({});
      }}
    >
      <DialogTrigger asChild>
        <Button size={supplier ? "sm" : "default"} variant={supplier ? "outline" : "default"}>
          {supplier ? copy.form.edit : copy.form.add}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={copy.form.close}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{supplier ? copy.form.editTitle(supplier.name) : copy.form.addTitle}</DialogTitle>
            <DialogDescription>{copy.form.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="supplier-name">{copy.form.name}</Label>
            <Input id="supplier-name" name="name" defaultValue={supplier?.name ?? ""} autoComplete="off" />
            {errors.name && <ErrorMessage message={errors.name} />}
          </div>
          <div className="space-y-1">
            <Label htmlFor="supplier-email">{copy.form.email}</Label>
            <Input id="supplier-email" name="email" type="email" defaultValue={supplier?.email ?? ""} autoComplete="off" />
            {errors.email && <ErrorMessage message={errors.email} />}
          </div>
          <div className="space-y-1">
            <Label htmlFor="supplier-guidelines">{copy.form.guidelines}</Label>
            <Textarea id="supplier-guidelines" name="guidelines" defaultValue={supplier?.guidelines ?? ""} aria-describedby="supplier-guidelines-hint" />
            <p id="supplier-guidelines-hint" className="text-xs text-muted-foreground">
              {copy.form.guidelinesHint}
            </p>
          </div>
          {errors.form && <ErrorMessage message={errors.form} />}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {copy.form.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? copy.form.pending : copy.form.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleButton({ supplier }: { supplier: Supplier }): ReactElement {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function toggle(): Promise<void> {
    setPending(true);
    setError(false);
    const response = await apiCall(`/api/suppliers/${supplier.id}`, { method: "PATCH", body: { active: !supplier.active } });
    setPending(false);
    if (!response.ok) return setError(true);
    router.refresh();
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={toggle}>
        {supplier.active ? copy.toggle.deactivate : copy.toggle.activate}
      </Button>
      {error && <ErrorMessage message={copy.toggle.failed} />}
    </span>
  );
}

/** Client island of the suppliers screen: the table, the add/edit dialog and the activate/deactivate toggle. */
export function SuppliersManager({ suppliers, canManage }: { suppliers: Supplier[]; canManage: boolean }): ReactElement {
  const columns: DataTableColumn<Supplier>[] = [
    { key: "name", header: copy.columns.name, className: "font-medium", cell: (supplier) => supplier.name },
    { key: "email", header: copy.columns.email, cell: (supplier) => supplier.email },
    {
      key: "guidelines",
      header: copy.columns.guidelines,
      cell: (supplier) => <span className="whitespace-pre-wrap break-words">{supplier.guidelines ?? copy.noGuidelines}</span>,
    },
    {
      key: "status",
      header: copy.columns.status,
      cell: (supplier) => <Badge variant={supplier.active ? "success" : "secondary"}>{supplier.active ? copy.statusLabels.active : copy.statusLabels.inactive}</Badge>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: copy.columns.actions,
            cell: (supplier: Supplier) => (
              <span className="flex flex-wrap items-start gap-2">
                <SupplierDialog supplier={supplier} />
                <ToggleButton supplier={supplier} />
              </span>
            ),
          } satisfies DataTableColumn<Supplier>,
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <SupplierDialog />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{copy.readOnly}</p>
      )}
      <DataTable columns={columns} rows={suppliers} getRowKey={(supplier) => supplier.id} caption={copy.caption} emptyMessage={copy.empty} />
    </div>
  );
}
