"use client";

import { useState } from "react";
import { authClient } from "@/src/server/auth/auth-client";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    setLoading(true);
    try {
      await authClient.signOut();
      window.location.href = "/sign-in";
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold tracking-wide hover:bg-surface-soft disabled:opacity-60"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
