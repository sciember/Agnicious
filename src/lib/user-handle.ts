import { publicDisplayName } from "@/lib/user-public";

export function atHandle(
  username: string | null | undefined,
  displayName: string | null | undefined,
  name: string | null | undefined,
): string {
  if (username) return `@${username}`;
  return publicDisplayName(displayName, name);
}
