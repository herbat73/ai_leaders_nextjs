import { apiHandler, caseSampleAnalyzeSchema, MAX_BODY_BYTES, parseJsonBody, TOO_LARGE_MESSAGE } from "@easyrms/core";

import { requireAgent } from "@/server/agent-auth";
import { httpOptions } from "@/server/http-options";
import { resolveCaseSampleService } from "@/server/container";

export const dynamic = "force-dynamic";

// Agents only (the check reads the agent from the database; the analysis itself stays stateless). The CSV lives only in this request. A workflow endpoint, not CRUD, so `apiHandler` rather than `makeCrudRoute`.
export const POST = apiHandler(async (request) => {
  const input = await parseJsonBody(request, caseSampleAnalyzeSchema, {
    maxBytes: MAX_BODY_BYTES,
    tooLargeMessage: TOO_LARGE_MESSAGE,
  });
  return resolveCaseSampleService().analyze(input);
}, { ...httpOptions, authenticate: requireAgent });
