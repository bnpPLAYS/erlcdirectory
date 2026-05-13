/** True when the member opted in and is Pro — drives orbit decoration around avatars. */
export function showsProAvatarDecor(
  row: { is_pro?: boolean | null; show_pro_avatar_decor?: boolean | null } | null | undefined,
): boolean {
  if (!row) return false;
  return !!row.is_pro && !!row.show_pro_avatar_decor;
}
