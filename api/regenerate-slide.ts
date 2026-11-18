import {
  formatGeminiErrorResponse,
  regenerateSlideService,
  type RegenerateSlideRequestBody,
} from "./_lib/geminiBlueprint.ts";

interface ServerlessRequest {
  method?: string;
  body?: unknown;
}

interface ServerlessResponse {
  status: (code: number) => ServerlessResponse;
  json: (data: unknown) => void;
}

export default async function handler(
  req: ServerlessRequest,
  res: ServerlessResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const body =
      typeof req.body === "string"
        ? (JSON.parse(req.body) as RegenerateSlideRequestBody)
        : ((req.body ?? {}) as RegenerateSlideRequestBody);
    const result = await regenerateSlideService(body);
    res.status(200).json(result);
  } catch (err: unknown) {
    const { status, body } = formatGeminiErrorResponse(err);
    res.status(status).json(body);
  }
}
