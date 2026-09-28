"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createProject } from "@/actions/projects";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Calm, muted palette for new projects. */
export const PROJECT_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#0284c7", label: "Sky" },
  { value: "#0d9488", label: "Teal" },
  { value: "#16a34a", label: "Green" },
  { value: "#d97706", label: "Amber" },
  { value: "#e11d48", label: "Rose" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#64748b", label: "Slate" },
];

/**
 * "+ New project" button + dialog (name, description, color choices).
 * Used on the /projects page.
 */
export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState(PROJECT_COLORS[0]!.value);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setColor(PROJECT_COLORS[0]!.value);
    setError(null);
    setSaving(false);
  }

  async function submit() {
    if (!name.trim()) {
      setError("Give the project a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      if (result.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(result.error ?? "Could not create the project.");
      }
    } catch {
      setError("Could not create the project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        New project
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
        label="New project"
      >
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>
          A home for related tasks and notes.
        </DialogDescription>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              id="new-project-name"
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Launch the side project"
              maxLength={200}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-project-description">Description</Label>
            <Textarea
              id="new-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-text-secondary leading-none">
              Color
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Project color">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={`Color ${c.label}`}
                  aria-pressed={color === c.value}
                  onClick={() => setColor(c.value)}
                  disabled={saving}
                  className={cn(
                    "size-8 rounded-full transition-transform duration-150",
                    color === c.value
                      ? "ring-2 ring-accent ring-offset-2 ring-offset-surface scale-110"
                      : "hover:scale-110",
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
