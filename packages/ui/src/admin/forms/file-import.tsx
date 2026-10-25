"use client";

import { useRef, useState, type DragEvent, type ReactElement } from "react";

import { cn } from "../../lib/utils";

export interface FileImportMessages {
  tooLarge: string;
  wrongEncoding: string;
  readFailed: string;
}

export interface FileImportViewProps {
  accept: string;
  label: string;
  /** Secondary line, for example the size limit. */
  hint?: string;
  disabled?: boolean;
  dragging?: boolean;
  /** Shown under the zone as an alert. */
  error?: string;
  fileName?: string;
  onChooseFile: (file: File) => void;
  onDraggingChange?: (dragging: boolean) => void;
}

/** Presentational drop zone: a labelled button plus the equivalent file input. */
export function FileImportView({
  accept,
  label,
  hint,
  disabled = false,
  dragging = false,
  error,
  fileName,
  onChooseFile,
  onDraggingChange,
}: FileImportViewProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    onDraggingChange?.(false);
    const file = event.dataTransfer.files[0];
    if (!disabled && file) onChooseFile(file);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) onDraggingChange?.(true);
        }}
        onDragLeave={() => onDraggingChange?.(false)}
        onDrop={handleDrop}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed bg-card px-6 py-8 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
          dragging ? "border-primary bg-accent" : "border-input hover:border-primary hover:bg-accent",
          disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
        )}
      >
        <span className="font-medium">{label}</span>
        {hint && <span className="text-muted-foreground">{hint}</span>}
        {fileName && <span className="text-muted-foreground">{fileName}</span>}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onChooseFile(file);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export interface FileImportProps {
  accept: string;
  maxBytes: number;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** All visible error text comes from the caller: `ui` keeps no strings. */
  messages: FileImportMessages;
  onText: (text: string, fileName: string) => void;
}

/** Reads one text file in the browser. Rejects oversized files and non-UTF-8 text (U+FFFD) before calling `onText`. */
export function FileImport({ accept, maxBytes, label, hint, disabled, messages, onText }: FileImportProps): ReactElement {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState<string>();

  async function choose(file: File): Promise<void> {
    setError(undefined);
    if (file.size > maxBytes) {
      setError(messages.tooLarge);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError(messages.readFailed);
      return;
    }
    if (text.includes("�")) {
      setError(messages.wrongEncoding);
      return;
    }
    setFileName(file.name);
    onText(text, file.name);
  }

  return (
    <FileImportView
      accept={accept}
      label={label}
      hint={hint}
      disabled={disabled}
      dragging={dragging}
      error={error}
      fileName={fileName}
      onChooseFile={(file) => void choose(file)}
      onDraggingChange={setDragging}
    />
  );
}
