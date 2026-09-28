import type { TaskPriority, TaskStatus } from "@prisma/client";

/** Shape of a top-level task row used across the tasks/projects UI. */
export interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  scheduledDate: Date | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  estimatedMinutes: number | null;
  createdAt: Date;
  project: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  _count: { subtasks: number };
}

export interface ProjectOption {
  id: string;
  name: string;
  color: string | null;
}

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  INBOX: "Inbox",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
  SOMEDAY: "Someday",
};

/** Minimal subtask row for the detail page. */
export interface SubtaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: Date;
}

/** Full task payload for the detail page. */
export interface TaskDetailData extends TaskListItem {
  description: string | null;
  actualMinutes: number | null;
  subtasks: SubtaskItem[];
}
