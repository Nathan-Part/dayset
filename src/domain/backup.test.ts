import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppDB } from '../db'
import { saveTextFile } from '../lib/files'
import { addSubtask, addTask, createRoutine } from './actions'
import { exportData, importData } from './backup'
import { CopiesDB, copyData, importFileKeepingCopy, listCopies } from './copies'
import { dayKeyOf } from './dates'

const MON = '2026-11-09'
const at = (h = 9, m = 0) => new Date(2026, 10, 9, h, m).getTime()
const uid = () => Math.random().toString(36).slice(2)
const strip = (j: string) => {
  const o = JSON.parse(j)
  delete o.exportedAt
  return JSON.stringify(o)
}

let db: AppDB
let c: CopiesDB
beforeEach(async () => {
  db = new AppDB(`bk-${uid()}`)
  c = new CopiesDB(`bkc-${uid()}`)
  const id = await addTask(db, { name: 'Dossier', plan: MON, estimateMin: 30 }, at())
  await addSubtask(db, id, { name: 'Relire', estimateMin: 10 })
  await createRoutine(db, { name: 'Sport', frequency: { type: 'daily' }, startDate: MON }, at())
})

describe('sauvegarde : export puis import', () => {
  it('un autre appareil retrouve exactement les mêmes données', async () => {
    const json = await exportData(db)
    const other = new AppDB(`bk-${uid()}`)
    const { rows } = await importData(other, json)
    expect(strip(await exportData(other))).toBe(strip(json))
    expect(rows).toBe(Object.values(JSON.parse(json).tables as Record<string, unknown[]>).reduce((n, t) => n + t.length, 0))
  })
})

describe('sauvegarde : un fichier abîmé ne touche à rien', () => {
  const broken = async (mutate: (data: { tables: Record<string, unknown[]> }) => void) => {
    const data = JSON.parse(await exportData(db))
    mutate(data)
    return JSON.stringify(data)
  }

  it('fichier sans aucune table : refusé (il effaçait tout)', async () => {
    const before = await exportData(db)
    await expect(importData(db, await broken((d) => (d.tables = {})))).rejects.toThrow('Sauvegarde incomplète')
    expect(strip(await exportData(db))).toBe(strip(before))
  })

  it('une table manquante : refusé', async () => {
    const before = await exportData(db)
    await expect(importData(db, await broken((d) => delete d.tables.routines))).rejects.toThrow('Sauvegarde incomplète')
    expect(strip(await exportData(db))).toBe(strip(before))
  })

  it('doublon : message en français, données intactes', async () => {
    const before = await exportData(db)
    const json = await broken((d) => d.tables.tasks.push(d.tables.tasks[0]))
    await expect(importData(db, json)).rejects.toThrow("Ce fichier est abîmé : rien n'a été modifié.")
    expect(strip(await exportData(db))).toBe(strip(before))
  })

  it('enregistrement sans identifiant : message en français, données intactes', async () => {
    const before = await exportData(db)
    const json = await broken((d) => d.tables.tasks.push({ name: 'sans id' }))
    await expect(importData(db, json)).rejects.toThrow("Ce fichier est abîmé : rien n'a été modifié.")
    expect(strip(await exportData(db))).toBe(strip(before))
  })
})

describe('import d\'un fichier : l\'état actuel est gardé dans le tiroir', () => {
  it('on peut revenir à ce qu\'on avait avant l\'import', async () => {
    const mine = await exportData(db)
    const old = new AppDB(`bk-${uid()}`)
    await addTask(old, { name: 'Vieille tâche', plan: 'reserve' }, at())
    await importFileKeepingCopy(db, c, await exportData(old), MON, at(10))

    expect((await db.tasks.toArray()).map((t) => t.name)).toEqual(['Vieille tâche'])
    const copies = await listCopies(c)
    expect(copies).toHaveLength(1)
    expect(copies[0].kind).toBe('beforeRestore')
    expect(strip((await copyData(c, copies[0].id))!)).toBe(strip(mine))
  })

  it('import refusé : pas de copie inutile, rien de changé', async () => {
    const before = await exportData(db)
    await expect(importFileKeepingCopy(db, c, '{"app":"autre"}', MON, at(10))).rejects.toThrow()
    expect(await listCopies(c)).toHaveLength(0)
    expect(strip(await exportData(db))).toBe(strip(before))
  })
})

describe('enregistrement du fichier exporté', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('feuille de partage validée : export fait', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.resolve() })
    expect(await saveTextFile('a.json', '{}')).toBe(true)
  })

  it('feuille de partage fermée sans enregistrer : ce n\'est pas un export', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(new DOMException('annulé', 'AbortError')) })
    expect(await saveTextFile('a.json', '{}')).toBe(false)
  })

  it('le nom du fichier prend la date locale, même juste après minuit', () => {
    // 0 h 30 heure locale : en UTC c'est parfois encore la veille
    expect(dayKeyOf(new Date(2026, 10, 24, 0, 30).getTime())).toBe('2026-11-24')
  })
})
