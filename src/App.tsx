import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Flag,
  Moon,
  Sun,
  Timer,
} from "lucide-react"

import { GanttChart } from "@/components/GanttChart"
import { TaskDetailSheet } from "@/components/TaskDetailSheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import data from "@/data/tasks.json"
import worklog from "@/data/worklog.json"
import {
  PROJECT_COLORS,
  STATUS_META,
  type GanttData,
  type GanttTask,
  type TaskStatus,
} from "@/lib/gantt"
import { cn } from "@/lib/utils"

const ganttData = data as GanttData
const sessions = worklog.sessions

const ZOOMS = [
  { label: "Mes", pxPerDay: 3 },
  { label: "Semana", pxPerDay: 8 },
  { label: "Día", pxPerDay: 22 },
]

function App() {
  const [projectFilter, setProjectFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")
  const [zoom, setZoom] = useState(1)
  const [dark, setDark] = useState(true)
  const [selected, setSelected] = useState<{
    task: GanttTask
    project: (typeof ganttData.projects)[number]
  } | null>(null)

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark")
    setDark((d) => !d)
  }

  const projects = useMemo(
    () =>
      ganttData.projects
        .filter((p) => projectFilter === "all" || p.id === projectFilter)
        .map((p) => ({
          ...p,
          tasks: p.tasks.filter(
            (t) => statusFilter === "all" || t.status === statusFilter
          ),
        }))
        .filter((p) => p.tasks.length > 0),
    [projectFilter, statusFilter]
  )

  const allTasks: GanttTask[] = ganttData.projects.flatMap((p) => p.tasks)
  const workTasks = allTasks.filter((t) => !t.milestone)
  const avgProgress = Math.round(
    workTasks.reduce((a, t) => a + t.progress, 0) / workTasks.length
  )
  const blocked = allTasks.filter((t) => t.status === "blocked").length
  const done = allTasks.filter((t) => t.status === "done").length
  const milestones = allTasks.filter(
    (t) => t.milestone && t.status !== "done"
  ).length
  const totalHours = Math.round(
    allTasks.reduce((a, t) => a + (t.hours ?? 0), 0)
  )

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
      <div className="min-h-svh bg-background">
        <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
          {/* header */}
          <header className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {ganttData.meta.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                Actualizado al{" "}
                {new Date(ganttData.meta.lastUpdated).toLocaleDateString(
                  "es-AR",
                  { day: "numeric", month: "long", year: "numeric" }
                )}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* project legend */}
              {ganttData.projects.map((p) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className="gap-1.5 rounded-full font-normal"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      PROJECT_COLORS[p.color].dot
                    )}
                  />
                  {p.name}
                </Badge>
              ))}
              <Separator orientation="vertical" className="mx-1 h-6" />
              <Button
                variant="outline"
                size="icon"
                onClick={toggleDark}
                aria-label="Cambiar tema"
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </header>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Kpi
              i={0}
              icon={<CalendarRange className="size-4 text-muted-foreground" />}
              title="Avance global"
              value={`${avgProgress}%`}
              hint={`${done} de ${allTasks.length} ítems completados`}
            />
            <Kpi
              i={1}
              icon={<CheckCircle2 className="size-4 text-emerald-500" />}
              title="En curso"
              value={String(
                allTasks.filter((t) => t.status === "in_progress").length
              )}
              hint="tareas activas ahora"
            />
            <Kpi
              i={2}
              icon={<AlertTriangle className="size-4 text-red-500" />}
              title="Bloqueadas"
              value={String(blocked)}
              hint="requieren acción externa"
            />
            <Kpi
              i={3}
              icon={<Flag className="size-4 text-indigo-400" />}
              title="Hitos pendientes"
              value={String(milestones)}
              hint="entregas clave por delante"
            />
            <Kpi
              i={4}
              icon={<Timer className="size-4 text-cyan-500" />}
              title="Horas invertidas"
              value={`${totalHours}h`}
              hint="registradas por sesiones de trabajo"
            />
          </div>

          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {ganttData.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center rounded-lg border p-0.5">
              {ZOOMS.map((z, i) => (
                <Button
                  key={z.label}
                  variant={zoom === i ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setZoom(i)}
                >
                  {z.label}
                </Button>
              ))}
            </div>
          </div>

          {/* gantt */}
          {projects.length > 0 ? (
            <GanttChart
              key={zoom}
              projects={projects}
              pxPerDay={ZOOMS[zoom].pxPerDay}
              sessions={sessions}
              markers={ganttData.markers ?? []}
              onSelect={(task, project) => setSelected({ task, project })}
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay tareas que coincidan con los filtros.
              </CardContent>
            </Card>
          )}

          {/* detalle de tarea */}
          <TaskDetailSheet
            task={selected?.task ?? null}
            project={selected?.project ?? null}
            sessions={sessions}
            allTasks={allTasks}
            onClose={() => setSelected(null)}
          />

          {/* legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Leyenda:</span>
            {Object.values(STATUS_META).map((s) => (
              <Badge
                key={s.label}
                variant="outline"
                className={cn("rounded-full text-[10px]", s.badge)}
              >
                {s.label}
              </Badge>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rotate-45 rounded-[2px] bg-muted-foreground/60" />
              Hito
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-6 border-t-2 border-dashed border-muted-foreground/60" />
              Dependencia
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3 text-amber-500" />
              Bloqueante externo
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function Kpi({
  icon,
  title,
  value,
  hint,
  i = 0,
}: {
  icon: React.ReactNode
  title: string
  value: string
  hint: string
  i?: number
}) {
  return (
    <Card
      className="enter-up"
      style={{ "--i": i } as React.CSSProperties}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

export default App
