/**
 * Valida site/dados contra a própria estrutura, o CNEFE (IBGE) e o Recicla Sampa.
 *
 *   npm run validar                      # lê site/dados e coleta/bruto/ibge/3550308_SAO_PAULO.csv
 *   npm run validar -- --dados=coleta/amostra
 *
 * 1. Integridade: toda opção aponta para um setor que existe; todo setor tem alguma coleta;
 *    CEP válido e no arquivo do prefixo certo. Erro aqui = saída 1.
 * 2. Cobertura: CEPs com domicílio no CNEFE que têm (ou não) horário na base, por CEP e por domicílio.
 * 3. Empresa: o bairro do CEP no CNEFE (DSC_LOCALIDADE) bate com a empresa do Recicla Sampa?
 * 4. CEPs conhecidos (conferidos à mão no portal da Prefeitura).
 *
 * Grava o relatório completo em coleta/bruto/validacao.json.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import type { ArquivoPrefixo } from './agrega.ts'
import { cepValido, chaveTexto } from './normaliza.ts'
import type { Empresa } from './tipos.ts'

const DIR = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(DIR, '..')
const CNEFE = join(DIR, 'bruto', 'ibge', '3550308_SAO_PAULO.csv')

const CONHECIDOS: [string, Empresa][] = [
  ['01308080', 'Loga'],
  ['01332000', 'Loga'],
  ['04745001', 'Ecourbis'],
  ['04753060', 'Ecourbis'],
]

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-')

interface InfoCep {
  empresas: Set<Empresa>
  opcoes: number
}

function lerBase(dirDados: string) {
  const erros: string[] = []
  const ceps = new Map<string, InfoCep>()
  const dirCep = join(dirDados, 'cep')
  for (const nome of readdirSync(dirCep).filter((n) => n.endsWith('.json'))) {
    const prefixo = nome.slice(0, 5)
    const arq = JSON.parse(readFileSync(join(dirCep, nome), 'utf8')) as ArquivoPrefixo
    for (const [id, s] of Object.entries(arq.setores)) {
      if (!s.comum && !s.seletiva && !s.conteiner) erros.push(`${nome}: setor ${id} sem coleta`)
      for (const c of [s.comum, s.seletiva]) if (c && c.dias.length === 0) erros.push(`${nome}: setor ${id} com dias vazios`)
    }
    for (const [cep, ops] of Object.entries(arq.ceps)) {
      if (!cepValido(cep)) erros.push(`${nome}: CEP inválido ${cep}`)
      if (!cep.startsWith(prefixo)) erros.push(`${nome}: CEP ${cep} no arquivo errado`)
      if (ops.length === 0) erros.push(`${nome}: CEP ${cep} sem opção`)
      const info: InfoCep = { empresas: new Set(), opcoes: ops.length }
      for (const o of ops) {
        const s = arq.setores[o.setor]
        if (!s) erros.push(`${nome}: CEP ${cep} aponta para setor inexistente ${o.setor}`)
        else info.empresas.add(s.empresa)
        if (ops.length > 1 && !o.ruas?.length) erros.push(`${nome}: CEP ${cep} com opções sem nome de rua`)
      }
      ceps.set(cep, info)
    }
  }
  return { ceps, erros }
}

async function lerCnefe() {
  // CEP -> domicílios particulares e contagem de localidades
  const dom = new Map<string, number>()
  const local = new Map<string, Map<string, number>>()
  const rl = createInterface({ input: createReadStream(CNEFE), crlfDelay: Infinity })
  let primeira = true
  for await (const linha of rl) {
    if (primeira) {
      primeira = false
      continue
    }
    const c = linha.split(';')
    if (c[28] !== '1') continue // COD_ESPECIE 1 = domicílio particular
    const cep = c[8]!
    if (!cepValido(cep)) continue
    dom.set(cep, (dom.get(cep) ?? 0) + 1)
    let m = local.get(cep)
    if (!m) local.set(cep, (m = new Map()))
    const l = c[9]!
    m.set(l, (m.get(l) ?? 0) + 1)
  }
  const localidade = new Map<string, string>()
  for (const [cep, m] of local) localidade.set(cep, [...m].sort((a, b) => b[1] - a[1])[0]![0])
  return { dom, localidade }
}

async function main() {
  const dirDados = resolve(RAIZ, arg('dados') ?? 'site/dados')
  console.log(`Base: ${dirDados}`)
  const { ceps, erros } = lerBase(dirDados)
  console.log(`\n1. Integridade: ${ceps.size} CEPs, ${erros.length} erro(s)`)
  for (const e of erros.slice(0, 20)) console.log(`   ✗ ${e}`)

  const relatorio: Record<string, unknown> = { erros }

  // 2. Cobertura
  if (!existsSync(CNEFE)) {
    console.log(`\n2. Cobertura: pulei (não achei ${CNEFE})`)
  } else {
    console.log('\n2. Cobertura contra o CNEFE 2022 (lendo 945 MB...)')
    const { dom, localidade } = await lerCnefe()
    let cepsOk = 0
    let domTotal = 0
    let domOk = 0
    const faltando: [string, number, string][] = []
    for (const [cep, n] of dom) {
      domTotal += n
      if (ceps.has(cep)) {
        cepsOk++
        domOk += n
      } else faltando.push([cep, n, localidade.get(cep) ?? ''])
    }
    faltando.sort((a, b) => b[1] - a[1])
    const soNaBase = [...ceps.keys()].filter((c) => !dom.has(c)).length
    console.log(`   CEPs com domicílio no CNEFE: ${dom.size}`)
    console.log(`   com horário na base:         ${cepsOk} (${pct(cepsOk, dom.size)})`)
    console.log(`   domicílios cobertos:         ${domOk} de ${domTotal} (${pct(domOk, domTotal)})`)
    console.log(`   CEPs da base fora do CNEFE:  ${soNaBase} (comerciais, CEP novo ou erro de CEP)`)

    const porLocal = new Map<string, [number, number]>()
    for (const [, n, l] of faltando) {
      const v = porLocal.get(l) ?? [0, 0]
      porLocal.set(l, [v[0] + 1, v[1] + n])
    }
    console.log('   Localidades com mais domicílios sem horário:')
    for (const [l, [nc, nd]] of [...porLocal].sort((a, b) => b[1][1] - a[1][1]).slice(0, 12))
      console.log(`     ${l.padEnd(24)} ${String(nc).padStart(5)} CEPs  ${String(nd).padStart(7)} domicílios`)
    console.log('   CEPs sem horário com mais domicílios:')
    for (const [cep, n, l] of faltando.slice(0, 10)) console.log(`     ${cep}  ${String(n).padStart(5)}  ${l}`)

    // 3. Empresa x Recicla Sampa
    const bairros = JSON.parse(readFileSync(join(dirDados, 'bairros.json'), 'utf8')) as Record<
      string,
      { nome: string; empresas: Empresa[] }
    >
    let comparados = 0
    let iguais = 0
    const diverge = new Map<string, { esperado: string; achado: string; ceps: number }>()
    for (const [cep, info] of ceps) {
      const l = localidade.get(cep)
      const b = l ? bairros[chaveTexto(l)] : undefined
      if (!b || info.empresas.size !== 1) continue
      comparados++
      const achado = [...info.empresas][0]!
      if (b.empresas.includes(achado)) iguais++
      else {
        const d = diverge.get(l!) ?? { esperado: b.empresas.join('/'), achado, ceps: 0 }
        d.ceps++
        diverge.set(l!, d)
      }
    }
    console.log(`\n3. Empresa x Recicla Sampa (bairro do CEP pelo CNEFE)`)
    console.log(`   CEPs comparados: ${comparados}, empresa igual: ${iguais} (${pct(iguais, comparados)})`)
    const divs = [...diverge].sort((a, b) => b[1].ceps - a[1].ceps)
    for (const [l, d] of divs.slice(0, 12))
      console.log(`     ${l.padEnd(24)} Recicla Sampa: ${d.esperado.padEnd(9)} base: ${d.achado.padEnd(9)} ${d.ceps} CEPs`)

    relatorio.cobertura = { cepsCnefe: dom.size, cepsOk, domTotal, domOk, soNaBase, faltando: faltando.slice(0, 2000) }
    relatorio.empresa = { comparados, iguais, divergencias: Object.fromEntries(divs) }
  }

  // 4. Conhecidos
  console.log('\n4. CEPs conferidos à mão')
  let falhaConhecido = false
  for (const [cep, empresa] of CONHECIDOS) {
    const info = ceps.get(cep)
    const ok = !!info && info.empresas.has(empresa)
    if (!ok) falhaConhecido = true
    console.log(`   ${ok ? '✓' : '✗'} ${cep} ${empresa}${info ? ` (${info.opcoes} opção/ões)` : ' — ausente'}`)
  }

  writeFileSync(join(DIR, 'bruto', 'validacao.json'), JSON.stringify(relatorio, null, 1))
  console.log(`\nRelatório completo: coleta/bruto/validacao.json`)
  if (erros.length || falhaConhecido) process.exit(1)
}

main()
