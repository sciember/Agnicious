/** Community surfaces: only user-uploaded avatars, never OAuth profile photos. */
export function communityPhotoUrl(avatarUrl: string | null | undefined): string | null {
  return avatarUrl && avatarUrl.trim() ? avatarUrl : null;
}
