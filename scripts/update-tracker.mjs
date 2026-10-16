#!/usr/bin/env node
// update-tracker.mjs — CLI para que agentes (Devin/Codex) actualicen el tablero Gantt.
// Uso: node scripts/update-tracker.mjs <comando> [args] [--no-build] [--push]
// Comandos:
//   list                                  Lista tareas (id | estado | % | horas)
//   status <taskId> <done|in_progress|pending|blocked>
//   progress <taskId> <0-100>
//   note <taskId> "texto"
//   log <taskId> "texto"                   Entrada en el historial de la tarea
//   blocker <taskId> "motivo"              Pone status=blocked + blocker
//   unblock <taskId>
//   dates <taskId> <YYYY-MM-DD> <YYYY-MM-DD>
//   estimate <taskId> <horas>
//   hours <taskId> <horas>                 Suma horas manuales
//   start <taskId>                         Abre sesión de trabajo (timer)
//   stop <taskId> [--progress N]           Cierra sesión y suma horas automáticas
//   add <projectId> "Nombre" --start D --end D [--deps a,b] [--est N] [--milestone]
//   release <projectId> "vX.Y — nombre" [--date D]  Hito de release + changelog auto desde la release anterior
//   marker "texto" [--date YYYY-MM-DD]     Stopper: línea vertical con letrero
//   unmarker <markerId>
//   remove <taskId>                        Elimina una tarea
//   build                                  Rebuild + copia a shareDir (gantt.config.json)

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const TASKS_FILE = path.join(ROOT, "src/data/tasks.json")
const WORKLOG_FILE = path.join(ROOT, "src/data/worklog.json")
const CONFIG_FILE = path.join(ROOT, "gantt.config.json")

const STATUSES = ["done", "in_progress", "pending", "blocked"]
const today = () => new Date().toISOString().slice(0, 10)
const now = () => new Date().toISOString()

const args = process.argv.slice(2)
const flags = {}
const positional = []
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2)
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next
      i++
    } else {
      flags[key] = true
    }
  } else {
    positional.push(args[i])
  }
}
const [command, ...rest] = positional

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback
  return JSON.parse(readFileSync(file, "utf8"))
}
function saveJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8")
}

const data = loadJson(TASKS_FILE, null)
if (!data) fail(`No se encontró ${TASKS_FILE}`)
const worklog = loadJson(WORKLOG_FILE, { sessions: [] })

function findTask(id) {
  for (const p of data.projects) {
    const t = p.tasks.find((t) => t.id === id)
    if (t) return { task: t, project: p }
  }
  return null
}

function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
}

function requireTask(id) {
  if (!id) fail("Falta <taskId>")
  const found = findTask(id)
  if (!found) fail(`Task no encontrada: ${id}. Usá 'list' para ver IDs.`)
  return found
}

