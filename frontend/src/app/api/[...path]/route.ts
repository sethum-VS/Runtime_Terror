import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export const runtime = "nodejs";

async function proxyRequest(req: NextRequest, path: string[]) {
  const targetPath = path.join("/");
  const search = req.nextUrl.search;
  const url = `${BACKEND_URL}/api/${targetPath}${search}`;
  // #region agent log
  fetch("http://127.0.0.1:7526/ingest/961202cd-c5d8-4866-bb97-7c7fd4c9f5f8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "0b705f",
    },
    body: JSON.stringify({
      sessionId: "0b705f",
      runId: "initial",
      hypothesisId: "H3",
      location: "frontend/src/app/api/[...path]/route.ts:proxyRequest:entry",
      message: "Next API proxy invoked",
      data: {
        method: req.method,
        targetPath,
        backendBaseUrl: BACKEND_URL,
        targetUrl: url,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const res = await fetch(url, init);
  const body = await res.arrayBuffer();
  // #region agent log
  fetch("http://127.0.0.1:7526/ingest/961202cd-c5d8-4866-bb97-7c7fd4c9f5f8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "0b705f",
    },
    body: JSON.stringify({
      sessionId: "0b705f",
      runId: "initial",
      hypothesisId: "H3",
      location: "frontend/src/app/api/[...path]/route.ts:proxyRequest:response",
      message: "Next API proxy got backend response",
      data: { targetPath, status: res.status, statusText: res.statusText },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}
