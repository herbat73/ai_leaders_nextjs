"use server";

import { revalidatePath } from "next/cache";
import { isReturnStatus, ValidationError, type NewReturnRequest } from "@easyrms/core";

import { createRequestScope } from "@/server/container";

/** Returns per-field errors on validation failure, `null` on success. */
export async function submitReturnRequest(input: NewReturnRequest): Promise<Record<string, string> | null> {
  try {
    const scope = await createRequestScope();
    await scope.cradle.returnService.create(input);
    revalidatePath("/admin/returns");
    return null;
  } catch (error) {
    if (error instanceof ValidationError) return error.fields;
    throw error;
  }
}

export async function setReturnStatus(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const status = formData.get("status");
  if (!Number.isInteger(id) || !isReturnStatus(status)) return;
  const scope = await createRequestScope();
  await scope.cradle.returnService.updateStatus(id, status);
  revalidatePath("/admin/returns");
}
