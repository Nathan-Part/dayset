import type { AppDB } from '../db'
import { findInvalidRow } from './validate'

// Identifiant interne des sauvegardes : il ne change pas avec le nom de l'app,
// sinon les fichiers déjà exportés seraient refusés.
const APP = 'ma-journee'
const VERSION = 1

const DAMAGED = "Ce fichier est abîmé : rien n'a été modifié."

/** Toutes les données dans un fichier JSON lisible : ta seconde sécurité. */
export async function exportData(d: AppDB): Promise<string> {
  const tables: Record<string, unknown[]> = {}
  for (const t of d.tables) tables[t.name] = await t.toArray()
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: new Date().toISOString(), tables }, null, 1)
}

/** Remplace toutes les données locales par celles du fichier. Tout ou rien. */
export async function importData(d: AppDB, json: string): Promise<{ rows: number }> {
  let data: { app?: string; version?: number; tables?: Record<string, unknown[]> }
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.")
  }
  if (data.app !== APP || !data.tables || typeof data.tables !== 'object') {
    throw new Error("Ce fichier n'est pas une sauvegarde de l'application.")
  }
  if (data.version !== VERSION) throw new Error('Version de sauvegarde non prise en charge.')
  const tables = data.tables
  const names = new Set(d.tables.map((t) => t.name))
  for (const [name, rows] of Object.entries(tables)) {
    if (!names.has(name) || !Array.isArray(rows)) throw new Error(`Table inconnue ou invalide : ${name}`)
  }
  // un export contient toujours toutes les tables : un fichier incomplet effacerait des données
  if (d.tables.some((t) => !Array.isArray(tables[t.name]))) throw new Error(`Sauvegarde incomplète. ${DAMAGED}`)
  // contenu de chaque enregistrement : un fichier trafiqué pourrait empêcher l'app de s'afficher
  const invalid = findInvalidRow(tables)
  if (invalid) throw new Error(`Donnée invalide : ${invalid}. ${DAMAGED}`)
  let rows = 0
  try {
    await d.transaction('rw', d.tables, async () => {
      for (const t of d.tables) {
        await t.clear()
        const list = tables[t.name]
        if (list.length) await t.bulkAdd(list as never[])
        rows += list.length
      }
    })
  } catch {
    // doublon, identifiant manquant… : la transaction est annulée, les données en place restent
    throw new Error(DAMAGED)
  }
  return { rows }
}
