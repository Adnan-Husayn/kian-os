import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const cuidSchema = z.string().cuid();

export const moodSchema = z.enum(["low", "okay", "good", "great"]);
export const energySchema = z.enum(["low", "medium", "high"]);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(64),
  password: z.string().min(1, "Password is required").max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const taskStatusSchema = z.enum([
  "INBOX",
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
  "SOMEDAY",
]);

export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().trim().max(10_000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.coerce.date().optional(),
  scheduledDate: z.coerce.date().optional(),
  scheduledStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .optional(),
  scheduledEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
  actualMinutes: z.number().int().min(0).max(1440).optional(),
  projectId: cuidSchema.optional(),
  parentTaskId: cuidSchema.optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  // Nullable (not just optional) so clients can explicitly clear a value.
  // z.coerce.date() alone would coerce null → epoch, hence the union.
  scheduledDate: z.union([z.null(), z.coerce.date()]).optional(),
  dueDate: z.union([z.null(), z.coerce.date()]).optional(),
  completedAt: z.union([z.null(), z.coerce.date()]).optional(),
  projectId: cuidSchema.nullable().optional(),
  scheduledStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .nullable()
    .optional(),
  scheduledEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
    .nullable()
    .optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  actualMinutes: z.number().int().min(0).max(1440).nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projectStatusSchema = z.enum([
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(10_000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6366f1")
    .optional(),
  status: projectStatusSchema.optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  description: z.string().trim().max(10_000).nullable().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------

export const ideaStatusSchema = z.enum([
  "NEW",
  "EXPLORING",
  "TURNED_INTO_PROJECT",
  "ARCHIVED",
]);

export const createIdeaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  content: z.string().max(50_000).optional(),
  category: z.string().trim().max(100).optional(),
  status: ideaStatusSchema.optional(),
  why: z.string().trim().max(10_000).optional(),
  couldBecome: z.string().trim().max(10_000).optional(),
  nextAction: z.string().trim().max(10_000).optional(),
});

export const updateIdeaSchema = createIdeaSchema.partial();

export const turnIntoProjectSchema = z.object({
  ideaId: cuidSchema,
  name: z.string().trim().min(1, "Project name is required").max(200),
  description: z.string().trim().max(10_000).optional(),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;
export type TurnIntoProjectInput = z.infer<typeof turnIntoProjectSchema>;

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  content: z.string().max(100_000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  pinned: z.boolean().optional(),
  projectId: cuidSchema.nullable().optional(),
});

export const updateNoteSchema = createNoteSchema.partial();

export const updateNoteTagsSchema = z.object({
  id: cuidSchema,
  tags: z.array(z.string().trim().min(1).max(60)).max(30),
});

export const linkNoteToProjectSchema = z.object({
  id: cuidSchema,
  projectId: cuidSchema.nullable(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type UpdateNoteTagsInput = z.infer<typeof updateNoteTagsSchema>;
export type LinkNoteToProjectInput = z.infer<typeof linkNoteToProjectSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const deleteAllDataSchema = z.object({
  confirm: z.literal("DELETE"),
});

export type DeleteAllDataInput = z.infer<typeof deleteAllDataSchema>;

// ---------------------------------------------------------------------------
// Calendar (task scheduling primitives)
// ---------------------------------------------------------------------------

/** yyyy-MM-dd day key (date-only semantics in Asia/Kolkata). */
export const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd");

export const moveTaskSchema = z.object({
  id: cuidSchema,
  // Midnight-Kolkata date to move to, or null to unschedule.
  dayKey: dayKeySchema.nullable(),
});

export const quickAddTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  dayKey: dayKeySchema,
});

export const toggleTaskDoneSchema = z.object({
  id: cuidSchema,
  done: z.boolean(),
});

export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type QuickAddTaskInput = z.infer<typeof quickAddTaskSchema>;
export type ToggleTaskDoneInput = z.infer<typeof toggleTaskDoneSchema>;

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export const captureTypeSchema = z.enum([
  "TASK",
  "IDEA",
  "NOTE",
  "REMINDER",
  "UNKNOWN",
]);

export const createCaptureSchema = z.object({
  content: z.string().trim().min(1, "Write something first").max(10_000),
  type: captureTypeSchema.optional(),
});

export type CreateCaptureInput = z.infer<typeof createCaptureSchema>;

// ---------------------------------------------------------------------------
// Task operations
// ---------------------------------------------------------------------------

export const taskIdSchema = cuidSchema;

export const setTaskStatusSchema = z.object({
  taskId: cuidSchema,
  status: taskStatusSchema,
});

export const rescheduleTaskSchema = z.object({
  taskId: cuidSchema,
  // yyyy-MM-dd day key in the user's timezone; null clears the schedule.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a yyyy-MM-dd date")
    .nullable(),
});

export const createSubtaskSchema = z.object({
  parentId: cuidSchema,
  title: z.string().trim().min(1, "Title is required").max(500),
});

export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;

// ---------------------------------------------------------------------------
// Project operations
// ---------------------------------------------------------------------------

export const setProjectStatusSchema = z.object({
  projectId: cuidSchema,
  status: projectStatusSchema,
});

// ---------------------------------------------------------------------------
// Inbox operations
// ---------------------------------------------------------------------------

export const convertCaptureSchema = z.object({
  id: cuidSchema,
  kind: z.enum(["task", "idea", "note"]),
  // Optional manual override; defaults to the parsed capture title.
  title: z.string().trim().min(1).max(500).optional(),
  projectId: cuidSchema.optional(),
});

export const bulkProcessSchema = z.object({
  ids: z.array(cuidSchema).min(1).max(100),
  action: z.enum(["archive", "delete", "convert-task", "convert-idea", "convert-note"]),
});

export const captureSmartSchema = z.object({
  content: z.string().trim().min(1, "Write something first").max(10_000),
  // Manual type hint from the UI chips; the parser fills in when omitted.
  type: captureTypeSchema.optional(),
});

export type ConvertCaptureInput = z.infer<typeof convertCaptureSchema>;
export type BulkProcessInput = z.infer<typeof bulkProcessSchema>;
export type CaptureSmartInput = z.infer<typeof captureSmartSchema>;

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export const upsertJournalSchema = z.object({
  // Date-only semantics; callers should pass a midnight-Kolkata Date.
  date: z.coerce.date(),
  content: z.string().max(100_000).optional(),
  mood: moodSchema.optional(),
  energy: energySchema.optional(),
});

export type UpsertJournalInput = z.infer<typeof upsertJournalSchema>;

// ---------------------------------------------------------------------------
// Daily plan (dayKeySchema is defined in the Calendar section above)
// ---------------------------------------------------------------------------

/** yyyy-MM month key for journal listing. */
export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Use yyyy-MM");

export const planTaskItemSchema = z.object({
  taskId: cuidSchema,
  plannedMinutes: z.number().int().min(1).max(1440).optional(),
});

export type PlanTaskItemInput = z.infer<typeof planTaskItemSchema>;

export const setPlanTasksSchema = z.object({
  dayKey: dayKeySchema,
  tasks: z.array(planTaskItemSchema).max(50),
});

export type SetPlanTasksInput = z.infer<typeof setPlanTasksSchema>;

export const updateDailyPlanSchema = z.object({
  dayKey: dayKeySchema,
  mainFocus: z.string().trim().max(500).nullable().optional(),
  intention: z.string().trim().max(1000).nullable().optional(),
  energyLevel: z.string().trim().max(60).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
});

export type UpdateDailyPlanInput = z.infer<typeof updateDailyPlanSchema>;

export const reorderPlanTasksSchema = z.object({
  dayKey: dayKeySchema,
  // DailyPlanTask ids OR task ids — planner actions accept task ids for
  // simplicity; the caller passes them in the desired order.
  orderedTaskIds: z.array(cuidSchema).max(50),
});

export const movePlanTaskSchema = z.object({
  taskId: cuidSchema,
  fromDayKey: dayKeySchema,
  toDayKey: dayKeySchema,
});

export type MovePlanTaskInput = z.infer<typeof movePlanTaskSchema>;

export const planTaskRefSchema = z.object({
  taskId: cuidSchema,
  dayKey: dayKeySchema,
});

export const brainDumpSchema = z.object({
  content: z.string().trim().min(1, "Write something first").max(20_000),
});

export type BrainDumpInput = z.infer<typeof brainDumpSchema>;

// ---------------------------------------------------------------------------
// Journal (day-key based)
// ---------------------------------------------------------------------------

export const saveJournalSchema = z.object({
  dayKey: dayKeySchema,
  content: z.string().max(100_000).optional(),
  mood: moodSchema.nullable().optional(),
  energy: energySchema.nullable().optional(),
});

export type SaveJournalInput = z.infer<typeof saveJournalSchema>;

export const upsertDailyPlanSchema = z.object({
  date: z.coerce.date(),
  mainFocus: z.string().trim().max(500).optional(),
  intention: z.string().trim().max(1000).optional(),
  energyLevel: z.string().trim().max(60).optional(),
  notes: z.string().max(10_000).optional(),
  tasks: z
    .array(
      z.object({
        taskId: cuidSchema,
        position: z.number().int().min(0).default(0),
        plannedMinutes: z.number().int().min(1).max(1440).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export type UpsertDailyPlanInput = z.infer<typeof upsertDailyPlanSchema>;
