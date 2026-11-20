// Gleiche Liste wie private.handle_ok in der Datenbank (Migration core_model).
export const RESERVED = new Set([
  "admin", "api", "app", "auth", "chain", "chains", "help", "home", "invite", "licenses", "login", "logout", "mix",
  "privacy", "profile", "report", "selection", "selections", "selectorz", "settings", "support", "terms", "www",
  "imprint", "preview", "feedback",
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
