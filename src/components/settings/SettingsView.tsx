"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Monitor,
  Clock,
  User,
  LogOut,
  Database,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { logout } from "@/actions/auth";
import { deleteAllUserData } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KOLKATA_TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <Icon className="size-4 text-accent" aria-hidden="true" />
        {title}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: "system", label: "System", icon: Monitor },
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
  ] as const;

  // next-themes resolves `theme` to "system" on first render (matching the
  // provider's defaultTheme), so no mounted guard is needed here.
  const current = theme ?? "system";

  return (
    <Section
      icon={Monitor}
      title="Appearance"
      description="Choose how Kian OS looks. System follows your device."
    >
      <div
        role="group"
        aria-label="Theme"
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg p-1"
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(opt.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                selected
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-secondary hover:text-text",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function TimezoneSection() {
  return (
    <Section
      icon={Clock}
      title="Timezone"
      description="All dates, schedules and journal entries are anchored to this timezone."
    >
      <p className="flex items-center gap-2 text-sm text-text">
        <span className="rounded-md bg-accent-soft px-2.5 py-1 font-mono text-accent">
          {KOLKATA_TZ}
        </span>
        <span className="text-text-secondary">(Asia/Kolkata — app default)</span>
      </p>
    </Section>
  );
}

function AccountSection({ username }: { username: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onLogout() {
    startTransition(async () => {
      await logout();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Section
      icon={User}
      title="Account"
      description="You are signed in as this user."
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text">{username}</p>
        <Button variant="outline" size="sm" onClick={onLogout} disabled={pending}>
          <LogOut className="size-4" aria-hidden="true" />
          {pending ? "Logging out…" : "Log out"}
        </Button>
      </div>
    </Section>
  );
}

function DataSection() {
  return (
    <Section
      icon={Database}
      title="Data"
      description="How starter data gets into the app."
    >
      <p className="text-sm leading-relaxed text-text-secondary">
        The seed command{" "}
        <code className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent">
          npm run db:seed
        </code>{" "}
        is idempotent: if a user already exists it prints “seed skipped” and
        never touches existing data. Your data is never modified or deleted
        except by actions you take yourself.
      </p>
    </Section>
  );
}

function DangerZoneSection() {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const armed = confirm.trim() === "DELETE";

  function onDelete() {
    if (!armed) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAllUserData({ confirm: "DELETE" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      } else {
        setError(res.error ?? "Could not delete data.");
      }
    });
  }

  return (
    <Section
      icon={AlertTriangle}
      title="Danger zone"
      description="Irreversible actions. Take a breath before using these."
    >
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-text">
          <Trash2 className="size-4 text-red-500" aria-hidden="true" />
          Delete all data
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          Permanently deletes every task, project, idea, note, journal entry,
          capture and daily plan in your account. Your account itself stays,
          and you will be logged out. This cannot be undone.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to
              confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={pending}
              className="font-mono"
            />
          </div>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={!armed || pending}
            className="sm:mt-6"
          >
            {pending ? "Deleting…" : "Delete everything"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </Section>
  );
}

/** Settings: appearance, timezone, account, data notes, danger zone. */
export function SettingsView({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-text">Settings</h1>
      <p className="mb-5 text-sm text-text-secondary">
        Preferences and account controls.
      </p>
      <div className="space-y-4">
        <AppearanceSection />
        <TimezoneSection />
        <AccountSection username={username} />
        <DataSection />
        <DangerZoneSection />
      </div>
    </div>
  );
}
