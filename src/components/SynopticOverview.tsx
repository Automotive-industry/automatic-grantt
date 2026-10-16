import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Layers,
  Rocket,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PROJECT_COLORS,
  STATUS_META,
  type GanttProject,
  type GanttTask,
  type WorklogSession,
} from "@/lib/gantt"
import { cn } from "@/lib/utils"

interface SynopticOverviewProps {
  projects: GanttProject[]
  sessions: WorklogSession[]
  onSelect: (task: GanttTask, project: GanttProject) => void
}

interface FlatUpdate {
  date: string
  text: string
  task: GanttTask
  project: GanttProject
  order: number
}

export function SynopticOverview({
  projects,
  sessions,
  onSelect,
}: SynopticOverviewProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showAllUpdates, setShowAllUpdates] = useState(false)
  const [showPendingTasks, setShowPendingTasks] = useState<
    Record<string, boolean>
  >({})
  const [expandedTaskIds, setExpandedTaskIds] = useState<
    Record<string, boolean>
  >({ "wv-monitor": true })
  const [selectedReleaseByProject, setSelectedReleaseByProject] = useState<
    Record<string, string>
  >({})

  // Recopilar todos los avances de tareas (excluyendo copias en releases) ordenados del más reciente al más antiguo
  const allUpdates = useMemo(() => {
    const list: FlatUpdate[] = []
    let order = 0
    for (const project of projects) {
      for (const task of project.tasks) {
        if (task.release) continue
        for (const u of task.updates ?? []) {
          list.push({
            date: u.date,
            text: u.text,
            task,
            project,
            order: order++,
          })
        }
      }
    }
    return list.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date)
      return cmp !== 0 ? cmp : b.order - a.order
    })
  }, [projects])

  const visibleUpdates = showAllUpdates ? allUpdates : allUpdates.slice(0, 5)

  const shortVersion = (t: GanttTask) =>
    t.name.match(/^v[\w.\-]+/i)?.[0] ?? t.name

  const fmtHours = (h?: number) => {
    if (h === undefined) return "0h"
    return Number.isInteger(h) ? `${h}h` : `${Number(h.toFixed(2))}h`
  }

  return (
    <Card className="border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 py-3.5 px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Layers className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">
              Cuadro Sinóptico — Últimos Avances, Versiones y Horas Dedicadas
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Resumen ejecutivo de los últimos cambios desarrollados, evolución
              de versiones y desglose de horas por tarea
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Expandir cuadro" : "Ocultar cuadro"}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </Button>
      </CardHeader>

      {!collapsed && (
        <CardContent className="grid gap-6 p-5 lg:grid-cols-12">
          {/* COLUMNA IZQUIERDA: ÚLTIMOS 5 AVANCES */}
          <div className="space-y-3 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
                <Sparkles className="size-3.5 text-primary" />
                Últimos {showAllUpdates ? allUpdates.length : 5} avances
                desarrollados
              </div>
              {allUpdates.length > 5 && (
                <button
                  onClick={() => setShowAllUpdates((s) => !s)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {showAllUpdates
                    ? "Ver solo los últimos 5"
                    : `Ver todos (${allUpdates.length})`}
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {visibleUpdates.map((item, idx) => {
                const colors = PROJECT_COLORS[item.project.color]
                const taskSessions = sessions.filter(
                  (s) => s.taskId === item.task.id && s.end !== null
                )
                return (
                  <div
                    key={`${item.task.id}-${item.date}-${idx}`}
                    onClick={() => onSelect(item.task, item.project)}
                    className="group cursor-pointer rounded-lg border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="h-5 rounded bg-background/80 px-1.5 font-mono text-[10px] font-semibold text-foreground/80"
                        >
                          {format(parseISO(item.date), "d MMM yyyy", {
                            locale: es,
                          })}
                        </Badge>
                        <span
                          className={cn("size-2 rounded-full", colors.dot)}
                        />
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary">
                          {item.task.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/80">
                          <Clock className="size-2.5 text-cyan-400" />
                          {fmtHours(item.task.hours)}
                          {item.task.estHours ? `/${item.task.estHours}h` : ""}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-emerald-400">
                          {item.task.progress}%
                        </span>
                        {taskSessions.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            ({taskSessions.length} ses.)
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground/90">
                      {item.text}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* COLUMNA DERECHA: CUADRO SINÓPTICO POR PROYECTO (VERSIONES + HORAS Y COSAS DESARROLLADAS) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
              <History className="size-3.5 text-primary" />
              Sinóptico por Proyecto — Versiones, Horas y Desarrollos
            </div>

            <div className="space-y-4">
              {projects.map((project) => {
                const colors = PROJECT_COLORS[project.color]
                const workTasks = project.tasks.filter((t) => !t.release)
                const releases = project.tasks
                  .filter((t) => t.release)
                  .sort((a, b) => a.end.localeCompare(b.end))

                const totalSpent = workTasks.reduce(
                  (a, t) => a + (t.hours ?? 0),
                  0
                )
                const totalEst = workTasks.reduce(
                  (a, t) => a + (t.estHours ?? t.hours ?? 0),
                  0
                )
                const avgProg = workTasks.length
                  ? Math.round(
                      workTasks.reduce((a, t) => a + t.progress, 0) /
                        workTasks.length
                    )
                  : 0

                const defaultRel =
                  releases.filter((r) => r.status === "done").slice(-1)[0] ??
                  releases[releases.length - 1]
                const activeRelId =
                  selectedReleaseByProject[project.id] ?? defaultRel?.id
                const activeRelease = releases.find((r) => r.id === activeRelId)

                const developedTasks = workTasks.filter(
                  (t) =>
                    (t.hours ?? 0) > 0 ||
                    (t.updates?.length ?? 0) > 0 ||
                    t.status === "done" ||
                    t.status === "in_progress"
                )
                const pendingTasks = workTasks.filter(
                  (t) => !developedTasks.includes(t)
                )
                const showPending = !!showPendingTasks[project.id]
                const tasksToRender = showPending
                  ? [...developedTasks, ...pendingTasks]
                  : developedTasks

                return (
                  <div
                    key={project.id}
                    className="rounded-lg border border-border/80 bg-muted/15 p-3.5 space-y-3.5"
                  >
                    {/* Cabecera del proyecto */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("size-2.5 rounded-full", colors.dot)}
                        />
                        <span className={cn("text-sm font-bold", colors.text)}>
                          {project.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px] font-semibold"
                        >
                          {avgProg}% avance
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 font-mono font-semibold text-foreground">
                          <Clock className="size-3.5 text-cyan-400" />
                          {fmtHours(totalSpent)} invertidas
                          <span className="font-normal text-muted-foreground">
                            / {fmtHours(totalEst)} est.
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Tira de Versiones / Releases del proyecto */}
                    {releases.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Versiones / Hitos de lanzamiento ({releases.length})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Clic en una versión para ver qué se desarrolló
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {releases.map((rel) => {
                            const isSelected = rel.id === activeRelease?.id
                            return (
                              <button
                                key={rel.id}
                                onClick={() =>
                                  setSelectedReleaseByProject((prev) => ({
                                    ...prev,
                                    [project.id]: rel.id,
                                  }))
                                }
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/25",
                                  rel.status !== "done" && "opacity-75 border-dashed"
                                )}
                              >
                                <Rocket className="size-3" />
                                <span>{shortVersion(rel)}</span>
                                <span
                                  className={cn(
                                    "text-[10px] font-normal",
                                    isSelected
                                      ? "text-primary-foreground/80"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  ·{" "}
                                  {format(parseISO(rel.end), "d MMM", {
                                    locale: es,
                                  })}
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        {/* Detalle de la versión seleccionada */}
                        {activeRelease && (
                          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <Rocket className="size-3.5 text-primary" />
                                {activeRelease.name}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {format(
                                    parseISO(activeRelease.end),
                                    "d MMM yyyy",
                                    { locale: es }
                                  )}
                                </span>
                                <button
                                  onClick={() =>
                                    onSelect(activeRelease, project)
                                  }
                                  className="text-[11px] font-medium text-primary hover:underline"
                                >
                                  Abrir panel →
                                </button>
                              </div>
                            </div>
                            {activeRelease.notes && (
                              <p className="text-muted-foreground">
                                {activeRelease.notes}
                              </p>
                            )}
                            {activeRelease.updates &&
                            activeRelease.updates.length > 0 ? (
                              <ul className="space-y-1 pt-1 text-muted-foreground">
                                {activeRelease.updates.map((u, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-1.5 leading-relaxed"
                                  >
                                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                    <span>{u.text}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] italic text-muted-foreground">
                                Hito futuro planificado para el{" "}
                                {format(
                                  parseISO(activeRelease.end),
                                  "d MMM yyyy",
                                  { locale: es }
                                )}
                                .
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Desglose sinóptico de tareas: Horas dedicadas + Cosas desarrolladas */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Tareas desarrolladas y horas dedicadas
                        </span>
                        {pendingTasks.length > 0 && (
                          <button
                            onClick={() =>
                              setShowPendingTasks((p) => ({
                                ...p,
                                [project.id]: !p[project.id],
                              }))
                            }
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            {showPending
                              ? "Ocultar pendientes sin horas"
                              : `+ Ver ${pendingTasks.length} pendientes`}
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-border/50 rounded-md border border-border/60 bg-background/60">
                        {tasksToRender.map((t) => {
                          const meta = STATUS_META[t.status]
                          const isExpanded = !!expandedTaskIds[t.id]
                          const updatesCount = t.updates?.length ?? 0
                          const taskSessions = sessions.filter(
                            (s) => s.taskId === t.id && s.end !== null
                          )

                          return (
                            <div key={t.id} className="p-2.5 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {updatesCount > 0 ? (
                                    <button
                                      onClick={() =>
                                        setExpandedTaskIds((prev) => ({
                                          ...prev,
                                          [t.id]: !prev[t.id],
                                        }))
                                      }
                                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                      title="Ver/ocultar detalle de cambios"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="size-3.5" />
                                      ) : (
                                        <ChevronRight className="size-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="w-4" />
                                  )}
                                  <button
                                    onClick={() => onSelect(t, project)}
                                    className="truncate font-semibold text-foreground hover:text-primary text-left"
                                  >
                                    {t.name}
                                  </button>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "h-4 rounded-full px-1.5 text-[9px]",
                                      meta.badge
                                    )}
                                  >
                                    {meta.label}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {updatesCount > 0 && (
                                    <button
                                      onClick={() =>
                                        setExpandedTaskIds((prev) => ({
                                          ...prev,
                                          [t.id]: !prev[t.id],
                                        }))
                                      }
                                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                                    >
                                      {updatesCount}{" "}
                                      {updatesCount === 1
                                        ? "cambio"
                                        : "cambios"}
                                    </button>
                                  )}
                                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                                    <Clock className="size-3 text-cyan-400" />
                                    {fmtHours(t.hours)}
                                    {t.estHours ? (
                                      <span className="font-normal text-muted-foreground">
                                        /{t.estHours}h
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="w-8 text-right font-mono text-[11px] font-semibold text-muted-foreground">
                                    {t.progress}%
                                  </span>
                                </div>
                              </div>

                              {t.notes && (
                                <p className="mt-1 pl-5 text-[11px] text-muted-foreground">
                                  {t.notes}
                                </p>
                              )}

                              {isExpanded && t.updates && t.updates.length > 0 && (
                                <div className="mt-2 ml-5 space-y-1.5 border-l-2 border-primary/40 pl-3">
                                  {[...t.updates].reverse().map((u, i) => (
                                    <div
                                      key={i}
                                      className="text-[11px] leading-relaxed text-muted-foreground"
                                    >
                                      <span className="mr-1.5 font-mono text-[10px] font-semibold text-foreground/80">
                                        [
                                        {format(parseISO(u.date), "dd/MM", {
                                          locale: es,
                                        })}
                                        ]
                                      </span>
                                      {u.text}
                                    </div>
                                  ))}
                                  {taskSessions.length > 0 && (
                                    <div className="pt-1 text-[10px] text-muted-foreground/80">
                                      Sesiones medidas en worklog:{" "}
                                      {taskSessions.length} (
                                      {fmtHours(
                                        taskSessions.reduce(
                                          (a, s) => a + (s.hours ?? 0),
                                          0
                                        )
                                      )}{" "}
                                      cronometradas)
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
