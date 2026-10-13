// Declared locally on purpose: `ui` must not import `core`. Mirrors the envelope built by `apiHandler`.
export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiError };

export interface ApiCallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export class ApiCallError extends Error {
  constructor(readonly error: ApiError, readonly status: number) {
    super(error.message);
    this.name = "ApiCallError";
  }
}

/** Marks a request as made by our own client code; cookie-authenticated routes check it (CSRF baseline). */
const REQUESTED_WITH_HEADER = "x-requested-with";

async function readJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toApiError(payload: unknown, fallbackMessage: string): ApiError {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
  return {
    code: typeof error?.code === "string" ? error.code : "unexpected_response",
    message: typeof error?.message === "string" ? error.message : fallbackMessage,
    fieldErrors: isRecord(error?.fieldErrors) ? (error.fieldErrors as Record<string, string>) : undefined,
  };
}

/** The only sanctioned way to call `/api/*` from client code. Never throws; branch on `ok`. */
export async function apiCall<T>(url: string, { method = "GET", body }: ApiCallOptions = {}): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        [REQUESTED_WITH_HEADER]: "easyrms",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: { code: "network_error", message: "Network error. Please try again." } };
  }

  const payload = await readJsonSafe(response);
  if (response.ok && isRecord(payload) && payload.ok === true) {
    return { ok: true, status: response.status, data: payload.data as T };
  }
  return { ok: false, status: response.status, error: toApiError(payload, `Request failed (${response.status})`) };
}

/** Like `apiCall`, for call sites that prefer to throw an `ApiCallError`. */
export async function apiCallOrThrow<T>(url: string, options?: ApiCallOptions): Promise<T> {
  const result = await apiCall<T>(url, options);
  if (!result.ok) throw new ApiCallError(result.error, result.status);
  return result.data;
}
