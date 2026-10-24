import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ReactElement } from "react";

import { ActionButton, Banner, Field, TextInput } from "../../public";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Skeleton,
  Timeline,
  type DataTableColumn,
} from "../../admin";

/** Pattern stories compose real components into screen skeletons; copy them as the starting point of a new screen. */
const meta = { title: "Wzorce/Ekrany", parameters: { layout: "padded" }, tags: ["!autodocs"] } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Tone = "success" | "warning" | "info" | "destructive" | "secondary" | "outline";

interface Row {
  id: number;
  rma: string;
  customer: string;
  status: string;
  tone: Tone;
  overdue?: boolean;
}

const rows: Row[] = [
  { id: 1, rma: "RMA-2026-00042", customer: "anna@example.com", status: "Zgłoszone", tone: "warning", overdue: true },
  { id: 2, rma: "RMA-2026-00041", customer: "jan@example.com", status: "W drodze", tone: "info" },
  { id: 3, rma: "RMA-2026-00040", customer: "ewa@example.com", status: "Zakończone", tone: "success" },
  { id: 4, rma: "RMA-2026-00039", customer: "piotr@example.com", status: "Odrzucone", tone: "destructive" },
];

const columns: DataTableColumn<Row>[] = [
  { key: "rma", header: "RMA", cell: (row) => <span className="font-mono">{row.rma}</span> },
  { key: "customer", header: "Klient", cell: (row) => row.customer },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant={row.tone}>{row.status}</Badge>
        {row.overdue && <Badge variant="destructive">Po terminie</Badge>}
      </span>
    ),
  },
];

