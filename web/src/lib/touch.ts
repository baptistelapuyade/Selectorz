// Handy oder Tablet? Dann Story über den Teilen-Dialog (Instagram). Am Laptop: Bild herunterladen
// (PO-Test 24.11.: der Mac-Teilen-Dialog am Laptop ist nicht gewollt).
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0;
}
