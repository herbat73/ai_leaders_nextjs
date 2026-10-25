import type { ButtonHTMLAttributes, ReactElement } from "react";

export type ActionVariant = "primary" | "secondary" | "link";
export type ActionSize = "default" | "lg";

const base = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55";

const variantClass: Record<ActionVariant, string> = {
  primary: "inline-flex items-center justify-center rounded-control border border-transparent bg-primary text-center font-semibold text-primary-foreground hover:bg-primary-hover",
  secondary: "inline-flex items-center justify-center rounded-control border border-primary bg-card text-center font-semibold text-primary hover:bg-accent",
  link: "text-sm text-primary underline underline-offset-4 hover:text-primary-hover",
};

const sizeClass: Record<ActionSize, string> = { default: "min-h-11 px-[18px] py-2.5", lg: "min-h-[52px] px-6 py-3 text-[1.05rem]" };

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
