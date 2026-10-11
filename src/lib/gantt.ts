import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"

export type TaskStatus = "done" | "in_progress" | "pending" | "blocked"

export interface GanttTask {
  id: string
  name: string
  status: TaskStatus
  progress: number
  start: string
  end: string
  deps?: string[]
  milestone?: boolean
  release?: boolean
  blocker?: string
  notes?: string
  hours?: number
  estHours?: number
  updates?: { date: string; text: string }[]
}

export interface WorklogSession {
  taskId: string
  start: string
  end: string | null
  hours?: number
  manual?: boolean
}

export interface GanttProject {
  id: string
  name: string
  color: ProjectColor
  tasks: GanttTask[]
}

export interface GanttMarker {
  id: string
  date: string
  label: string
}

export interface GanttData {
  meta: { title: string; lastUpdated: string }
  markers?: GanttMarker[]
  projects: GanttProject[]
}

export type ProjectColor = "indigo" | "amber" | "emerald" | "rose" | "cyan"

export const PROJECT_COLORS: Record<
  ProjectColor,
  { bar: string; soft: string; text: string; dot: string }
> = {
  indigo: {
    bar: "bg-indigo-500",
    soft: "bg-indigo-500/20 border-indigo-400",
    text: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  amber: {
    bar: "bg-amber-500",
    soft: "bg-amber-500/20 border-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  emerald: {
    bar: "bg-emerald-500",
    soft: "bg-emerald-500/20 border-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  rose: {
    bar: "bg-rose-500",
    soft: "bg-rose-500/20 border-rose-400",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  cyan: {
    bar: "bg-cyan-500",
    soft: "bg-cyan-500/20 border-cyan-400",
    text: "text-cyan-600 dark:text-cyan-400",
    dot: "bg-cyan-500",
  },
}

export const STATUS_META: Record<TaskStatus, { label: string; badge: string }> = {
  done: {
    label: "Completado",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  in_progress: {
    label: "En curso",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  pending: {
    label: "Pendiente",
    badge:
      "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
  blocked: {
    label: "Bloqueado",
    badge: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  },
}

export type Row =
  | { type: "project"; project: GanttProject }
  | { type: "task"; task: GanttTask; project: GanttProject }

export function flattenRows(projects: GanttProject[]): Row[] {
  return projects.flatMap((project) => [
    { type: "project", project } as Row,
    // las releases no son filas: viven en la banda + tira del título
    ...project.tasks
      .filter((task) => !task.release)
      .map((task): Row => ({ type: "task", task, project })),
  ])
}

export interface Timeline {
  start: Date
  end: Date
  days: number
  months: { label: string; x: number }[]
  weeks: { label: string; x: number }[]
}

export function buildTimeline(
  projects: GanttProject[],
  pxPerDay: number,
  padDays = 7
): Timeline {
  const dates = projects.flatMap((p) =>
    p.tasks.flatMap((t) => [parseISO(t.start), parseISO(t.end)])
  )
  const min = addDays(
    new Date(Math.min(...dates.map((d) => d.getTime()))),
    -padDays
  )
  const max = addDays(
    new Date(Math.max(...dates.map((d) => d.getTime()))),
    padDays
  )
  const days = differenceInCalendarDays(max, min)

  const months: Timeline["months"] = []
  let cursor = startOfMonth(min)
  if (cursor < min) cursor = addDays(startOfMonth(addDays(min, 32)), 0)
  for (let d = startOfMonth(min); d <= max; d = startOfMonth(addDays(d, 35))) {
    months.push({
      label: format(d, "MMMM yyyy", { locale: es }),
      x: differenceInCalendarDays(d, min) * pxPerDay,
    })
  }

  const weeks: Timeline["weeks"] = []
  for (
    let d = startOfWeek(min, { weekStartsOn: 1 });
    d <= max;
    d = addDays(d, 7)
  ) {
    weeks.push({
      label: format(d, "d MMM", { locale: es }),
      x: differenceInCalendarDays(d, min) * pxPerDay,
    })
  }

  return { start: min, end: max, days, months, weeks }
}

export function dayToX(date: string, start: Date, pxPerDay: number) {
  return differenceInCalendarDays(parseISO(date), start) * pxPerDay
}

/**
 * Horas trabajadas por día calendario, calculadas del worklog real.
 * Fallback conservador: 3h/día (el usuario intercala proyectos).
 */
export function hoursPerDay(sessions: WorklogSession[]): number {
  const closed = sessions.filter((s) => s.end && s.hours && s.hours > 0)
  if (!closed.length) return 3
  const days = new Set(closed.map((s) => (s.end ?? s.start).slice(0, 10)))
  const total = closed.reduce((a, s) => a + (s.hours ?? 0), 0)
  return Math.max(total / days.size, 0.5)
}

export interface Projection {
  projectedEnd: Date
  late: boolean
  remaining: number
}

/**
 * Proyecta la fecha de fin de una tarea según las horas restantes
 * y la velocidad histórica (horas/día del worklog).
 */
export function projectTask(
  task: GanttTask,
  sessions: WorklogSession[]
): Projection | null {
  if (task.milestone || task.status === "done" || !task.estHours) return null
  const remaining = Math.max(task.estHours - (task.hours ?? 0), 0)
  if (remaining === 0) return null
  const daysNeeded = remaining / hoursPerDay(sessions)
  const base = new Date(
    Math.max(Date.now(), parseISO(task.start).getTime())
  )
  const projectedEnd = addDays(base, Math.ceil(daysNeeded))
  return {
    projectedEnd,
    late: projectedEnd > parseISO(task.end),
    remaining,
  }
}

export function fmtRange(task: GanttTask) {
  if (task.milestone) return format(parseISO(task.end), "d MMM yyyy", { locale: es })
  return `${format(parseISO(task.start), "d MMM", { locale: es })} → ${format(
    parseISO(task.end),
    "d MMM yyyy",
    { locale: es }
  )}`
}
