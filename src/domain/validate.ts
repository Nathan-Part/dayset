/**
 * Contrôle d'une sauvegarde avant import, enregistrement par enregistrement.
 * Un fichier bien formé mais modifié à la main (routine sans fréquence, étapes qui ne sont pas une liste…)
 * pouvait empêcher l'app de s'afficher : on le refuse avant de toucher aux données.
 */

type Row = Record<string, unknown>
type Check = (v: unknown) => boolean

const str: Check = (v) => typeof v === 'string'
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v)
const bool: Check = (v) => typeof v === 'boolean'
const day: Check = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const hhmm: Check = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)
const oneOf = (...values: unknown[]): Check => (v) => values.includes(v)
const listOf = (item: Check): Check => (v) => Array.isArray(v) && v.every(item)

const frequency: Check = (v) => {
  if (!v || typeof v !== 'object') return false
  const f = v as Row
  if (f.type === 'daily') return true
  if (f.type === 'weekdays') return listOf((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)(f.weekdays)
  if (f.type === 'interval') return Number.isInteger(f.intervalDays) && (f.intervalDays as number) >= 1
  return false
}

const step: Check = (v) => !!v && typeof v === 'object' && str((v as Row).id) && str((v as Row).name) && optional(num)((v as Row).estimateMin)

/** Champ facultatif : absent (ou null), sinon du bon type. */
const optional = (check: Check): Check => (v) => v === undefined || v === null || check(v)

/** Pour chaque table : les champs obligatoires, puis les facultatifs. */
const SCHEMA: Record<string, { label: string; required: Record<string, Check>; optional?: Record<string, Check>; extra?: (r: Row) => string | null }> = {
  categories: {
    label: 'catégorie',
    required: { id: str, name: str, color: str, position: num },
    optional: { archivedAt: num },
  },
  tasks: {
    label: 'tâche',
    required: { id: str, name: str, status: oneOf('todo', 'done', 'deleted'), needsReview: bool, isUnplanned: bool, createdAt: num },
    optional: {
      categoryId: str, estimateMin: num, dueDate: day, time: hhmm, note: str, onSite: bool, reserveSince: day,
      reservePosition: num, doneDate: day, doneAt: num, deletedAt: num,
    },
  },
  subtasks: {
    label: 'étape de tâche',
    required: { id: str, taskId: str, name: str, status: oneOf('todo', 'done'), position: num },
    optional: { estimateMin: num, doneDate: day, doneAt: num, withTask: bool },
  },
  routines: {
    label: 'routine',
    required: { id: str, name: str, frequency, startDate: day, position: num, createdAt: num },
    optional: {
      optional: bool, onSite: bool, steps: listOf(step), categoryId: str, estimateMin: num, time: hhmm, note: str,
      endDate: day, archivedAt: num,
    },
  },
  pauses: {
    label: 'pause',
    required: { id: str, fromDate: day, origin: oneOf('manual', 'absence') },
    optional: { routineId: str, toDate: day },
  },
  entries: {
    label: 'passage',
    required: {
      id: str, kind: oneOf('task', 'routine'), date: day,
      status: oneOf('todo', 'done', 'not_done', 'postponed', 'skipped', 'deleted'), position: num,
    },
    optional: {
      taskId: str, routineId: str, scheduledDate: day, movedTo: (v) => v === 'reserve' || day(v), unplanned: bool,
      nameSnapshot: str, estimateMinSnapshot: num, categoryIdSnapshot: str, closedAt: num, doneAt: num, stepsDone: listOf(str),
    },
    extra: (r) => {
      if (r.kind === 'task' && !str(r.taskId)) return 'taskId'
      if (r.kind === 'routine' && !(str(r.routineId) && day(r.scheduledDate))) return 'routineId'
      return null
    },
  },
  sessions: {
    label: 'temps enregistré',
    required: { id: str, entryId: str, date: day, durationSec: (v) => num(v) && (v as number) >= 0, source: oneOf('timer', 'manual', 'quick'), running: oneOf(0, 1) },
    optional: { subtaskId: str, startAt: num, endAt: num },
  },
  meta: {
    label: 'réglage',
    required: { key: str },
    extra: (r) => {
      const v = r.value
      switch (r.key) {
        case 'capacityMin':
          return listOf((m) => num(m) && (m as number) >= 0)(v) && (v as unknown[]).length === 7 ? null : 'temps disponible'
        case 'onboarded':
          return bool(v) ? null : 'onboarded'
        case 'lastGeneratedDay':
          return optional(day)(v) ? null : 'lastGeneratedDay'
        case 'lastExport':
          return optional(num)(v) ? null : 'lastExport'
        case 'sleep':
          return v === null || (!!v && typeof v === 'object' && day((v as Row).day) && num((v as Row).at)) ? null : 'sleep'
        default:
          return null
      }
    },
  },
}

/** Retourne la première anomalie trouvée, en clair (ou null si tout est bon). */
export function findInvalidRow(tables: Record<string, unknown[]>): string | null {
  for (const [table, rows] of Object.entries(tables)) {
    const schema = SCHEMA[table]
    if (!schema) continue
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const where = `${schema.label} n° ${i + 1}`
      if (!row || typeof row !== 'object' || Array.isArray(row)) return where
      const r = row as Row
      for (const [field, check] of Object.entries(schema.required)) if (!check(r[field])) return `${where} (${field})`
      for (const [field, check] of Object.entries(schema.optional ?? {})) if (!optional(check)(r[field])) return `${where} (${field})`
      const bad = schema.extra?.(r)
      if (bad) return `${where} (${bad})`
    }
  }
  return null
}
