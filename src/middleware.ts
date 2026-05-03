import { NextResponse } from "next/server";

export function middleware() {
  // Public exploration mode: never block route access here.
  return NextResponse.next();
}
