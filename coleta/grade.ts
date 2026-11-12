import type { Ponto } from './tipos.ts'

export interface Caixa {
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
}

const M_POR_GRAU_LAT = 111_320

/**
 * Grade que cobre a caixa inteira com círculos de raio `raioM`.
 * Divide a caixa em células de lado <= raio·√2 e põe um ponto no centro de cada célula:
 * o círculo centrado na célula cobre a célula toda (a meia-diagonal é <= raio).
 */
export function gerarGrade(c: Caixa, raioM: number): Ponto[] {
  const lado = raioM * Math.SQRT2 * 0.98 // folga de 2%
  const latMed = (c.latMin + c.latMax) / 2
  const mPorGrauLng = M_POR_GRAU_LAT * Math.cos((latMed * Math.PI) / 180)
  const altM = (c.latMax - c.latMin) * M_POR_GRAU_LAT
  const largM = (c.lngMax - c.lngMin) * mPorGrauLng
  const nLat = Math.max(1, Math.ceil(altM / lado))
  const nLng = Math.max(1, Math.ceil(largM / lado))
  const dLat = (c.latMax - c.latMin) / nLat
  const dLng = (c.lngMax - c.lngMin) / nLng
  const pts: Ponto[] = []
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLng; j++) {
      pts.push({
        lat: Number((c.latMin + dLat * (i + 0.5)).toFixed(6)),
        lng: Number((c.lngMin + dLng * (j + 0.5)).toFixed(6)),
      })
    }
  }
  return pts
}

/** Distância aproximada em metros (equiretangular; suficiente para poucos km). */
export function distanciaM(a: Ponto, b: Ponto): number {
  const latMed = ((a.lat + b.lat) / 2) * (Math.PI / 180)
  const dy = (a.lat - b.lat) * M_POR_GRAU_LAT
  const dx = (a.lng - b.lng) * M_POR_GRAU_LAT * Math.cos(latMed)
  return Math.hypot(dx, dy)
}

/** Áreas conhecidas. Caixas aproximadas. */
export const AREAS: Record<string, Caixa> = {
  // Município de São Paulo inteiro (bbox; pontos fora da cidade voltam vazios).
  cidade: { latMin: -24.008, latMax: -23.356, lngMin: -46.826, lngMax: -46.365 },
  // Amostras (um bairro de cada empresa).
  'amostra-loga': { latMin: -23.568, latMax: -23.553, lngMin: -46.66, lngMax: -46.64 }, // Bela Vista
  'amostra-ecourbis': { latMin: -23.662, latMax: -23.645, lngMin: -46.72, lngMax: -46.7 }, // Santo Amaro
}
