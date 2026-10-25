import { z } from "zod";

import type { NewSupplier, SupplierChanges } from "../../services/suppliers/types";

export const SUPPLIER_NAME_MAX_LENGTH = 120;
export const SUPPLIER_GUIDELINES_MAX_LENGTH = 2000;

const nameField = z.string().trim().min(1, "Name is required").max(SUPPLIER_NAME_MAX_LENGTH, `At most ${SUPPLIER_NAME_MAX_LENGTH} characters`);
const emailField = z
  .string()
  .trim()
  .max(254, "Email is too long")
  .pipe(z.email("A valid email is required"))
  .transform((value) => value.toLowerCase());
const guidelinesField = z
  .string()
  .trim()
  .max(SUPPLIER_GUIDELINES_MAX_LENGTH, `At most ${SUPPLIER_GUIDELINES_MAX_LENGTH} characters`)
  .transform((value) => (value === "" ? null : value));

export const supplierCreateSchema: z.ZodType<NewSupplier, unknown> = z.object({
  name: nameField,
  email: emailField,
  guidelines: guidelinesField.nullish().transform((value) => value ?? null),
});

/** At least one field; `guidelines: ""` or `null` clears them. */
export const supplierUpdateSchema: z.ZodType<SupplierChanges, unknown> = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
    guidelines: guidelinesField.nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Nothing to change")
  .transform((value) => {
    const { name, email, guidelines, active } = value;
    return {
      ...(name === undefined ? {} : { name }),
      ...(email === undefined ? {} : { email }),
      ...(guidelines === undefined ? {} : { guidelines }),
      ...(active === undefined ? {} : { active }),
    };
  });
