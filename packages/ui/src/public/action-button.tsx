import type { ButtonHTMLAttributes, ReactElement } from "react";

export type ActionVariant = "primary" | "secondary" | "link";
export type ActionSize = "default" | "lg";

const base = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60";

const variantClass: Record<ActionVariant, string> = {
  primary: "inline-block rounded-lg bg-primary text-center font-medium text-primary-foreground shadow-sm hover:opacity-90",
  secondary: "inline-block rounded-lg border border-input bg-background text-center font-medium text-foreground hover:bg-muted",
  link: "text-sm underline underline-offset-4",
};

const sizeClass: Record<ActionSize, string> = { default: "px-4 py-2", lg: "px-4 py-3 text-sm font-semibold" };

/** Class string for anything that must look like an action but is not a `<button>` (e.g. a Next `<Link>`; `ui` stays Next-free). */
export function actionClassName(variant: ActionVariant = "primary", fullWidth = false, size: ActionSize = "default"): string {
  return [base, variantClass[variant], variant !== "link" && sizeClass[size], fullWidth && "w-full"].filter(Boolean).join(" ");
}

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionVariant;
  /** `lg` is the taller wizard button (Back/Next, submit). Ignored by `link`. */
  size?: ActionSize;
  /** Stretch to the container width (single-action forms). */
  fullWidth?: boolean;
}

/** The public (Tailwind) action: `primary` is the one main action of a screen, `secondary` the quiet alternative, `link` a text action. */
export function ActionButton({
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ActionButtonProps): ReactElement {
  return <button type={type} className={[actionClassName(variant, fullWidth, size), className].filter(Boolean).join(" ")} {...props} />;
}
