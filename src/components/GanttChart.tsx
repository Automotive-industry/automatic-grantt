import { useMemo, type CSSProperties } from "react"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, Ban, Rocket } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  buildTimeline,
  dayToX,
  flattenRows,
  fmtRange,
  projectTask,
  PROJECT_COLORS,
  STATUS_META,
  type GanttMarker,
  type GanttProject,
  type GanttTask,
  type Projection,
  type Row,
  type WorklogSession,
} from "@/lib/gantt"
import { cn } from "@/lib/utils"

const SIDEBAR_W = 340
const PROJECT_H = 34
const TASK_H = 46
const HEADER_H = 52

interface GanttChartProps {
  projects: GanttProject[]
  pxPerDay: number
  sessions: WorklogSession[]
  markers: GanttMarker[]
  onSelect: (task: GanttTask, project: GanttProject) => void
}

export function GanttChart({
  projects,
  pxPerDay,
  sessions,
  markers,
  onSelect,
}: GanttChartProps) {
  const rows = useMemo(() => flattenRows(projects), [projects])
  const timeline = useMemo(
    () => buildTimeline(projects, pxPerDay),
    [projects, pxPerDay]
  )
  const timelineW = timeline.days * pxPerDay

  // Y center of each task row (for dependency arrows)
  const rowY = useMemo(() => {
    const map = new Map<string, number>()
    let y = 0
    for (const row of rows) {
      if (row.type === "project") {
        y += PROJECT_H
      } else {
        map.set(row.task.id, y + TASK_H / 2)
        y += TASK_H
      }
    }
    return { map, total: y }
  }, [rows])

  const anchors = useMemo(() => {
    const map = new Map<string, { sx: number; ex: number; y: number }>()
    for (const row of rows) {
      if (row.type !== "task") continue
      const y = rowY.map.get(row.task.id) ?? 0
      const sx = dayToX(row.task.start, timeline.start, pxPerDay)
      const ex = row.task.milestone
        ? sx
        : dayToX(row.task.end, timeline.start, pxPerDay) + pxPerDay
      map.set(row.task.id, { sx, ex, y })
    }
    return map
  }, [rows, rowY, timeline.start, pxPerDay])

  const todayX = dayToX(
    new Date().toISOString().slice(0, 10),
    timeline.start,
    pxPerDay
  )
  const showToday = todayX >= 0 && todayX <= timelineW

  return (
    <div className="overflow-auto rounded-xl border bg-card shadow-sm">
      <div
        style={{ width: SIDEBAR_W + timelineW }}
        className="relative min-w-full"
      >
        {/* ===== Header ===== */}
        <div
          className="sticky top-0 z-40 flex border-b bg-card"
          style={{ height: HEADER_H }}
        >
          <div
            className="sticky left-0 z-50 flex items-center border-r bg-card px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            style={{ width: SIDEBAR_W }}
          >
            Tarea
          </div>
          <div className="relative flex-1" style={{ width: timelineW }}>
            {/* month band */}
            {timeline.months.map((m, i) => {
              const next = timeline.months[i + 1]?.x ?? timelineW
              return (
                <div
                  key={i}
                  className="absolute top-0 flex h-6 items-center border-l px-2 text-[11px] font-semibold capitalize text-foreground/80"
                  style={{ left: m.x, width: next - m.x }}
                >
                  {m.label}
                </div>
              )
            })}
            {/* week band */}
            {timeline.weeks.map((w, i) => (
              <div
                key={i}
                className="absolute bottom-0 flex h-6 items-center justify-center border-l text-[10px] text-muted-foreground"
                style={{ left: w.x, width: 7 * pxPerDay }}
              >
                {7 * pxPerDay > 45 ? w.label : ""}
              </div>
            ))}
          </div>
        </div>

        {/* ===== Body ===== */}
        <div className="relative">
          {/* grid lines */}
          <div
            className="pointer-events-none absolute inset-y-0 z-0"
            style={{ left: SIDEBAR_W, width: timelineW }}
          >
            {timeline.weeks.map((w, i) => (
              <div
                key={i}
                className="absolute inset-y-0 border-l border-border/50"
                style={{ left: w.x }}
              />
            ))}
            {timeline.months.map((m, i) => (
              <div
                key={i}
                className="absolute inset-y-0 border-l border-border"
                style={{ left: m.x }}
              />
            ))}
            {showToday && (
              <div
                className="absolute inset-y-0 z-10 w-px bg-primary"
                style={{ left: todayX }}
              >
                <span className="absolute -left-5 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                  hoy
                </span>
              </div>
            )}
            {/* stoppers — marcadores con letrero */}
            {markers.map((m) => {
              const mx = dayToX(m.date, timeline.start, pxPerDay)
              if (mx < 0 || mx > timelineW) return null
              return (
                <div
                  key={m.id}
                  className="absolute inset-y-0 z-[15] border-l-2 border-dashed border-red-500/70"
                  style={{ left: mx }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="pointer-events-auto absolute left-0 top-1 flex -translate-x-1/2 cursor-default items-center gap-1 whitespace-nowrap rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        <Ban className="size-3" />
                        {m.label}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {m.label} —{" "}
                      {format(parseISO(m.date), "d MMM yyyy", { locale: es })}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )
            })}
          </div>

          {rows.map((row, i) =>
            row.type === "project" ? (
              <ProjectRow
                key={`p-${row.project.id}`}
                row={row}
                timelineStart={timeline.start}
                pxPerDay={pxPerDay}
                onSelect={onSelect}
              />
            ) : (
              <TaskRow
                key={row.task.id}
                row={row}
                index={i}
                timelineStart={timeline.start}
                pxPerDay={pxPerDay}
                sessions={sessions}
                onSelect={onSelect}
              />
            )
          )}

          {/* dependency arrows */}
          <svg
            className="pointer-events-none absolute inset-y-0 z-20"
            style={{ left: SIDEBAR_W, width: timelineW }}
            width={timelineW}
            height={rowY.total}
          >
            <defs>
              <marker
                id="dep-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
              </marker>
            </defs>
            {rows.flatMap((row) => {
              if (row.type !== "task" || !row.task.deps?.length) return []
              return row.task.deps.map((depId) => {
                const from = anchors.get(depId)
                const to = anchors.get(row.task.id)
                if (!from || !to) return null
                const x1 = from.ex + 2
                const x2 = to.sx - 2
                const y1 = from.y
                const y2 = to.y
                const bend = Math.max(12, Math.abs(x2 - x1) / 2)
                const d =
                  y1 === y2
                    ? `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
                    : `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x1 + bend} ${y2}, ${x1 + bend * 1.6} ${y2} L ${x2 - bend * 0.6} ${y2} C ${x2 - bend / 2} ${y2}, ${x2 - 4} ${y2}, ${x2} ${y2}`
                return (
                  <path
                    key={`${depId}-${row.task.id}`}
                    d={d}
                    fill="none"
                    className="stroke-muted-foreground/60"
                    strokeWidth={1.4}
                    strokeDasharray="4 2"
                    markerEnd="url(#dep-arrow)"
                  />
                )
              })
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}

function ProjectRow({
  row,
  timelineStart,
  pxPerDay,
  onSelect,
}: {
  row: Extract<Row, { type: "project" }>
  timelineStart: Date
  pxPerDay: number
  onSelect: (task: GanttTask, project: GanttProject) => void
}) {
  const { project } = row
  const colors = PROJECT_COLORS[project.color]
  const avg = Math.round(
    project.tasks.reduce((acc, t) => acc + t.progress, 0) /
      project.tasks.length
  )
  const releases = project.tasks.filter((t) => t.release)
  return (
    <div
      className="flex border-b bg-muted/40"
      style={{ height: PROJECT_H }}
    >
      <div
        className="sticky left-0 z-30 flex items-center gap-2 border-r bg-muted px-4"
        style={{ width: SIDEBAR_W }}
      >
        <span className={cn("size-2 rounded-full", colors.dot)} />
        <span className={cn("truncate text-xs font-bold", colors.text)}>
          {project.name}
        </span>
        <span className="ml-auto text-[10px] font-medium text-muted-foreground">
          {avg}%
        </span>
      </div>
      {/* tags de versión sobre la línea de tiempo del proyecto */}
      <div className="relative flex-1">
        {releases.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t, project)}
            className="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-1.5 py-px text-[9px] font-semibold text-primary backdrop-blur transition-colors hover:bg-primary/30"
            style={{ left: dayToX(t.end, timelineStart, pxPerDay) }}
          >
            <Rocket className="size-2.5" />
            <span className="max-w-28 truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TaskRow({
  row,
  index,
  timelineStart,
  pxPerDay,
  sessions,
  onSelect,
}: {
  row: Extract<Row, { type: "task" }>
  index: number
  timelineStart: Date
  pxPerDay: number
  sessions: WorklogSession[]
  onSelect: (task: GanttTask, project: GanttProject) => void
}) {
  const { task, project } = row
  const colors = PROJECT_COLORS[project.color]
  const meta = STATUS_META[task.status]
  const projection = useMemo(
    () => projectTask(task, sessions),
    [task, sessions]
  )

  const start = parseISO(task.start)
  const end = parseISO(task.end)
  const x = dayToX(task.start, timelineStart, pxPerDay)
  const w = task.milestone
    ? 0
    : Math.max((differenceInCalendarDays(end, start) + 1) * pxPerDay, 10)
  const projX = projection?.late
    ? differenceInCalendarDays(projection.projectedEnd, timelineStart) * pxPerDay
    : null

  const hoursLabel =
    task.hours !== undefined || task.estHours !== undefined
      ? `${task.hours ?? 0}h${task.estHours ? `/${task.estHours}h` : ""}`
      : null

  return (
    <div
      className={cn(
        "flex border-b transition-colors hover:bg-accent/40",
        index % 2 === 0 && "bg-muted/10"
      )}
      style={{ height: TASK_H }}
    >
      {/* sidebar cell */}
      <div
        className="sticky left-0 z-30 flex cursor-pointer flex-col justify-center gap-0.5 border-r bg-card px-4"
        style={{ width: SIDEBAR_W }}
        onClick={() => onSelect(task, project)}
      >
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">{task.name}</span>
          {task.blocker && (
            <AlertTriangle className="size-3 shrink-0 text-amber-500" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "h-4 rounded-full px-1.5 text-[9px] font-medium",
              meta.badge
            )}
          >
            {meta.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {fmtRange(task)}
          </span>
          {hoursLabel && (
            <span className="text-[10px] font-semibold text-foreground/60">
              · {hoursLabel}
            </span>
          )}
        </div>
      </div>

      {/* timeline cell */}
      <div
        className="relative flex-1 cursor-pointer"
        onClick={() => onSelect(task, project)}
      >
        {task.milestone ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {task.release ? (
                <div
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-default"
                  style={{ left: x }}
                >
                  <div
                    className="gantt-milestone flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 backdrop-blur"
                    style={{ "--i": index } as CSSProperties}
                  >
                    <Rocket className="size-3 text-primary" />
                    <span className="max-w-40 truncate text-[10px] font-semibold text-primary">
                      {task.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-default"
                  style={{ left: x }}
                >
                  <div
                    className={cn(
                      "gantt-milestone size-3.5 rotate-45 rounded-[3px] border-2 border-background shadow",
                      task.status === "done"
                        ? colors.bar
                        : "bg-muted-foreground/60"
                    )}
                    style={{ "--i": index } as CSSProperties}
                  />
                </div>
              )}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              <TooltipBody task={task} projection={projection} />
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "gantt-bar absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md border shadow-sm",
                  task.status === "done" && cn(colors.bar, "border-transparent"),
                  task.status === "in_progress" && cn(colors.soft),
                  task.status === "pending" &&
                    cn("border-dashed", colors.soft, "opacity-70"),
                  task.status === "blocked" &&
                    "border-red-500/60 bg-red-500/15"
                )}
                style={
                  {
                    left: x,
                    width: w,
                    "--i": index,
                    ...(task.status === "blocked"
                      ? {
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent, transparent 6px, rgb(239 68 68 / 0.12) 6px, rgb(239 68 68 / 0.12) 12px)",
                        }
                      : {}),
                  } as CSSProperties
                }
              >
                {/* progress fill */}
                {task.status !== "done" && task.progress > 0 && (
                  <div
                    className={cn(
                      "h-full",
                      task.status === "blocked" ? "bg-red-500/60" : colors.bar
                    )}
                    style={{ width: `${task.progress}%` }}
                  />
                )}
                {task.status === "done" && (
                  <div className="h-full w-full bg-white/10" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              <TooltipBody task={task} projection={projection} />
            </TooltipContent>
          </Tooltip>
        )}

        {/* proyección por historial: continua punteada si llega tarde */}
        {projX !== null && !task.milestone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute top-1/2 z-[5] h-6 -translate-y-1/2 rounded-r-md border-y border-r border-dashed border-amber-500/70 bg-amber-500/10"
                style={{
                  left: x + w,
                  width: Math.max(projX - (x + w), 4),
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              Proyectado según historial:{" "}
              {format(projection!.projectedEnd, "d MMM", { locale: es })}
            </TooltipContent>
          </Tooltip>
        )}

        {/* progress label outside the bar */}
        {!task.milestone && w > 40 && (
          <span
            className="absolute top-1/2 z-10 -translate-y-1/2 text-[10px] font-semibold text-foreground/70"
            style={{ left: (projX ?? x + w) + 6 }}
          >
            {task.progress}%
          </span>
        )}
      </div>
    </div>
  )
}

function TooltipBody({
  task,
  projection,
}: {
  task: GanttTask
  projection: Projection | null
}) {
  const meta = STATUS_META[task.status]
  return (
    <div className="space-y-1 text-xs">
      <div className="font-semibold">{task.name}</div>
      <div className="text-muted-foreground">{fmtRange(task)}</div>
      <div>
        {meta.label} · {task.progress}%
        {(task.hours !== undefined || task.estHours) && (
          <span className="text-muted-foreground">
            {" "}
            · {task.hours ?? 0}h{task.estHours ? ` / est. ${task.estHours}h` : ""}
          </span>
        )}
      </div>
      {projection?.late && (
        <div className="text-amber-500">
          Proyectado:{" "}
          {format(projection.projectedEnd, "d MMM yyyy", { locale: es })} (
          {Math.round(projection.remaining)}h restantes)
        </div>
      )}
      {task.blocker && (
        <div className="flex items-center gap-1 text-amber-500">
          <AlertTriangle className="size-3" /> {task.blocker}
        </div>
      )}
      {task.notes && <div className="text-muted-foreground">{task.notes}</div>}
      {task.updates && task.updates.length > 0 && (
        <div className="space-y-0.5 border-t border-border/50 pt-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Avances
          </div>
          {task.updates.slice(-3).map((u, i) => (
            <div key={i} className="text-muted-foreground">
              <span className="text-foreground/60">
                {format(parseISO(u.date), "d MMM", { locale: es })}:
              </span>{" "}
              {u.text}
            </div>
          ))}
          {task.updates.length > 3 && (
            <div className="text-[10px] text-muted-foreground">
              +{task.updates.length - 3} más — clic para ver todo
            </div>
          )}
        </div>
      )}
    </div>
  )
}
