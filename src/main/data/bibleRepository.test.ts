import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BibleRepository,
  clearBuiltinBibleCache,
  getLoadedBuiltinBibleCacheKeys
} from './bibleRepository'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<XMLBIBLE>
  <BIBLEBOOK bnumber="1" name="Génesis" sname="Gn">
    <CHAPTER cnumber="1">
      <VERS vnumber="1">En el principio creó Dios los cielos y la tierra.</VERS>
    </CHAPTER>
  </BIBLEBOOK>
</XMLBIBLE>`

describe('BibleRepository (carga perezosa y caché LRU)', () => {
  beforeEach(() => {
    clearBuiltinBibleCache()
  })

  it('listVersions() comprueba existencia sin cargar ni cachear ningún JSON en RAM', () => {
    const repo = new BibleRepository()
    const versions = repo.listVersions()

    expect(versions.length).toBeGreaterThanOrEqual(8)
    expect(versions.every((v) => v.builtIn && v.available)).toBe(true)
    expect(getLoadedBuiltinBibleCacheKeys()).toEqual([])
  })

  it('carga solo la versión activa bajo demanda y acota la caché LRU a 2 versiones', () => {
    const repo = new BibleRepository()

    // 1. Primera consulta: solo carga es_rvr.json
    const rvr = repo.getChapter('Salmos', 23, 'rvr1960')
    expect(rvr.length).toBe(6)
    expect(getLoadedBuiltinBibleCacheKeys()).toEqual(['es_rvr.json'])

    // 2. Segunda versión: mantiene ambas en caché
    const nvi = repo.getChapter('Salmos', 23, 'nvi')
    expect(nvi.length).toBe(6)
    expect(getLoadedBuiltinBibleCacheKeys()).toEqual(['es_rvr.json', 'es_nvi.json'])

    // 3. Re-acceder a rvr1960 la marca como más reciente antes de cargar una tercera versión
    repo.getChapter('Juan', 3, 'rvr1960')
    expect(getLoadedBuiltinBibleCacheKeys()).toEqual(['es_nvi.json', 'es_rvr.json'])

    const dhh = repo.getChapter('Salmos', 23, 'dhh')
    expect(dhh.length).toBe(6)
    expect(getLoadedBuiltinBibleCacheKeys()).toEqual(['es_rvr.json', 'es_dhh.json'])
  })

  it('gestiona versiones importadas y detecta archivo faltante en disco', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'lumen-bible-test-'))
    try {
      const repo = new BibleRepository(tempDir)
      const afterImport = repo.importVersion({
        name: 'Biblia Mi Iglesia',
        abbrev: 'BMI',
        content: SAMPLE_XML,
        fileName: 'bmi.xml'
      })

      const custom = afterImport.find((v) => v.id === 'biblia-mi-iglesia')
      expect(custom).toMatchObject({ name: 'Biblia Mi Iglesia', builtIn: false, available: true })

      const verses = repo.getChapter('Génesis', 1, 'biblia-mi-iglesia')
      expect(verses).toHaveLength(1)
      expect(verses[0]?.text).toContain('En el principio creó Dios')

      // Si se borra físicamente el JSON almacenado, listVersions refleja available: false sin fallar
      rmSync(join(tempDir, 'biblia-mi-iglesia.json'))
      const afterMissingFile = repo.listVersions().find((v) => v.id === 'biblia-mi-iglesia')
      expect(afterMissingFile?.available).toBe(false)

      repo.deleteVersion('biblia-mi-iglesia')
      expect(repo.listVersions().some((v) => v.id === 'biblia-mi-iglesia')).toBe(false)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})

