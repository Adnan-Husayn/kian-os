"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { login, type LoginResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: LoginResult = { ok: false };

/**
 * Calm, minimal sign-in form. Shows only the generic error returned by the
 * login action — never which credential was wrong, never lockout status.
 * There is no sign-up: this is a private single-user app.
 */
export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_prev: LoginResult, formData: FormData): Promise<LoginResult> => {
      const result = await login(_prev, formData);
      if (result.ok) {
        router.push("/today");
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl tracking-tight">Kian OS</CardTitle>
        <CardDescription>Sign in to your space</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              required
              maxLength={64}
              disabled={pending}
              placeholder="kian"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              disabled={pending}
            />
          </div>

          {state.error && (
            <p role="alert" aria-live="assertive" className="text-sm text-red-500">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 flex gap-2 rounded-md border border-border bg-bg p-3 text-xs leading-relaxed text-text-secondary">
          <ShieldAlert className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            For your protection, 3 failed sign-in attempts permanently lock
            this account. A lockout can only be cleared with direct database
            access — there is no self-service reset.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
