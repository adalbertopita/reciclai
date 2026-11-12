export type Empresa = 'Loga' | 'Ecourbis'
export type Dia = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'
export const DIAS: readonly Dia[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

export interface Coleta {
  dias: Dia[]
  turno?: 'diurno' | 'noturno'
  /** Texto para o morador, ex.: "a partir das 20h30". Ausente quando a fonte não publica hora. */
  horario?: string
  /** Hora publicada por dia ("HH:MM"), quando existe. */
  horarios?: Partial<Record<Dia, string>>
}

export interface CepDoTrecho {
  cep: string // 8 dígitos
  /** Só Ecourbis: lado da rua. Ausente quando os dois lados têm o mesmo CEP ou a fonte não informa. */
  lado?: 'direita' | 'esquerda'
}

/** Unidade normalizada vinda de qualquer fonte geográfica (Loga: logradouro+CEP+setor; Ecourbis: trecho). */
export interface Trecho {
  empresa: Empresa
  /** Chave estável para deduplicar entre pontos da grade. */
  id: string
  logradouro: string
  subprefeitura?: string
  distrito?: string
  ceps: CepDoTrecho[]
  setorComum?: string
  setorSeletiva?: string
  comum?: Coleta
  seletiva?: Coleta
  /** Loga: há contêiner de coleta mecanizada (24 horas) para o lixo comum. */
  conteiner?: boolean
}

export interface Ponto {
  lat: number
  lng: number
}

/** Interface comum aos adaptadores geográficos (Loga, Ecourbis). */
export interface FonteGeo {
  empresa: Empresa
  /** Monta a URL de consulta para um ponto e raio (metros). */
  url(p: Ponto, raioM: number): string
  /** Converte a resposta JSON crua em trechos normalizados. */
  parse(json: unknown): Trecho[]
}

export interface BairroEmpresa {
  bairro: string // como publicado, ex.: "ARTUR ALVIM"
  chave: string // normalizado: minúsculas, sem acento, espaços simples
  empresa: Empresa
}
