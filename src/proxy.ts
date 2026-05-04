import { NextResponse } from "next/server";

export function proxy() {
  // Public exploration mode: never block route access here.
  return NextResponse.next();
}
