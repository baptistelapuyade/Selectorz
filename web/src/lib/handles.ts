// Gleiche Liste wie private.handle_ok in der Datenbank (Migration profile_create).
export const RESERVED = new Set([
  "admin", "api", "app", "auth", "build", "chain", "chains", "create", "feedback", "help", "home", "imprint", "invite",
  "licenses", "login", "logout", "mix", "new", "preview", "privacy", "profile", "report", "selection", "selections",
  "selectorz", "settings", "start", "support", "terms", "www",
]);

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$/;

export function isHandle(s: string) {
  return HANDLE_RE.test(s) && !RESERVED.has(s);
}

// Profilseiten haben ihr eigenes Laufband und ihren eigenen Footer.
export function isProfilePath(pathname: string | null) {
  if (!pathname) return false;
  const m = pathname.match(/^\/([^/]+)\/?$/);
  return !!m && isHandle(m[1].toLowerCase());
}
