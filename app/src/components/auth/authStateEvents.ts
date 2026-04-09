"use client";

export function announceAuthStateChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("jontaado:auth-state-changed"));
}
