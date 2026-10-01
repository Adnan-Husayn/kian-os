"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowUp,
  ArrowDown,
  CalendarX,
  ChevronsRight,
  Repeat,
  GripVertical,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { BulletMark } from "@/components/ui/bullet-mark";
import {
  reorderPlanTasks,
  togglePlanTaskComplete,
  notToday,
  movePlanTaskToDate,
} from "@/actions/planner";
import { useShortcuts } from "@/components/keyboard/shortcut-context";

export interface PlanListItem {
  id: string;
  taskId: string;
  plannedMinutes: number | null;
  title: string;
  status: string;
  estimatedMinutes: number | null;
  priority: string;
  /** Moved on to tomorrow: stays in today's log as a ">" entry. */
  migrated: boolean;
  /** Generated from a routine: tomorrow gets its own, so it can't be moved. */
  routine: boolean;
}

interface PlanListProps {
  dayKey: string;
  tomorrowKey: string;
  initialItems: PlanListItem[];
}

function minutesLabel(item: PlanListItem): string | null {
  const mins = item.plannedMinutes ?? item.estimatedMinutes;
  return mins ? `${mins}m` : null;
}

/**
 * Today's plan list: animated checkboxes, HTML5 drag-to-reorder plus
 * up/down arrow buttons for keyboard users, and a gentle "not today" action.
 */
export function PlanList({ dayKey, tomorrowKey, initialItems }: PlanListProps) {
  const [items, setItems] = React.useState(initialItems);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const dragFrom = React.useRef<number | null>(null);
  const { openCapture } = useShortcuts();

  // Sync local (optimistic) state when the server sends a new list, e.g.
  // after a router refresh. Done during render per the React docs pattern
  // for derived state.
  const [prevInitial, setPrevInitial] = React.useState(initialItems);
  if (prevInitial !== initialItems) {
    setPrevInitial(initialItems);
    setItems(initialItems);
  }

  function persistOrder(next: PlanListItem[]) {
    void reorderPlanTasks(
      dayKey,
      next.map((i) => i.taskId),
    );
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    persistOrder(next);
  }

  function handleDrop(to: number) {
    const from = dragFrom.current;
    setDragIndex(null);
    setDropIndex(null);
    dragFrom.current = null;
    if (from === null) return;
    move(from, to);
  }

  async function handleToggle(item: PlanListItem, done: boolean) {
    setItems((prev) =>
      prev.map((i) =>
        i.taskId === item.taskId
          ? { ...i, status: done ? "DONE" : "TODO" }
          : i,
      ),
    );
    await togglePlanTaskComplete(item.taskId, done);
  }

  async function handleNotToday(item: PlanListItem) {
    setItems((prev) => prev.filter((i) => i.taskId !== item.taskId));
    await notToday(item.taskId, dayKey);
  }

  async function handleMoveToTomorrow(item: PlanListItem) {
    setItems((prev) =>
      prev.map((i) => (i.taskId === item.taskId ? { ...i, migrated: true } : i)),
    );
    await movePlanTaskToDate(item.taskId, dayKey, tomorrowKey);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-5 py-8 text-center">
        <p className="text-sm text-text-secondary">
          Nothing planned yet. Start with one small thing.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={openCapture}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add a task
        </Button>
      </div>
    );
  }

  return (
    <ul aria-label="Today's plan" className="space-y-2">
      {items.map((item, index) => {
        const done = item.status === "DONE";
        const mins = minutesLabel(item);
        if (item.migrated) {
          // Bullet-journal migration: the entry stays, marked ">".
          return (
            <li
              key={item.taskId}
              className="log-row flex items-center gap-3 py-2.5 pl-8 pr-1"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-7 shrink-0 items-center justify-center font-mono text-base text-mark"
              >
                &gt;
              </span>
              <p className="min-w-0 flex-1 truncate text-base text-text-secondary">
                <span className="sr-only">Moved to tomorrow: </span>
                {item.title}
              </p>
              <span className="shrink-0 font-mono text-xs text-text-secondary">
                tomorrow
              </span>
            </li>
          );
        }
        // Plain <li> carries the native HTML5 drag handlers (framer-motion
        // repurposes onDragStart on motion components); the inner motion.div
        // keeps the layout animation on reorder.
        return (
          <li
            key={item.taskId}
            draggable
            onDragStart={(e) => {
              dragFrom.current = index;
              setDragIndex(index);
              e.dataTransfer.effectAllowed = "move";
              // Required for Firefox.
              e.dataTransfer.setData("text/plain", item.taskId);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropIndex(index);
            }}
            onDragLeave={() => setDropIndex((d) => (d === index ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(index);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
              dragFrom.current = null;
            }}
          >
          <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "group log-row flex items-center gap-3 px-1 py-2.5 transition-colors duration-150",
              dropIndex === index && dragIndex !== index && "border-b-accent",
              dragIndex === index && "opacity-40",
            )}
          >
            <span
              className="cursor-grab text-text-secondary/60 active:cursor-grabbing"
              aria-hidden="true"
            >
              <GripVertical className="size-4" />
            </span>

            <motion.button
              type="button"
              role="checkbox"
              aria-checked={done}
              aria-label={done ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
              onClick={() => void handleToggle(item, !done)}
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm hover:bg-accent-soft"
            >
              <BulletMark done={done} />
            </motion.button>

            <div className="relative min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-base transition-colors duration-200",
                  done && "text-text-secondary",
                )}
              >
                {item.title}
              </p>
              <motion.span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-px bg-text-secondary"
                initial={false}
                animate={{ scaleX: done ? 1 : 0 }}
                style={{ originX: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </div>

            {item.routine && (
              <Repeat
                className="size-3.5 shrink-0 text-text-secondary"
                aria-label="Routine"
              />
            )}

            {mins && (
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
                {mins}
              </span>
            )}

            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
              <Tooltip content="Move up">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label={`Move "${item.title}" up`}
                >
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </Button>
              </Tooltip>
              <Tooltip content="Move down">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`Move "${item.title}" down`}
                >
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </Button>
              </Tooltip>
              {!done && !item.routine && (
                <Tooltip content="Move to tomorrow">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => void handleMoveToTomorrow(item)}
                    aria-label={`Move "${item.title}" to tomorrow`}
                  >
                    <ChevronsRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </Tooltip>
              )}
              <Tooltip content="Not today — back to the backlog">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => void handleNotToday(item)}
                  aria-label={`Not today: remove "${item.title}" from today's plan`}
                >
                  <CalendarX className="size-3.5" aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>
          </motion.div>
          </li>
        );
      })}
    </ul>
  );
}
