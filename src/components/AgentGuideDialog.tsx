import { CircleHelp, Copy } from "lucide-react"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const TRACKER = "C:\\Users\\ax24611\\Downloads\\_dev\\Grantt"

const COMMANDS: [string, string][] = [
  ["list", "ver tareas e IDs"],
  ["start <id>", "empezar a trabajar (inicia el timer)"],
  ["stop <id> --progress N", "cerrar sesión, suma horas automáticas"],
  ["status <id> <done|in_progress|pending|blocked>", "cambiar estado"],
  ["log <id> \"qué cambió\"", "entrada al historial de la tarea"],
  ["blocker <id> \"motivo\" / unblock <id>", "marcar/liberar bloqueo"],
  ["estimate <id> <horas>", "estimar horas de una tarea"],
  ["add <proyecto> \"Nombre\" --start D --end D [--deps ids] [--est N]", "crear tarea"],
  ["release <proyecto> \"vX.Y — nombre\"", "versión + changelog automático"],
  ["marker \"texto\" --date D / unmarker <id>", "stopper con letrero"],
  ["help", "esta ayuda desde la terminal"],
]

const AGENTS_SNIPPET = `## Tracker Gantt
Este proyecto está traqueado en el tablero Gantt del usuario
(${TRACKER}). Al empezar/terminar trabajo traqueable, reportar con:
node ${TRACKER}\\scripts\\update-tracker.mjs <cmd>
Comandos: list | start <id> | stop <id> --progress N | status |
blocker | release | log <id> "avance" | marker "texto" --date D`

export function AgentGuideDialog() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(AGENTS_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground">
          <CircleHelp className="size-3" />
          guía para agentes
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cómo reportan los agentes</DialogTitle>
          <DialogDescription>
            Los agentes (Devin, Codex) actualizan este tablero ejecutando el
            script del tracker — nunca editan el JSON a mano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Comando base
            </p>
            <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
              node {TRACKER}\scripts\update-tracker.mjs &lt;comando&gt;
            </code>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Comandos
            </p>
            <ul className="space-y-1">
              {COMMANDS.map(([cmd, desc]) => (
                <li key={cmd} className="flex items-baseline gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    {cmd}
                  </code>
                  <span className="text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Cada comando actualiza la fecha, regenera el build y copia el HTML a
            la carpeta de SharePoint automáticamente. Con <code>--push</code>{" "}
            además publica a GitHub Pages. Con <code>--no-build</code> saltea el
            rebuild (para encadenar varios comandos).
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Snippet para el AGENTS.md de cada proyecto
              </p>
              <button
                onClick={copy}
                className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
              >
                <Copy className="size-3" />
                {copied ? "copiado" : "copiar"}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {AGENTS_SNIPPET}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
