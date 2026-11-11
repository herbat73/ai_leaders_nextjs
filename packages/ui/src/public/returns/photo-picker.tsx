"use client";

import { useId, useRef, type ReactElement } from "react";

import { ActionButton } from "../action-button";

export type PhotoStatus = "uploading" | "done" | "error";

export interface PhotoItem {
  id: string;
  name: string;
  /** Already formatted, for example "1,2 MB". */
  sizeText: string;
  status: PhotoStatus;
  /** What is happening, as text: "Wysyłanie…", "Dodane", or the reason a file failed. Never colour alone. */
  statusText: string;
  /** Thumbnail of a stored photo (the download route); absent while uploading or after a failure. */
  previewUrl?: string;
}

export interface PhotoPickerProps {
  legend: string;
  /** What a good photo is; shown always, and is the whole content of the empty state. */
  hint: string;
  addLabel: string;
  /** For example `image/jpeg,image/png,image/webp`. */
  accept: string;
  items: PhotoItem[];
  /** For example "2 z 6 zdjęć, do 5 MB każde". */
  counterText: string;
  /** Visible text of the remove button, for example "Usuń". */
  removeText: string;
  /** Accessible name of the remove button of one file, for example "Usuń zdjęcie front.jpg". */
  removeLabel: (name: string) => string;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** The limit is reached or a submit is running: the add button is disabled and `disabledText` says why. */
  disabled?: boolean;
  disabledText?: string;
  error?: string;
}

/**
 * One to six photos: a native file input behind a button (keyboard and screen reader operable, no drag and drop), one
 * row per file with its state as text, a progress bar while it uploads, and a remove button. The upload itself is the
 * caller's: this component only shows state.
 */
export function PhotoPicker({
  legend,
  hint,
  addLabel,
  accept,
  items,
  counterText,
  removeText,
  removeLabel,
  onAdd,
  onRemove,
  disabled = false,
  disabledText,
  error,
}: PhotoPickerProps): ReactElement {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = `${id}-hint`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  return (
    <fieldset className="space-y-3" aria-describedby={[hintId, counterId, error ? errorId : null].filter(Boolean).join(" ")}>
      <legend className="mb-1.5 font-semibold text-foreground">{legend}</legend>
      <p id={hintId} className="text-sm text-muted-foreground">
        {hint}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onAdd(files);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton type="button" variant="secondary" disabled={disabled} aria-describedby={counterId} onClick={() => inputRef.current?.click()}>
          {addLabel}
        </ActionButton>
        <p id={counterId} className="text-sm text-muted-foreground">
          {disabled && disabledText ? disabledText : counterText}
        </p>
      </div>
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm">
              {item.previewUrl ? (
                // A plain img: the source is our own download route, never an optimised remote image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="" width={56} height={56} className="size-14 shrink-0 rounded-md border border-border object-cover" />
              ) : (
                <div aria-hidden="true" className="size-14 shrink-0 rounded-md border border-border bg-muted" />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-words font-medium text-foreground">
                  {item.name} <span className="font-normal text-muted-foreground">({item.sizeText})</span>
                </p>
                {item.status === "uploading" && <progress aria-label={item.statusText} className="block h-2 w-full accent-primary" />}
                <p role={item.status === "error" ? "alert" : "status"} className={item.status === "error" ? "font-medium text-destructive" : "text-muted-foreground"}>
                  {item.status === "error" && <span aria-hidden="true">⚠ </span>}
                  {item.statusText}
                </p>
              </div>
              <ActionButton type="button" variant="link" aria-label={removeLabel(item.name)} onClick={() => onRemove(item.id)}>
                {removeText}
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </fieldset>
  );
}
