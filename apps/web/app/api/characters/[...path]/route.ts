import { NextRequest } from "next/server";
import { forwardApiRequest } from "../../_proxy-forward";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return forwardApiRequest(req, path);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return forwardApiRequest(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return forwardApiRequest(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return forwardApiRequest(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return forwardApiRequest(req, path);
}
