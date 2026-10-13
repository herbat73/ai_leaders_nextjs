"use client";

import type { ReactElement } from "react";
import { apiCall } from "@easyrms/ui/admin";
import { ReturnRequestForm } from "@easyrms/ui/public";

type ReturnRequestValues = Parameters<Parameters<typeof ReturnRequestForm>[0]["onSubmit"]>[0];

/** Client island: posts the public return form to the API and maps server errors back onto the fields. */
export function SubmitReturnForm(): ReactElement {
  async function submit(values: ReturnRequestValues): Promise<Record<string, string> | null> {
    const result = await apiCall("/api/returns", { method: "POST", body: values });
    if (result.ok) return null;
    return result.error.fieldErrors ?? { form: result.error.message };
  }

  return <ReturnRequestForm onSubmit={submit} />;
}