function ListScreen({ state }: { state: "data" | "loading" | "empty" | "error" }): ReactElement {
  return (
    <main className="mx-auto max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Zwroty</CardTitle>
          <CardDescription>{state === "data" ? `Liczba zgłoszeń: ${rows.length}` : "Zgłoszenia klientów"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <nav aria-label="Filtr statusu" className="flex flex-wrap gap-2">
            <Button size="sm" aria-current="page">
              Wszystkie
            </Button>
            <Button size="sm" variant="outline">
              Zgłoszone
            </Button>
            <Button size="sm" variant="outline">
              W drodze
            </Button>
          </nav>
          {state === "loading" ? (
            <div role="status" aria-label="Ładowanie listy zwrotów" className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-3/4" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={state === "data" ? rows : []}
              getRowKey={(row) => row.id}
              error={state === "error" ? "Nie udało się pobrać zwrotów. Odśwież stronę." : undefined}
              emptyMessage="Nie ma jeszcze żadnych zgłoszeń"
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

/** Admin list: one `Card`, filters as `Button size="sm"` (active = `default`), `DataTable` with a status `Badge` per row. */
export const ListaAdmina: Story = { render: () => <ListScreen state="data" /> };
/** Loading with a known shape: `Skeleton` rows with `role="status"` and a label (no spinner, no layout jump). */
export const ListaLadowanie: Story = { render: () => <ListScreen state="loading" /> };
/** Empty list: `DataTable` shows `EmptyState`. The text says what will appear here, never just "Brak danych". */
export const ListaPusta: Story = { render: () => <ListScreen state="empty" /> };
/** Failed load: `DataTable error` shows `ErrorMessage` (`role="alert"`) in place of the table. */
export const ListaBlad: Story = { render: () => <ListScreen state="error" /> };

function DetailScreen(): ReactElement {
  const [decided, setDecided] = useState(false);
  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <a href="#lista" className="text-sm underline underline-offset-4">
        ← Wróć do listy
      </a>

      {decided && (
        <Alert variant="success">
          <AlertTitle>Zwrot zatwierdzony</AlertTitle>
          <AlertDescription>Klient dostanie e-mail z instrukcją odesłania paczki.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>RMA-2026-00042</CardTitle>
          <Badge variant={decided ? "info" : "warning"}>{decided ? "Zatwierdzone" : "Zgłoszone"}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2">
            <dt className="text-muted-foreground">Zamówienie</dt>
            <dd>ZAM-10492</dd>
            <dt className="text-muted-foreground">Klient</dt>
            <dd>anna@example.com</dd>
            <dt className="text-muted-foreground">Termin odpowiedzi</dt>
            <dd className="flex flex-wrap items-center gap-2">
              jutro, 12:00 <Badge variant="destructive">Po terminie</Badge>
            </dd>
          </dl>
          {!decided && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDecided(true)}>Zatwierdź</Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Odrzuć</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Odrzucić zwrot RMA-2026-00042?</DialogTitle>
                    <DialogDescription>Klient dostanie e-mail z powodem odrzucenia. Tej decyzji nie da się cofnąć.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Anuluj</Button>
                    </DialogClose>
                    <Button variant="destructive">Odrzuć zwrot</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historia</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline
            emptyMessage="Brak zdarzeń"
            events={[
              { id: 1, label: "Zgłoszenie utworzone", actor: "Klient", at: "24.10.2026, 09:12" },
              { id: 2, label: "Poproszono o zdjęcie produktu", actor: "Agent", at: "24.10.2026, 10:03", note: "Proszę o zdjęcie uszkodzenia." },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}

/** Admin detail: back link, `Card` with a title row (identifier + status `Badge`), `dl` of facts, one primary action, a destructive action behind a `Dialog`, history in its own `Card`. */
export const SzczegolZDecyzja: Story = { render: () => <DetailScreen /> };

/** The confirmation of an irreversible action: the question names the object, says what happens, and the cancel button comes first. */
export const PotwierdzenieAkcjiNieodwracalnej: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Odrzuć zwrot</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Odrzucić zwrot RMA-2026-00042?</DialogTitle>
          <DialogDescription>Klient dostanie e-mail z powodem odrzucenia. Tej decyzji nie da się cofnąć.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Anuluj</Button>
          </DialogClose>
          <Button variant="destructive">Odrzuć zwrot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

function PublicForm({ failed, pending }: { failed?: boolean; pending?: boolean }): ReactElement {
  return (
    <main className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Sprawdź zamówienie</h1>
      {failed && <Banner tone="error">Nie znaleźliśmy zamówienia pasującego do podanych danych. Sprawdź numer zamówienia i adres e-mail.</Banner>}
      <form className="space-y-4" noValidate>
        <Field label="Numer zamówienia" hint="Znajdziesz go w mailu z potwierdzeniem.">
          <TextInput defaultValue={failed ? "ZAM-0000" : ""} />
        </Field>
        <Field label="Adres e-mail" error={failed ? "Podaj adres e-mail w formacie nazwa@domena.pl" : undefined}>
          <TextInput type="email" defaultValue={failed ? "anna" : ""} />
        </Field>
        <ActionButton type="submit" fullWidth disabled={pending}>
          {pending ? "Sprawdzamy…" : "Sprawdź zamówienie"}
        </ActionButton>
      </form>
    </main>
  );
}

/** Public form: `Field` + `TextInput` per field, one `ActionButton` full width, errors by `Field error` and a `Banner` above the form. */
export const FormularzPubliczny: Story = { render: () => <PublicForm /> };
export const FormularzPublicznyBlad: Story = { render: () => <PublicForm failed /> };
export const FormularzPublicznyWysylanie: Story = { render: () => <PublicForm pending /> };

const statuses: { status: string; label: string; tone: Tone; who: string }[] = [
  { status: "submitted", label: "Zgłoszone", tone: "warning", who: "agent musi zdecydować" },
  { status: "awaiting_customer", label: "Oczekuje na klienta", tone: "warning", who: "klient musi odpowiedzieć" },
  { status: "approved", label: "Zatwierdzone", tone: "info", who: "w toku" },
  { status: "in_transit", label: "W drodze", tone: "info", who: "w toku" },
  { status: "received", label: "Odebrane", tone: "info", who: "w toku" },
  { status: "in_service", label: "W serwisie", tone: "info", who: "w toku" },
  { status: "resolved", label: "Zakończone", tone: "success", who: "załatwione" },
  { status: "rejected", label: "Odrzucone", tone: "destructive", who: "zamknięte bez zwrotu" },
  { status: "cancelled", label: "Anulowane", tone: "secondary", who: "zamknięte neutralnie" },
  { status: "unknown", label: "Nieznany", tone: "outline", who: "status spoza słownika" },
];

/** Status → tone: tone says who has to move next, not the stage. Source of truth in code: `app/admin/returns/status-badge.ts`. */
export const StatusNaTon: Story = {
  render: () => (
    <DataTable
      caption="Status zwrotu i ton etykiety"
      columns={[
        { key: "status", header: "Wartość", cell: (row) => <code>{row.status}</code> },
        { key: "badge", header: "Etykieta", cell: (row) => <Badge variant={row.tone}>{row.label}</Badge> },
        { key: "tone", header: "Wariant", cell: (row) => <code>{row.tone}</code> },
        { key: "who", header: "Znaczenie", cell: (row) => row.who },
      ]}
      rows={statuses}
      getRowKey={(row) => row.status}
    />
  ),
};

/** The four states every data view must handle, side by side. */
export const MacierzStanow: Story = {
  render: () => (
    <div className="grid gap-6 md:grid-cols-2">
      {(["data", "loading", "empty", "error"] as const).map((state) => (
        <Card key={state}>
          <CardHeader>
            <CardTitle>{{ data: "Dane", loading: "Ładowanie", empty: "Pusto", error: "Błąd" }[state]}</CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <div role="status" aria-label="Ładowanie" className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-3/4" />
              </div>
            ) : (
              <DataTable
                columns={columns.slice(0, 2)}
                rows={state === "data" ? rows.slice(0, 2) : []}
                getRowKey={(row) => row.id}
                error={state === "error" ? "Nie udało się pobrać danych." : undefined}
                emptyMessage="Nie ma jeszcze żadnych zgłoszeń"
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
