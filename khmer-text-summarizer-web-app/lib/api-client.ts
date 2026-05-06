"use client";

import { useMutation } from "@tanstack/react-query";
import type {
  ExtractUrlBody,
  ExtractUrlResponse,
  SummarizeTextBody,
  SummarizeTextResponse,
} from "@/lib/schemas";

async function postJson<TRequest, TResponse>(
  url: string,
  data: TRequest,
): Promise<TResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(err.message ?? err.error ?? `Request failed with ${res.status}`);
  }
  return (await res.json()) as TResponse;
}

export function useSummarizeText() {
  return useMutation<SummarizeTextResponse, Error, { data: SummarizeTextBody }>({
    mutationFn: ({ data }) =>
      postJson<SummarizeTextBody, SummarizeTextResponse>("/api/summarize", data),
  });
}

export function useExtractUrl() {
  return useMutation<ExtractUrlResponse, Error, { data: ExtractUrlBody }>({
    mutationFn: ({ data }) =>
      postJson<ExtractUrlBody, ExtractUrlResponse>("/api/extract-url", data),
  });
}
