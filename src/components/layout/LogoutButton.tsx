"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Sign-out button: destroys the server session, then returns to /login. */
export function LogoutButton(props: Omit<ButtonProps, "onClick" | "children">) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button
      onClick={() => void handleLogout()}
      disabled={busy}
      aria-label="Log out"
      {...props}
    >
      <LogOut className="size-4" />
      {busy ? "…" : "Log out"}
    </Button>
  );
}
