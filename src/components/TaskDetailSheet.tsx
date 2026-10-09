import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, Clock, History, Link2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  fmtRange,
  projectTask,
  PROJECT_COLORS,
  STATUS_META,
  type GanttProject,
  type GanttTask,
  type WorklogSession,
} from "@/lib/gantt"
import { cn } from "@/lib/utils"

interface TaskDetailSheetProps {
  task: GanttTask | null
  project: GanttProject | null
  sessions: WorklogSession[]
  allTasks: GanttTask[]
  onClose: () => void
}

export function TaskDetailSheet({
  task,
  project,
  sessions,
  allTasks,
  onClose,
}: TaskDetailSheetProps) {
  const open = task !== null && project !== null
  const proj = task ? projectTask(task, sessions) : null
  const taskSessions = task
    ? sessions.filter((s) => s.taskId === task.id)
    : []
  const depNames = task?.deps?.map(
    (d) => allTasks.find((t) => t.id === d)?.name ?? d
  )

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {task && project && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    PROJECT_COLORS[project.color].dot
                  )}
                />
                <span className="text-xs text-muted-foreground">
                  {project.name}
                </span>
              </div>
              <SheetTitle className="text-left leading-snug">
                {task.name}
              </SheetTitle>
              <SheetDescription className="text-left">
                {fmtRange(task)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {/* estado + progreso */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("rounded-full", STATUS_META[task.status].badge)}
                >
                  {STATUS_META[task.status].label}
                </Badge>
                <span className="text-sm font-semibold">{task.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full", PROJECT_COLORS[project.color].bar)}
                  style={{ width: `${task.progress}%` }}
                />
              </div>

              {/* horas */}
              {(task.hours !== undefined || task.estHours) && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" />
                  <span>
                    {task.hours ?? 0}h invertidas
                    {task.estHours ? ` de ~${task.estHours}h estimadas` : ""}
                  </span>
                </div>
              )}
              {proj && (
                <div
                  className={cn(
                    "text-sm",
                    proj.late ? "text-amber-500" : "text-muted-foreground"
                  )}
                >
                  Proyección según historial:{" "}
                  {format(proj.projectedEnd, "d MMM yyyy", { locale: es })}
                  {proj.late && " (supera la fecha planificada)"}
                </div>
              )}

              {/* bloqueo */}
              {task.blocker && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  {task.blocker}
                </div>
              )}

              {/* dependencias */}
              {depNames && depNames.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Link2 className="size-3.5" /> Depende de
                  </div>
                  <ul className="space-y-1 text-sm">
                    {depNames.map((n, i) => (
                      <li key={i} className="text-muted-foreground">
                        · {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* notas */}
              {task.notes && (
                <p className="text-sm text-muted-foreground">{task.notes}</p>
              )}

              {/* historial de actualizaciones */}
              {task.updates && task.updates.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <History className="size-3.5" /> Historial
                    </div>
                    <ol className="relative space-y-3 border-l border-border pl-4">
                      {[...task.updates].reverse().map((u, i) => (
                        <li key={i} className="relative text-sm">
                          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                          <div className="text-[11px] text-muted-foreground">
                            {format(parseISO(u.date), "d MMM yyyy", {
                              locale: es,
                            })}
                          </div>
                          {u.text}
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}

              {/* sesiones de trabajo */}
              {taskSessions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sesiones registradas
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {taskSessions.slice(-6).reverse().map((s, i) => (
                        <li key={i}>
                          {format(parseISO(s.start), "d MMM HH:mm", {
                            locale: es,
                          })}{" "}
                          — {s.end === null ? "en curso…" : `${s.hours ?? 0}h`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
