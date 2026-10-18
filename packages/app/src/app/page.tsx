import { SubmitReturnForm } from "./_components/submit-return-form";

export default function Home() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Request a return</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Tell us about your order and we will get back to you by email.</p>
      <SubmitReturnForm />
    </main>
  );
}
