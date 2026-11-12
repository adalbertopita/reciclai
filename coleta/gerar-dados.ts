/**
 * Gera os JSON do site a partir da varredura.
 *
 *   npm run gerar-dados -- --area=cidade                       # escreve em site/dados/
 *   npm run gerar-dados -- --area=amostra-loga,amostra-ecourbis --saida=coleta/amostra
 *
 * Lê coleta/bruto/<area>.jsonl e coleta/bruto/reciclasampa.html (baixa a página se não existir).
 * Escreve: <saida>/cep/<prefixo>.json, <saida>/bairros.json, <saida>/meta.json.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { agrega } from './agrega.ts'
import { criaCliente } from './http.ts'
import { parseReciclaSampa, URL_PAGINA } from './fontes/reciclasampa.ts'
import { URL_OFICIAL as LOGA_OFICIAL } from './fontes/loga.ts'
import { URL_OFICIAL as ECOURBIS_OFICIAL } from './fontes/ecourbis.ts'
import type { Empresa, Trecho } from './tipos.ts'

const DIR = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(DIR, '..')
const BRUTO = join(DIR, 'bruto')

function args() {
  const a = Object.fromEntries(
    process.argv.slice(2).map((s) => {
      const [k, v] = s.replace(/^--/, '').split('=')
      return [k!, v ?? 'true']
    }),
  )
  return {
    areas: (a.area ?? 'cidade').split(','),
    saida: resolve(RAIZ, a.saida ?? 'site/dados'),
    atualizarBairros: a['atualizar-bairros'] === 'true',
  }
}

function* lerTrechos(arquivo: string): Generator<Trecho> {
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) if (linha.trim()) yield JSON.parse(linha) as Trecho
}

async function main() {
  const { areas, saida, atualizarBairros } = args()

  // Recicla Sampa
  const htmlBairros = join(BRUTO, 'reciclasampa.html')
  if (!existsSync(htmlBairros) || atualizarBairros) {
    console.log(`Baixando ${URL_PAGINA}`)
    mkdirSync(BRUTO, { recursive: true })
    writeFileSync(htmlBairros, await criaCliente().getTexto(URL_PAGINA))
  }
  const listaBairros = parseReciclaSampa(readFileSync(htmlBairros, 'utf8'))
  const bairros: Record<string, { nome: string; empresas: Empresa[] }> = {}
  for (const b of listaBairros) {
    const e = (bairros[b.chave] ??= { nome: b.bairro, empresas: [] })
    if (!e.empresas.includes(b.empresa)) e.empresas.push(b.empresa)
  }

  // Trechos
  const arquivos = areas.map((a) => join(BRUTO, `${a}.jsonl`))
  for (const f of arquivos) if (!existsSync(f)) throw new Error(`não achei ${f}. Rode a varredura antes.`)
  const { arquivos: porPrefixo, totais } = agrega(
    (function* () {
      for (const f of arquivos) yield* lerTrechos(f)
    })(),
  )

  // Escreve
  rmSync(join(saida, 'cep'), { recursive: true, force: true })
  mkdirSync(join(saida, 'cep'), { recursive: true })
  let bytes = 0
  let maior = { prefixo: '', bytes: 0 }
  for (const [prefixo, arq] of porPrefixo) {
    const txt = JSON.stringify(arq)
    writeFileSync(join(saida, 'cep', `${prefixo}.json`), txt)
    bytes += txt.length
    if (txt.length > maior.bytes) maior = { prefixo, bytes: txt.length }
  }
  writeFileSync(join(saida, 'bairros.json'), JSON.stringify(bairros))
  const agora = new Date()
  const meta = {
    atualizadoEm: agora.toISOString().slice(0, 10),
    mesAno: `${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`,
    areas,
    links: { Loga: LOGA_OFICIAL, Ecourbis: ECOURBIS_OFICIAL },
    totais: { ...totais, prefixos: porPrefixo.size, bairros: Object.keys(bairros).length },
  }
  writeFileSync(join(saida, 'meta.json'), JSON.stringify(meta, null, 2))

  console.log(JSON.stringify(meta.totais, null, 2))
  console.log(
    `Arquivos de CEP: ${porPrefixo.size}, total ${(bytes / 1024).toFixed(0)} KB, ` +
      `média ${(bytes / Math.max(1, porPrefixo.size) / 1024).toFixed(1)} KB, maior ${maior.prefixo} com ${(maior.bytes / 1024).toFixed(1)} KB.`,
  )
  console.log(`Saída: ${saida}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
