import { NextRequest, NextResponse } from "next/server";
import {
  getServerApiBaseUrl,
  getServerApiTimeoutMs,
} from "@/lib/server-api-config";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function buildTargetUrl(req: NextRequest, pathParts: string[]): URL {
  const upstreamPath = pathParts.join("/");
  const target = new URL(`/${upstreamPath}`, getServerApiBaseUrl());
  target.search = req.nextUrl.search;
  return target;
}

function copyResponseHeaders(from: Headers): Headers {
  const headers = new Headers();
  from.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  return headers;
}

export async function forwardApiRequest(req: NextRequest, pathParts: string[]) {
  const target = buildTargetUrl(req, pathParts);
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getServerApiTimeoutMs());
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Upstream API request timed out"
        : "Upstream API request failed";
    return NextResponse.json({ message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: copyResponseHeaders(upstream.headers),
  });
}
