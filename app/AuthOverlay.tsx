"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getSupabase, signInWithGoogle } from "@/lib/supabase";
import { AUTH_OVERLAY_EVENT, type AuthOverlayMode } from "@/lib/auth-overlay";

type View = "signin" | "signup" | "forgot" | "reset" | "done";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;

const TITLES: Record<View, string> = {
  signin: "Sign in",
  signup: "Create your account",
  forgot: "Reset your password",
  reset: "Choose a new password",
  done: "Check your email",
};

function mapAuthError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Wrong email or password. Try again, or reset your password.";
  }
  if (code === "user_already_exists" || m.includes("already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("password") && (m.includes("at least") || m.includes("weak"))) {
    return `Passwords need at least ${PASSWORD_MIN} characters.`;
  }
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("security purposes")) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (m.includes("valid email") || code === "validation_failed") {
    return "Enter a valid email address.";
  }
  return "Something went wrong. Please try again.";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false" width="18" height="18">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function AuthOverlay() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneText, setDoneText] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const switchView = (next: View) => {
    setError("");
    setPassword("");
    setConfirmPassword("");
    setView(next);
  };

  const openWith = useCallback((mode: AuthOverlayMode) => {
    openerRef.current = document.activeElement as HTMLElement | null;
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setBusy(false);
    setView(mode);
    setOpen(true);
  }, []);

  // Any page can ask for the overlay via the shared event.
  useEffect(() => {
    const onOpen = (event: Event) => {
      openWith((event as CustomEvent<AuthOverlayMode>).detail ?? "signin");
    };
    window.addEventListener(AUTH_OVERLAY_EVENT, onOpen);
    return () => window.removeEventListener(AUTH_OVERLAY_EVENT, onOpen);
  }, [openWith]);

  // A password-reset email link lands on the site with a recovery session;
  // catch it on any page and ask for a new password here.
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPassword("");
        setConfirmPassword("");
        setError("");
        setBusy(false);
        setView("reset");
        setOpen(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Focus trap, Escape to close, scroll lock, and focus return on close.
  useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (!card) return;
    const selector =
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const firstField = card.querySelector<HTMLElement>("input") ??
      card.querySelector<HTMLElement>(selector);
    firstField?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busyRef.current) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(selector));
      if (items.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey) {
        if (!active || !card.contains(active) || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!active || !card.contains(active) || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = openerRef.current;
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open, view]);

  const validEmail = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return false;
    }
    return true;
  };

  const validNewPassword = () => {
    if (password.length < PASSWORD_MIN) {
      setError(`Passwords need at least ${PASSWORD_MIN} characters.`);
      return false;
    }
    if (password !== confirmPassword) {
      setError("The two passwords don't match.");
      return false;
    }
    return true;
  };

  const submitSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!validEmail()) return;
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    const { error: authError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) {
      setError(mapAuthError(authError.message, authError.code));
      return;
    }
    setOpen(false);
  };

  const submitSignUp = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!validEmail() || !validNewPassword()) return;
    setBusy(true);
    const { data, error: authError } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    setBusy(false);
    if (authError) {
      setError(mapAuthError(authError.message, authError.code));
      return;
    }
    if (data.session) {
      // Email confirmation is off: the new account is signed in already.
      setOpen(false);
      return;
    }
    setDoneText(
      `We sent a confirmation link to ${email.trim()}. Open it to activate your account, then sign in. You can pick your public username from the Account page once you're in.`
    );
    setView("done");
  };

  const submitForgot = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!validEmail()) return;
    setBusy(true);
    const { error: authError } = await getSupabase().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/` }
    );
    setBusy(false);
    if (authError) {
      setError(mapAuthError(authError.message, authError.code));
      return;
    }
    setDoneText(
      `If an account exists for ${email.trim()}, a reset link is on its way. Open it on this device and you'll be asked for a new password here.`
    );
    setView("done");
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!validNewPassword()) return;
    setBusy(true);
    const { error: authError } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      setError(mapAuthError(authError.message, authError.code));
      return;
    }
    setDoneText("Password updated. You're signed in with your new password.");
    setView("done");
  };

  if (!open) return null;

  const showEmailForm = view === "signin" || view === "signup";

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setOpen(false);
      }}
    >
      <div
        className="auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-overlay-title"
        ref={cardRef}
      >
        <button
          className="auth-close"
          type="button"
          aria-label="Close sign in dialog"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          <CloseIcon />
        </button>
        <h2 className="auth-title" id="auth-overlay-title">
          {view === "done" && doneText.startsWith("Password updated")
            ? "All set"
            : TITLES[view]}
        </h2>

        {view === "done" && (
          <>
            <p className="auth-copy">{doneText}</p>
            <button
              className="button auth-submit"
              type="button"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </>
        )}

        {(view === "signin" || view === "signup") && (
          <>
            <button
              className="auth-provider-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                signInWithGoogle().then(({ error: authError }) => {
                  setBusy(false);
                  if (authError) {
                    setError(mapAuthError(authError.message, authError.code));
                  }
                });
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <div className="auth-divider" aria-hidden="true">
              <span>or</span>
            </div>
          </>
        )}

        {showEmailForm && (
          <form
            className="auth-form"
            onSubmit={view === "signin" ? submitSignIn : submitSignUp}
            noValidate
          >
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
            />
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={view === "signin" ? "current-password" : "new-password"}
              value={password}
              disabled={busy}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
            />
            {view === "signup" && (
              <>
                <label htmlFor="auth-password-confirm">Repeat password</label>
                <input
                  id="auth-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={busy}
                  aria-invalid={Boolean(error)}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError("");
                  }}
                />
              </>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="button auth-submit" type="submit" disabled={busy}>
              <MailIcon />
              {busy
                ? "One moment..."
                : view === "signin"
                  ? "Sign in with email"
                  : "Sign up with email"}
            </button>
          </form>
        )}

        {view === "forgot" && (
          <form className="auth-form" onSubmit={submitForgot} noValidate>
            <p className="auth-copy">
              Enter your account email and we&rsquo;ll send you a reset link.
            </p>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
            />
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="button auth-submit" type="submit" disabled={busy}>
              <MailIcon />
              {busy ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        {view === "reset" && (
          <form className="auth-form" onSubmit={submitReset} noValidate>
            <label htmlFor="auth-password">New password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
            />
            <label htmlFor="auth-password-confirm">Repeat new password</label>
            <input
              id="auth-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={busy}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
              }}
            />
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="button auth-submit" type="submit" disabled={busy}>
              {busy ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        {view === "signin" && (
          <div className="auth-links">
            <button
              className="link-button"
              type="button"
              onClick={() => switchView("forgot")}
            >
              Forgot password?
            </button>
            <p>
              New to Doppelkey?{" "}
              <button
                className="link-button"
                type="button"
                onClick={() => switchView("signup")}
              >
                Create an account
              </button>
            </p>
          </div>
        )}
        {view === "signup" && (
          <div className="auth-links">
            <p>
              Already have an account?{" "}
              <button
                className="link-button"
                type="button"
                onClick={() => switchView("signin")}
              >
                Sign in
              </button>
            </p>
          </div>
        )}
        {view === "forgot" && (
          <div className="auth-links">
            <p>
              Remembered it?{" "}
              <button
                className="link-button"
                type="button"
                onClick={() => switchView("signin")}
              >
                Back to sign in
              </button>
            </p>
          </div>
        )}
        {view === "signup" && (
          <p className="auth-note">
            You&rsquo;ll pick your public username after signing in.
          </p>
        )}
      </div>
    </div>
  );
}
