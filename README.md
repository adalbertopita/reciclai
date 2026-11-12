# Reciclaí

Digite o CEP da sua casa e veja **em que dia e a partir de que horas** passa a coleta de lixo comum e a de recicláveis na cidade de São Paulo.

Em São Paulo, a coleta é feita por duas empresas, a **Loga** e a **Ecourbis**. Normalmente, o morador precisa descobrir qual delas atende o seu bairro e depois fazer uma nova busca no site dessa empresa. O Reciclaí junta tudo numa consulta só, pelo CEP.

## Como funciona

Tudo é estático: não há servidor, banco de dados nem consulta às empresas na hora do uso.

```
coleta/        scripts Node + TypeScript que rodam na máquina do autor
   │           varrem as APIs públicas da Loga e da Ecourbis por uma grade de coordenadas
   ▼
site/dados/    JSON gerados (um arquivo por prefixo de CEP, ~3 KB cada)
   │
   ▼
site/          HTML + CSS + JS puro, sem build: lê os JSON direto no navegador
```

- **Dados:** 44.637 CEPs da capital, com 93% dos domicílios cobertos, segundo o Censo 2022 do IBGE. Os horários são de 11/2026, e o site mostra essa data.
- **Quando o CEP não está na base:** o site diz qual empresa atende, pelo bairro (via [ViaCEP](https://viacep.com.br)) e pela lista do [Recicla Sampa](https://www.reciclasampa.com.br/horarios-de-coleta), e leva ao site oficial dela, com o passo a passo.
- **Quando o horário muda conforme o trecho da rua:** o site mostra as opções e avisa, em vez de escolher uma.
- **Privacidade:** sem login, cookies, analytics ou `localStorage`. O CEP só vai na URL (`?cep=`) e na consulta ao ViaCEP.
- **Leve:** ~95 KB na primeira visita e ~0,5 KB por consulta.

## Rodar o site localmente

```bash
cd site && python3 -m http.server 8080
```

Depois abra http://localhost:8080. Qualquer servidor de arquivos estáticos serve. O conteúdo de `site/` é exatamente o que vai para a hospedagem.

## Atualizar os dados

Os horários mudam pouco, mas mudam. Para refazer a base:

```bash
npm install
npm test               # testes dos parsers com respostas reais salvas em fixtures/
npm run checar-fontes  # 3 CEPs conhecidos ao vivo contra site/dados: as fontes mudaram?
```

A varredura completa leva cerca de 2h30, em ritmo educado (1 a 2 s entre requisições, uma por vez). O passo a passo, com retomada após queda e a correção do certificado da Ecourbis, está no [CLAUDE.md](CLAUDE.md#rodar-a-varredura-da-cidade-passo-a-passo). Ao final:

```bash
npm run validar        # integridade + cobertura contra o CNEFE (IBGE) + empresa contra o Recicla Sampa
```

## Estrutura

| Pasta | O que tem |
|---|---|
| `coleta/` | Adaptadores das fontes (`fontes/loga.ts`, `fontes/ecourbis.ts`, `fontes/reciclasampa.ts`), varredura, agregação, validação |
| `fixtures/` | Respostas reais das APIs, usadas pelos testes |
| `site/` | Páginas, CSS, JS, imagens e `dados/` |
| `docs/` | Produto (`PRD.md`), visual (`DESIGN.md`) e layouts de referência |

## Fontes

- [Loga](https://www.loga.com.br/pesquisa-de-coleta/), Centro, Norte, Oeste e parte da Leste
- [Ecourbis](https://www.ecourbis.com.br/coleta/index.html), Sul e Leste
- [Recicla Sampa](https://www.reciclasampa.com.br/horarios-de-coleta): bairro → empresa
- [IBGE, CNEFE 2022](https://www.ibge.gov.br/): referência de cobertura
- [ViaCEP](https://viacep.com.br): endereço do CEP, consultado pelo navegador

Os horários podem mudar. Na dúvida, confira no site da empresa ou ligue **156**.

---

Feito por [@adalbertopita](https://github.com/adalbertopita).
