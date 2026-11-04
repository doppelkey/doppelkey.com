// Tiny event bus so any "Sign in" / "Sign up" button on any page can open the
// shared sign-in overlay, which is mounted once in the root layout.
export const AUTH_OVERLAY_EVENT = "doppelkey:open-auth-overlay";

export type AuthOverlayMode = "signin" | "signup";

export function openAuthOverlay(mode: AuthOverlayMode = "signin") {
  window.dispatchEvent(
    new CustomEvent<AuthOverlayMode>(AUTH_OVERLAY_EVENT, { detail: mode })
  );
}
