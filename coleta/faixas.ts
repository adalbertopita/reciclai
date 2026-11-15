/**
 * Faixas de número da casa para os CEPs com as duas empresas na mesma rua.
 *
 *   npm run faixas                 # lê site/dados e o CNEFE; grava coleta/bruto/faixas.json
 *   npm run faixas -- --cep=04103030
 *
 * Depois rode `npm run gerar-dados -- --area=...` para levar as faixas aos arquivos do site.
 * As consultas ficam em cache (coleta/bruto/faixas-cache.json): rodar de novo continua de onde parou.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import type { ArquivoPrefixo } from './agrega.ts'
import { faixasDoLado, type FaixasCep } from './faixas-numero.ts'
import { criaCliente } from './http.ts'
import { loga } from './fontes/loga.ts'
import { chaveTexto } from './normaliza.ts'
import type { Empresa } from './tipos.ts'

const DIR = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(DIR, '..')
const BRUTO = join(DIR, 'bruto')
const CNEFE = join(BRUTO, 'ibge', '3550308_SAO_PAULO.csv')
const SAIDA = join(BRUTO, 'faixas.json')
const CACHE = join(BRUTO, 'faixas-cache.json')
/** Raio da consulta à Loga. Só interessa o `naoAtendido`, então quanto menor, mais leve. */
const RAIO_M = 30

// Colunas do CNEFE (base 0)
const C_CEP = 8
const C_TIPO = 10
const C_TITULO = 11
const C_NOME = 12
const C_NUMERO = 13
const C_LAT = 25
const C_LNG = 26
const C_NIVEL_GEO = 27

/** CEPs do site cujas opções são das duas empresas e da mesma rua (ignorando acento). */
function alvos(dados: string, filtro?: string): Set<string> {
  const saida = new Set<string>()
  const dir = join(dados, 'cep')
  for (const f of readdirSync(dir)) {
    const arq = JSON.parse(readFileSync(join(dir, f), 'utf8')) as ArquivoPrefixo
    for (const [cep, opcoes] of Object.entries(arq.ceps)) {
      if (filtro && cep !== filtro) continue
      const empresas = new Set(opcoes.map((o) => arq.setores[o.setor]!.empresa))
      const ruas = new Set(opcoes.flatMap((o) => o.ruas ?? []).map(chaveTexto))
      if (empresas.size > 1 && ruas.size <= 1) saida.add(cep)
    }
  }
  return saida
}

type Endereco = { lat: number; lng: number }
/** cep -> rua do CNEFE -> número -> coordenada (só endereços geocodificados no próprio número). */
async function enderecos(ceps: Set<string>) {
  const r = new Map<string, Map<string, Map<number, Endereco>>>()
  const rl = createInterface({ input: createReadStream(CNEFE, 'utf8'), crlfDelay: Infinity })
  let primeira = true
  for await (const linha of rl) {
    if (primeira) {
      primeira = false
      continue
    }
    const c = linha.split(';')
    if (!ceps.has(c[C_CEP]!) || c[C_NIVEL_GEO] !== '1') continue
    const n = Number(c[C_NUMERO])
    if (!Number.isInteger(n) || n <= 0) continue
    const rua = chaveTexto([c[C_TIPO], c[C_TITULO], c[C_NOME]].filter(Boolean).join(' '))
    const porRua = r.get(c[C_CEP]!) ?? r.set(c[C_CEP]!, new Map()).get(c[C_CEP]!)!
    const nums = porRua.get(rua) ?? porRua.set(rua, new Map()).get(rua)!
    if (!nums.has(n)) nums.set(n, { lat: Number(c[C_LAT]), lng: Number(c[C_LNG]) })
  }
  return r
}

async function main() {
  const a = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, '').split('=') as [string, string]))
  const dados = resolve(RAIZ, a.dados ?? 'site/dados')
  if (!existsSync(CNEFE)) throw new Error(`não achei ${CNEFE} (ver CLAUDE.md, CNEFE)`)

  const ceps = alvos(dados, a.cep)
  console.log(`${ceps.size} CEPs com as duas empresas na mesma rua. Lendo o CNEFE...`)
  const ends = await enderecos(ceps)

  const cache: Record<string, Empresa> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
  const saida: Record<string, FaixasCep & { rua: string; numeros: number }> =
    existsSync(SAIDA) && !a.cep ? JSON.parse(readFileSync(SAIDA, 'utf8')) : {}
  const http = criaCliente({ log: (m) => console.log(`  ${m}`) })
  let consultas = 0

  const classificaPonto = async (p: Endereco): Promise<Empresa> => {
    const chave = `${p.lat},${p.lng}`
    if (cache[chave]) return cache[chave]
    const j = (await http.getJson(loga.url(p, RAIO_M))) as { naoAtendido?: boolean; found?: boolean }
    consultas++
    let e: Empresa
    if (j?.naoAtendido) e = 'Ecourbis'
    // found:false sem naoAtendido = dentro da área da Loga, só sem rua a menos de RAIO_M.
    else if (j && typeof j.found === 'boolean') e = 'Loga'
    else throw new Error(`resposta inesperada da Loga em ${chave}: ${JSON.stringify(j).slice(0, 200)}`)
    cache[chave] = e
    return e
  }

  const lista = [...ceps].sort()
  let feitos = 0
  let semCnefe = 0
  for (const cep of lista) {
    feitos++
    const porRua = ends.get(cep)
    if (!porRua) {
      semCnefe++
      continue
    }
    if (saida[cep]) continue
    // A rua do CEP é a com mais números (o CNEFE às vezes põe uma rua vizinha no mesmo CEP).
    const [rua, nums] = [...porRua].sort((x, y) => y[1].size - x[1].size)[0]!
    const lado = (par: boolean) => {
      const ns = [...nums.keys()].filter((n) => (n % 2 === 0) === par).sort((x, y) => x - y)
      return faixasDoLado(ns, (n) => classificaPonto(nums.get(n)!))
    }
    const f = { rua, numeros: nums.size, p: await lado(true), i: await lado(false) }
    saida[cep] = f
    writeFileSync(SAIDA, JSON.stringify(saida, null, 1))
    writeFileSync(CACHE, JSON.stringify(cache))
    const txt = (l: typeof f.p) => l.map(([x, y, e]) => `${x}-${y} ${e}`).join(', ') || '-'
    console.log(`[${feitos}/${lista.length}] ${cep} ${rua} (${nums.size} núm., ${consultas} consultas) par: ${txt(f.p)} | ímpar: ${txt(f.i)}`)
  }

  const valores = Object.values(saida)
  const umaEmpresa = valores.filter((f) => new Set([...f.p, ...f.i].map((x) => x[2])).size === 1).length
  console.log(
    `\nFim. ${valores.length} CEPs com faixas; ${semCnefe} sem número no CNEFE (ficam com as duas opções); ` +
      `${umaEmpresa} com todos os números de uma empresa só; ${consultas} consultas nesta execução.\nSaída: ${SAIDA}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
