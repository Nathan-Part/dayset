import { Component, type ReactNode, useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { exportData } from '../domain/backup'
import { type Copy, copiesDb, importFileKeepingCopy, listCopies, restoreCopy } from '../domain/copies'
import { dayKeyOf, todayOf } from '../domain/dates'
import { dayShort, timeOfDay } from '../lib/format'
import { saveTextFile } from '../lib/files'
import { btnGhost, btnPrimary } from './ui'

/**
 * Filet de sécurité : si l'app ne peut plus s'afficher (données abîmées, bug), on montre un écran de secours
 * au lieu d'une page blanche, avec de quoi revenir en arrière ou sauver ses données.
 */
export class CrashGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Affichage impossible', error)
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children
  }
}

function CrashScreen() {
  const [copies, setCopies] = useState<Omit<Copy, 'data'>[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listCopies(copiesDb).then(setCopies).catch(() => setCopies([]))
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      location.reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Opération impossible')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Un problème empêche l'affichage</h1>
      <p className="mt-2 text-muted">
        Tes données sont toujours sur ce téléphone. Tu peux revenir à une copie automatique, importer une sauvegarde, ou
        exporter tes données pour les garder.
      </p>

      {copies.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Copies automatiques</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {copies.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-[15px]">
                  {dayShort(c.day)} <span className="text-xs text-muted">{timeOfDay(c.createdAt)}</span>
                  {c.kind === 'beforeRestore' && <span className="block text-xs text-warn">état avant une restauration ou un import</span>}
                </span>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => void run(() => restoreCopy(db, copiesDb, c.id, todayOf(Date.now()), Date.now()))}
                >
                  Restaurer
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
          Importer un fichier de sauvegarde
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={async () => {
            try {
              await saveTextFile(`dayset-${dayKeyOf(Date.now())}.json`, await exportData(db))
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Export impossible')
            }
          }}
        >
          Exporter mes données
        </button>
        <button type="button" className={btnGhost} onClick={() => location.reload()}>
          Recharger l'app
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void run(async () => importFileKeepingCopy(db, copiesDb, await f.text(), todayOf(Date.now()), Date.now()))
        }}
      />
      {message && <p className="mt-4 text-sm text-bad">{message}</p>}
    </div>
  )
}
