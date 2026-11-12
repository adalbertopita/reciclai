/**
 * Recicla Sampa: lista bairro -> empresa.
 * GET https://www.reciclasampa.com.br/horarios-de-coleta (HTML server-rendered, sem header especial).
 * Cada <tr> da tabela #horarios-coleta tem <a href=SITE_DA_EMPRESA>NOME</a> e <td class="d-none">slug</td>.
 * A empresa vem do href. Bairro com as duas empresas aparece duas vezes.
 */
import { chaveTexto } from '../normaliza.ts'
import type { BairroEmpresa, Empresa } from '../tipos.ts'

export const URL_PAGINA = 'https://www.reciclasampa.com.br/horarios-de-coleta'

const ENTIDADES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }

function decodifica(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
}

function empresaDoLink(href: string): Empresa | undefined {
  if (/loga\.com\.br/i.test(href)) return 'Loga'
  if (/ecourbis\.com\.br/i.test(href)) return 'Ecourbis'
  return undefined
}

export function parseReciclaSampa(html: string): BairroEmpresa[] {
  const inicio = html.indexOf('id="horarios-coleta"')
  if (inicio < 0) throw new Error('Recicla Sampa: tabela #horarios-coleta não encontrada (o site mudou?)')
  const fim = html.indexOf('</table>', inicio)
  const tabela = html.slice(inicio, fim < 0 ? undefined : fim)
  const saida: BairroEmpresa[] = []
  const vistos = new Set<string>()
  for (const tr of tabela.split(/<tr[\s>]/i).slice(1)) {
    const a = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(tr)
    if (!a) continue
    const empresa = empresaDoLink(a[1]!)
    if (!empresa) continue
    const bairro = decodifica(a[2]!.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    if (!bairro) continue
    const chave = chaveTexto(bairro)
    const k = `${chave}|${empresa}`
    if (vistos.has(k)) continue
    vistos.add(k)
    saida.push({ bairro, chave, empresa })
  }
  return saida
}
