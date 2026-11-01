import { describe, expect, it } from 'vitest'
import { parseZefaniaXml, suggestVersionName } from './bibleImport'

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<XMLBIBLE>
 <BIBLEBOOK bnumber="1" name="Génesis" sname="Gn">
 <CHAPTER cnumber="1">
 <VERS vnumber="1">En el principio creó Dios los cielos y la tierra.</VERS>
 <VERS vnumber="2">Y la tierra estaba desordenada y vacía, y había <FI>tinieblas</FI> sobre la haz del abismo.</VERS>
 <VERS vnumber="3">Y dijo Dios: Sea la luz; y fue la luz.<BR>Y vio Dios que la luz era buena.</VERS>
 </CHAPTER>
 <CHAPTER cnumber="2">
 <VERS vnumber="1">Fueron, pues, acabados los cielos y la tierra, y todo el ejército de ellos.</VERS>
 </CHAPTER>
 </BIBLEBOOK>
 <BIBLEBOOK bnumber="42" name="Lucas" sname="Lc">
 <CHAPTER cnumber="1">
 <VERS vnumber="1">Muchos han tratado de compilar un relato de las cosas que entre nosotros han sido cumplidas.</VERS>
 <VERS vnumber="2">Tal como nos lo transmitieron los que desde el principio fueron testigos oculares &amp; ministros de la palabra.</VERS>
 </CHAPTER>
 </BIBLEBOOK>
</XMLBIBLE>`

describe('parseZefaniaXml (formato de Biblia de Holyrics)', () => {
 it('parsea libros, capítulos y versículos con bnumber canónico', () => {
 const books = parseZefaniaXml(SAMPLE_XML)
 expect(books).toHaveLength(2)
 expect(books[0]?.name).toBe('Génesis')
 expect(books[0]?.abbrev).toBe('gn')
 expect(books[0]?.chapters).toHaveLength(2)
 expect(books[0]?.chapters[0]?.[0]).toBe('En el principio creó Dios los cielos y la tierra.')
 expect(books[0]?.chapters[1]?.[0]).toBe('Fueron, pues, acabados los cielos y la tierra, y todo el ejército de ellos.')
 expect(books[1]?.name).toBe('Lucas')
 expect(books[1]?.abbrev).toBe('lc')
 expect(books[1]?.chapters[0]).toHaveLength(2)
 })

 it('elimina etiquetas internas, respeta <BR> y decodifica entidades XML', () => {
 const books = parseZefaniaXml(SAMPLE_XML)
 expect(books[0]?.chapters[0]?.[1]).toBe('Y la tierra estaba desordenada y vacía, y había tinieblas sobre la haz del abismo.')
 expect(books[0]?.chapters[0]?.[2]).toBe('Y dijo Dios: Sea la luz; y fue la luz.\nY vio Dios que la luz era buena.')
 expect(books[1]?.chapters[0]?.[1]).toContain('testigos oculares & ministros')
 })

 it('resuelve el nombre del libro por nombre cuando falta bnumber', () => {
 const xml = `<XMLBIBLE><BIBLEBOOK name="Salmos"><CHAPTER cnumber="23"><VERS vnumber="1">Jehová es mi pastor; nada me faltará.</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`
 const books = parseZefaniaXml(xml)
 expect(books).toHaveLength(1)
 expect(books[0]?.name).toBe('Salmos')
 expect(books[0]?.abbrev).toBe('sl')
 expect(books[0]?.chapters).toHaveLength(23)
 expect(books[0]?.chapters[22]?.[0]).toBe('Jehová es mi pastor; nada me faltará.')
 })

 it('rellena huecos cuando la numeración de versículos no es consecutiva', () => {
 const xml = `<XMLBIBLE><BIBLEBOOK bnumber="1"><CHAPTER cnumber="1"><VERS vnumber="1">Uno</VERS><VERS vnumber="3">Tres</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`
 const books = parseZefaniaXml(xml)
 expect(books[0]?.chapters[0]).toEqual(['Uno', '', 'Tres'])
 })

 it('rechaza archivos vacíos o que no son XML de Biblia', () => {
 expect(() => parseZefaniaXml('')).toThrow(/vacío/i)
 expect(() => parseZefaniaXml('esto no es xml')).toThrow(/XML/i)
 expect(() => parseZefaniaXml('<html><body>hola</body></html>')).toThrow(/BIBLEBOOK|libros/i)
 expect(() => parseZefaniaXml('<XMLBIBLE></XMLBIBLE>')).toThrow(/BIBLEBOOK|libros/i)
 })
})

describe('suggestVersionName', () => {
 it('sugiere nombre de versión desde el nombre del archivo', () => {
 expect(suggestVersionName('C:\\biblias\\es_rvr60.xml')).toBe('es rvr60')
 expect(suggestVersionName('RVR_1960.xml')).toBe('RVR 1960')
 expect(suggestVersionName(undefined)).toBe('')
 })
})