function requireProject(id) {
  const p = data.projects.find((p) => p.id === id)
  if (!p)
    fail(`Proyecto no encontrado: ${id}. IDs: ${data.projects.map((p) => p.id).join(", ")}`)
  return p
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

let mutated = true
let message = ""

switch (command) {
  case "list": {
    mutated = false
    for (const p of data.projects) {
      console.log(`\n${p.name} [${p.id}]`)
      for (const t of p.tasks) {
        const h = t.hours ? ` ${t.hours}h` : ""
        const e = t.estHours ? `/${t.estHours}h` : ""
        const ms = t.milestone ? (t.release ? " 🚀" : " ◆") : ""
        console.log(
          `  ${t.id.padEnd(16)} ${t.status.padEnd(11)} ${String(t.progress).padStart(3)}%${h}${e}${ms}`
        )
      }
    }
    break
  }
  case "status": {
    const { task } = requireTask(rest[0])
    if (!STATUSES.includes(rest[1]))
      fail(`Estado inválido: ${rest[1]}. Válidos: ${STATUSES.join(", ")}`)
    task.status = rest[1]
    if (rest[1] === "done") task.progress = 100
    if (rest[1] === "blocked" && !task.blocker)
      task.blocker = "Bloqueado (sin detalle)"
    message = `${task.id} → ${rest[1]}`
    break
  }
  case "progress": {
    const { task } = requireTask(rest[0])
    const n = Number(rest[1])
    if (!Number.isFinite(n) || n < 0 || n > 100) fail("Progreso debe ser 0-100")
    task.progress = Math.round(n)
    if (n === 100) task.status = "done"
    message = `${task.id} → ${task.progress}%`
    break
  }
  case "note": {
    const { task } = requireTask(rest[0])
    if (!rest[1]) fail("Falta el texto de la nota")
    task.notes = rest[1]
    message = `${task.id} nota actualizada`
    break
  }
  case "log": {
    const { task } = requireTask(rest[0])
    if (!rest[1]) fail("Falta el texto del historial")
    task.updates = task.updates ?? []
    task.updates.push({ date: today(), text: rest[1] })
    message = `${task.id} + historial: "${rest[1].slice(0, 40)}…"`
    break
  }
  case "blocker": {
    const { task } = requireTask(rest[0])
    if (!rest[1]) fail("Falta el motivo del bloqueo")
    task.blocker = rest[1]
    task.status = "blocked"
    message = `${task.id} bloqueado: ${rest[1]}`
    break
  }
  case "unblock": {
    const { task } = requireTask(rest[0])
    delete task.blocker
    if (task.status === "blocked")
      task.status = task.progress > 0 ? "in_progress" : "pending"
    message = `${task.id} desbloqueado`
    break
  }
  case "dates": {
    const { task } = requireTask(rest[0])
    if (!isDate(rest[1]) || !isDate(rest[2])) fail("Fechas en formato YYYY-MM-DD")
    task.start = rest[1]
    task.end = rest[2]
    message = `${task.id} → ${rest[1]} → ${rest[2]}`
    break
  }
  case "estimate": {
    const { task } = requireTask(rest[0])
    const n = Number(rest[1])
    if (!Number.isFinite(n) || n <= 0) fail("Estimado debe ser > 0")
    task.estHours = n
    message = `${task.id} estimado ${n}h`
    break
  }
  case "hours": {
    const { task } = requireTask(rest[0])
    const n = Number(rest[1])
    if (!Number.isFinite(n) || n <= 0) fail("Horas deben ser > 0")
    task.hours = Math.round(((task.hours ?? 0) + n) * 100) / 100
    worklog.sessions.push({
      taskId: task.id,
      start: now(),
      end: now(),
      hours: n,
      manual: true,
    })
    message = `${task.id} +${n}h (total ${task.hours}h)`
    break
  }
  case "start": {
    const { task } = requireTask(rest[0])
    const open = worklog.sessions.find((s) => s.taskId === task.id && !s.end)
    if (open) fail(`Ya hay una sesión abierta para ${task.id} desde ${open.start}`)
    worklog.sessions.push({ taskId: task.id, start: now(), end: null })
    if (task.status === "pending") task.status = "in_progress"
    message = `Sesión iniciada en ${task.id}`
    break
  }
  case "stop": {
    const { task } = requireTask(rest[0])
    const open = worklog.sessions.find((s) => s.taskId === task.id && !s.end)
    if (!open) fail(`No hay sesión abierta para ${task.id}. Usá 'start' primero.`)
    open.end = now()
    open.hours =
      Math.round(((new Date(open.end) - new Date(open.start)) / 3600000) * 100) /
      100
    task.hours = Math.round(((task.hours ?? 0) + open.hours) * 100) / 100
    if (flags.progress !== undefined && flags.progress !== true) {
      const n = Number(flags.progress)
      if (Number.isFinite(n)) {
        task.progress = Math.min(100, Math.max(0, Math.round(n)))
        if (task.progress === 100) task.status = "done"
      }
    }
    message = `Sesión cerrada en ${task.id}: +${open.hours}h (total ${task.hours}h)`
    break
  }
  case "add": {
    const project = requireProject(rest[0])
    const name = rest[1]
    if (!name) fail(`Falta el nombre de la tarea`)
    const start = flags.start || today()
    const end = flags.end || start
    if (!isDate(start) || !isDate(end)) fail("Fechas --start/--end en YYYY-MM-DD")
    const id = `${project.id.slice(0, 2)}-${slug(name)}`
    if (findTask(id)) fail(`Ya existe una tarea con id ${id}`)
    const task = {
      id,
      name,
      status: "pending",
      progress: 0,
      start,
      end,
      ...(flags.deps ? { deps: String(flags.deps).split(",") } : {}),
      ...(flags.milestone ? { milestone: true } : {}),
      ...(flags.est ? { estHours: Number(flags.est) } : {}),
    }
    project.tasks.push(task)
    message = `Creada ${id} en ${project.id}`
    break
  }
  case "release": {
    const project = requireProject(rest[0])
    const name = rest[1]
    if (!name) fail(`Falta el nombre de la release, ej: "v1.2 — Piloto COL"`)
    const id = `${project.id.slice(0, 2)}-rel-${slug(name)}`
    if (findTask(id)) fail(`Ya existe ${id}`)
    const date = flags.date || today()
    if (!isDate(date)) fail("Fecha --date en YYYY-MM-DD")

    // Changelog automático: updates de las tareas desde la release anterior
    const prevRelease = [...project.tasks]
      .reverse()
      .find((t) => t.release)
    const since = prevRelease ? prevRelease.end : "0000-01-01"
    const updates = []
    for (const t of project.tasks) {
      if (t.release) continue
      for (const u of t.updates ?? []) {
        if (u.date >= since && u.date <= date)
          updates.push({ date: u.date, text: `${t.name}: ${u.text}` })
      }
    }
    updates.sort((a, b) => a.date.localeCompare(b.date))

    project.tasks.push({
      id,
      name,
      status: "done",
      progress: 100,
      start: date,
      end: date,
      milestone: true,
      release: true,
      updates,
    })
    message = `Release ${name} en ${project.id} (${date}) con ${updates.length} entradas de changelog`
    break
  }
  case "marker": {
    const label = rest[0]
    if (!label) fail(`Falta el texto del marker`)
    const date = flags.date || today()
    if (!isDate(date)) fail("Fecha --date en YYYY-MM-DD")
    data.markers = data.markers ?? []
    const id = `mk-${data.markers.length + 1}-${slug(label)}`
    if (data.markers.find((m) => m.id === id)) fail(`Ya existe marker ${id}`)
    data.markers.push({ id, date, label })
    message = `Marker "${label}" en ${date}`
    break
  }
  case "unmarker": {
    if (!rest[0]) fail("Falta <markerId>")
    const before = (data.markers ?? []).length
    data.markers = (data.markers ?? []).filter((m) => m.id !== rest[0])
    if (data.markers.length === before) fail(`Marker no encontrado: ${rest[0]}`)
    message = `Marker ${rest[0]} eliminado`
    break
  }
  case "remove": {
    const { task, project } = requireTask(rest[0])
    project.tasks = project.tasks.filter((t) => t.id !== task.id)
    for (const p of data.projects)
      for (const t of p.tasks)
        if (t.deps) t.deps = t.deps.filter((d) => d !== task.id)
    message = `Eliminada ${task.id}`
    break
  }
  case "build": {
    mutated = false
    message = "Build manual"
    break
  }
  case "help": {
    mutated = false
    const header = readFileSync(import.meta.filename, "utf8")
    const usage = header.slice(
      header.indexOf("// Uso:"),
      header.indexOf("\n\nimport")
    )
    console.log(usage.replace(/^\/\/ ?/gm, ""))
    break
  }
  default:
    fail(
      `Comando desconocido: ${command ?? "(vacío)"}. Ver comandos en el encabezado del script.`
    )
}

if (mutated) {
  data.meta.lastUpdated = today()
  saveJson(TASKS_FILE, data)
  saveJson(WORKLOG_FILE, worklog)
  console.log(`✓ ${message}`)
}

// Rebuild + copia a carpeta compartida (salvo --no-build)
if (flags["no-build"] !== true && command !== "list" && command !== "help") {
  try {
    console.log("→ Building…")
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" })
    const cfg = loadJson(CONFIG_FILE, {})
    if (cfg.shareDir) {
      mkdirSync(cfg.shareDir, { recursive: true })
      copyFileSync(
        path.join(ROOT, "dist/index.html"),
        path.join(cfg.shareDir, "index.html")
      )
      console.log(`✓ Copiado a ${cfg.shareDir}`)
    }
  } catch (e) {
    console.error("✗ Build/copy falló:", e.message)
    process.exit(1)
  }
}

// Commit + push opcional (dispara deploy en GitHub Pages)
if (flags.push) {
  try {
    execSync("git add -A", { cwd: ROOT, stdio: "inherit" })
    execSync(`git commit -m "tracker: ${message.replace(/"/g, "'")}"`, {
      cwd: ROOT,
      stdio: "inherit",
    })
    execSync("git push", { cwd: ROOT, stdio: "inherit" })
    console.log("✓ Pushed — GitHub Pages redeploya en ~1 min")
  } catch (e) {
    console.error("✗ git push falló:", e.message)
  }
}
