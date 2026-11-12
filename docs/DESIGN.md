# design.md: Reciclaí (consulta de coleta de lixo por CEP)

Guia de layout para implementar as telas do Reciclaí. A fonte da verdade visual é o canvas de design do projeto. Este arquivo traduz o canvas em regras que o código deve seguir. Na dúvida, siga este arquivo e **não invente estilos novos**.

---

## 1. Princípios

1. **Mobile first.** O público usa o celular, chegando pelo QR Code do panfleto. Escreva o CSS para 390px e acrescente regras de desktop com `min-width`.
2. **Um objetivo por tela.** Na tela inicial, a única ação é digitar o CEP e tocar em "ver dias da coleta".
3. **Legível para idosos.** Use letras grandes, alto contraste, alvos de toque grandes e frases curtas, sem termos técnicos.
4. **Leve.** Use HTML, CSS e o mínimo de JS, sem framework de UI. A página precisa carregar rápido em 3G.
5. **Sem dados pessoais.** Não use cookies, analytics invasivo nem `localStorage` para guardar o CEP.

---

## 2. Tokens

### 2.1 Cores

Use **somente** estas cores, declaradas como variáveis CSS em `:root`.

```css
:root {
  /* Paleta da marca */
  --verde-escuro:  #436446; /* links, textos de destaque, botão secundário, bloco 156 */
  --verde-medio:   #72975A; /* faixa do topo (decorativa) */
  --verde-claro:   #B0C76A; /* faixa do rodapé, círculo de ícone "reciclável", números de passos, anel de foco */
  --creme:         #EFE7D5; /* círculo de ícone "lixo comum"/aviso, card do Ecoponto */
  --vermelho:      #AD4F4D; /* botão principal (CTA) e erros */

  /* Neutros */
  --fundo:         #FFFFFF; /* topo, rodapé, cards */
  --fundo-cinza:   #EEEEEE; /* área central de conteúdo */
  --borda:         #D6D6D6; /* divisórias e borda de cards */
  --borda-campo:   #6F6F6F; /* borda dos campos */
  --texto:         #1F1F1F; /* texto principal */
  --texto-2:       #3F3F3F; /* parágrafos secundários */
  --texto-suave:   #5C5C5C; /* legendas, ajuda, CEP acima do endereço */
  --texto-credito: #6B6B6B; /* "feito por @adalbertopita" */
  --placeholder:   #9A9A9A;

  /* Derivados (usar só onde indicado) */
  --verde-hover:   #2E4A31; /* hover de links e ícone sobre --verde-claro */
  --erro-texto:    #8E3B39; /* título da mensagem de erro */
}
```

**Regras de cor**
- O texto branco só pode ficar sobre `--verde-escuro` ou `--vermelho`. **Nunca** coloque texto branco sobre `--verde-medio`, `--verde-claro` ou `--creme`, porque o contraste fica insuficiente.
- Sobre `--verde-claro` e `--creme`, use texto `--texto` e ícones `--verde-hover`, `--verde-escuro` ou `--vermelho`.
- O vermelho tem dois usos: o **botão de ação principal** e o **estado de erro**. Não use vermelho como decoração.
- "Reciclável" e "comum" se diferenciam por **ícone e título**, nunca só pela cor.
- O contraste mínimo é **4,5:1** para todo texto. Todas as combinações acima já passam.

### 2.2 Tipografia

- **Fonte:** [Onest](https://fonts.google.com/specimen/Onest), pesos 400, 500 e 700.
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;700&display=swap" rel="stylesheet">
  ```
  Use a pilha `font-family: 'Onest', system-ui, sans-serif;`.
- **Corpo mínimo de 15px.** Nenhum texto fica abaixo disso, exceto o rótulo "Ecoponto mais perto", com 14px.

| Papel | Mobile | Desktop | Peso | Line-height |
|---|---|---|---|---|
| Título da tela inicial (h1) | 20px | 26px | 700 | 1.35 |
| Título de tela interna (h1) | 22px | 30px | 700 | 1.3 |
| Título de card (h2) | 20px | 22px | 700 | 1.3 |
| **Dias da coleta** (destaque) | 28px | 34px | 700, cor `--verde-escuro` | 1.2 |
| Horário ("a partir das **[00h00]**") | 18px | 20px | 400 + 700 no horário | 1.4 |
| Texto do campo (CEP / número) | 24px | 26px | 500 | — |
| Botão | 19px | 20px | 700 | — |
| Links do rodapé | 18px | 18px | 700 | — |
| Parágrafo | 16px | 16–17px | 400 | 1.45 |
| Ajuda / legenda | 15px | 16px | 400, `--texto-suave` | 1.4 |

**Estilo de texto**
- Os botões e links de ação usam **minúsculas**, por exemplo "ver dias da coleta", "nova consulta" e "conferir no site da Loga". Os títulos usam a capitalização normal de frase.
- Sempre escreva "CEP" em maiúsculas.

### 2.3 Espaçamento, raios e alturas

- **Escala de espaço:** 4, 8, 10, 12, 16, 20, 24, 28, 40 e 48px.
- **Margem lateral:** 24px no mobile e 40px no desktop.
- **Espaço entre blocos** da área cinza: 20px no mobile e 24px no desktop.
- **Raios:**
  - Campos e botões são cápsulas, com `border-radius` igual à metade da altura (28px no campo de 56px, 26px no botão de 52px).
  - Cards usam 20px no mobile e 24px no desktop.
  - A caixa de erro usa 16px.
- **Alturas mínimas:** campo com 56px (60px no desktop), botão com 52px (60px no botão do início desktop) e links de texto clicáveis com 44px de `min-height`.
- **Faixas da marca:** 10px no mobile e 12px no desktop.

---

## 3. Estrutura da página

Todas as telas seguem o mesmo esqueleto, de cima para baixo:

```
┌───────────────────────────────┐
│ faixa topo  (--verde-medio)   │  10px
├───────────────────────────────┤
│ TOPO (branco)                 │  home: logo completo + ilustração
│                               │  internas: "← nova consulta" + símbolo
├───────────────────────────────┤  border-top 1px --borda
│ CONTEÚDO (--fundo-cinza)      │  flex: 1
│                               │
├───────────────────────────────┤  border-top 1px --borda
│ RODAPÉ (branco)               │  links + crédito
├───────────────────────────────┤
│ faixa base  (--verde-claro)   │  10px
└───────────────────────────────┘
```

- O `body` é uma coluna flex com `min-height: 100vh`. O `<main>` (área cinza) recebe `flex: 1`, para que o rodapé fique no fim da tela mesmo com pouco conteúdo.
- As faixas são decorativas, feitas com `<div aria-hidden="true">` ou pseudo-elementos.
- **Desktop:** o fundo das faixas, do topo, da área cinza e do rodapé ocupa a largura toda. O conteúdo fica centralizado em um container:
  - formulário da home: `max-width: 640px`;
  - telas internas, cabeçalho e rodapé: `max-width: 1080px`;
  - padding horizontal de 40px.

### 3.1 Breakpoints

```css
/* base = mobile (≥ 320px). Teste em 320, 360, 390 e 430. */
@media (min-width: 768px)  { /* tablet: containers centralizados, ainda 1 coluna */ }
@media (min-width: 1024px) { /* desktop: grids de 2 colunas, campo+botão lado a lado */ }
```
- Não deve haver rolagem horizontal em nenhuma largura.

---

## 4. Componentes

### 4.1 Topo da home (`.hero`)
- Fundo branco, `padding-top` de 28px (40px no desktop), conteúdo centralizado e 16px de espaço entre itens.
- **Logo completo**, com símbolo e o nome "reciclaí": `logo-reciclai.png`, com 128px de largura no mobile e 160px no desktop. Use `alt="Reciclaí"`.
- **Ilustração da cidade:** `skyline-sp.webp`, com 100% da largura no mobile e no máximo 920px no desktop, `height: auto` e `alt=""` (é decorativa).
- O logo completo, com o nome, **é obrigatório na home**.

### 4.2 Cabeçalho das telas internas (`.topbar`)
- Fundo branco e uma linha com `justify-content: space-between`.
- **À esquerda:** o link de voltar, com ícone `arrow-left` de 22px e o texto "nova consulta" (ou "voltar"). Fica em `--verde-escuro`, 18px, peso 700, com 48px de `min-height`.
- **À direita:** o **símbolo** do logo (`logo-simbolo.png`, sem o nome), com 44px de altura no mobile e 56px no desktop.
- No desktop, o símbolo fica à esquerda e funciona como link para a home. O "nova consulta" fica à direita.

### 4.3 Campo de texto (`.input`)
```css
.input {
  height: 56px; padding: 0 24px;
  font: 500 24px/1 'Onest', system-ui, sans-serif; color: var(--texto);
  background: #fff; border: 1.5px solid var(--borda-campo); border-radius: 28px;
}
.input::placeholder { color: var(--placeholder); }
.input:focus-visible { outline: 3px solid var(--verde-claro); outline-offset: 2px; }
.input[aria-invalid="true"] { border: 2.5px solid var(--vermelho); }
```
- **CEP:**
  - atributos `type="text" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000"`;
  - máscara `00000-000` aplicada enquanto a pessoa digita, aceitando também colar o CEP sem hífen.
- **Número da casa:** `inputmode="numeric"` e `placeholder="ex.: 120"`.
- **Todo campo tem `<label for>`.**
  - Na home, o rótulo "CEP da sua casa" fica **visualmente oculto**, com a classe `.sr-only`, porque o título já explica o campo.
  - Na tela de número, o rótulo fica visível, com 17px e peso 700.
- O texto de ajuda fica abaixo do campo, com 15px, `--texto-suave` e `padding-inline` de 12px: "Não sabe o CEP? Ele aparece na conta de luz ou de água."

### 4.4 Botões
| Variante | Uso | Estilo |
|---|---|---|
| **Principal** `.btn` | Uma ação principal por tela: "ver dias da coleta", "abrir site da Ecourbis", "digitar outro CEP" | fundo `--vermelho`, texto branco, 52px de altura, raio 26px, largura total no mobile |
| **Secundário** `.btn--outline` | Links externos e ações de apoio: "conferir no site da Loga", "ver no mapa" | fundo branco, borda 2px `--verde-escuro`, texto `--verde-escuro` |
| **Inverso** `.btn--inverse` | Sobre o bloco verde-escuro do 156 | fundo branco, texto `--verde-escuro` |
| **Pequeno** `.btn--sm` | "copiar" dentro da caixa do CEP | fundo `--verde-escuro`, texto branco, 44px de altura, raio 22px |

**Regras para todos os botões**
- Use `<button>` para ações e `<a href>` para navegação. Nunca use `div` clicável.
- Coloque um único botão principal (vermelho) por tela.
- Os links externos levam o ícone `external-link` e abrem com `target="_blank" rel="noopener"`.
- O foco aparece com `outline: 3px solid var(--verde-claro); outline-offset: 2px`.
- No desktop, botões fora da home têm largura automática, com `padding-inline` de 28px.

### 4.5 Card de coleta (`.card-coleta`)
- Fundo branco, borda 1px `--borda`, raio 20px (24px no desktop) e padding de 20px (28px no desktop).
- **Cabeçalho do card:**
  - um círculo de 44px (52px no desktop) com o ícone de 24px;
  - ao lado, um título h2 e uma legenda de 15px em `--texto-suave`.
- **Variante reciclável:** círculo `--verde-claro`, ícone `recycle` em `--verde-hover`, título "Lixo reciclável" e legenda "coleta seletiva".
- **Variante comum:** círculo `--creme`, ícone `trash-2` em `--verde-escuro`, título "Lixo comum" e legenda "coleta domiciliar".
- **Conteúdo, na ordem:**
  1. os **dias**, com 28px, peso 700 e cor `--verde-escuro`;
  2. o horário, "a partir das **HHhMM**";
  3. uma dica de 15px em `--texto-suave`.
- No mobile, os cards ficam empilhados. No desktop, ficam em `grid-template-columns: repeat(2, minmax(0,1fr))` com 24px de espaço.

### 4.6 Caixa de aviso (informação)
- Fundo branco, borda 1px `--borda`, raio 20px e padding de 18px.
- Leva um círculo `--creme` de 40px com o ícone `info`, um título de 20px e um texto de 16px.

### 4.7 Mensagem de erro
- Fica logo abaixo do campo, com `role="alert"` e ligada ao campo por `aria-describedby`.
- Fundo branco, raio 16px e padding de 14px por 16px.
- Leva o ícone `triangle-alert` em `--vermelho`, um título de 17px com peso 700 em `--erro-texto` e uma explicação de 15px.
- O campo com erro recebe `aria-invalid="true"`, que aplica a borda vermelha.

### 4.8 Passos numerados
- Use `<ol>` sem marcadores, com 16px entre itens.
- Cada passo tem um número dentro de um círculo de 32px, com fundo `--verde-claro`, texto `--texto`, 17px e peso 700.
- A caixa de copiar CEP é uma cápsula de 56px com fundo branco e borda `--borda-campo`, com o CEP à esquerda e o botão pequeno "copiar" à direita.
- Ao copiar, use `navigator.clipboard.writeText` e troque o texto do botão para "copiado!" por 2 segundos.

### 4.9 Divisória
- Use `<hr>` com `border-top: 1px solid var(--borda)` e margem vertical de 4px.
- Ela separa o formulário das notas e os cards do bloco "quem faz a coleta".

### 4.10 Rodapé
- Fundo branco, `border-top` de 1px `--borda` e padding de 20px por 24px por 24px.
- **Links**, com 18px, peso 700, `--verde-escuro`, sem sublinhado e 44px de `min-height`:
  - "O que pode ir para a reciclagem?", que leva às Dicas;
  - "Dúvidas e Reclamações: ligue 156", com `href="tel:156"`.
- Por último, o crédito "feito por @adalbertopita", com 15px e `--texto-credito`.
- No desktop, os links ficam em linha, com 40px entre eles, e o crédito fica alinhado à direita.

---

## 5. Ícones

- Use [Lucide](https://lucide.dev/icons/) como **SVG inline** (traço, `stroke-width` 2 a 2,5, `stroke-linecap/linejoin="round"`), ou a biblioteca `lucide` com tree-shaking. **Nunca** use emoji como ícone.
- Ícones em uso: `arrow-left`, `recycle`, `trash-2`, `external-link`, `info`, `copy`, `triangle-alert`, `map-pin`, `check`, `x` e `phone`.
- Ícone decorativo leva `aria-hidden="true"`. Botão só com ícone leva `aria-label`.
- **Tamanhos:** 18 a 22px dentro de botões e links, 22 a 28px dentro de círculos.

---

## 6. Telas

Os textos entre colchetes são dados dinâmicos.

### 6.1 Início (`/`)
1. Hero com o logo completo e a ilustração.
2. Área cinza com:
   - h1 "Digite o CEP da sua casa." e, na linha seguinte, "Mostraremos o dia e o horário da coleta.";
   - o campo de CEP;
   - a ajuda;
   - o botão principal "ver dias da coleta";
   - a divisória;
   - a nota "Vale para endereços da cidade de São Paulo. Não guardamos nenhuma das informações coletadas."
3. Rodapé.

- **Desktop:** o campo e o botão ficam lado a lado, em uma linha flex com 12px de espaço. O campo usa `flex: 1`.

### 6.2 Resultado
1. Topbar.
2. Área cinza com:
   - o CEP, com 15px em `--texto-suave`;
   - o h1 "[Rua], [Bairro]";
   - o card reciclável;
   - o card comum;
   - a divisória;
   - "Quem faz a coleta na sua rua: **[Loga|Ecourbis]**";
   - o botão secundário "conferir no site da [empresa]".
3. Rodapé.

### 6.3 Bairro atendido por duas empresas
- Vale para Artur Alvim, Vila Nova Conceição e Brooklin Paulista.
- A tela mostra:
  - o endereço;
  - a caixa de aviso "Falta só o número da casa";
  - o campo "Número da casa" com rótulo visível;
  - o botão principal;
  - a nota com a lista desses bairros.

### 6.4 Horário indisponível (fallback)
- A tela mostra:
  - o h1 "Quem recolhe o lixo da sua rua é a [empresa].";
  - um texto curto explicando a situação;
  - os 3 passos numerados: copiar o CEP, abrir o site e colar o CEP lá;
  - o botão principal "abrir site da [empresa]";
  - a nota "Prefere falar com alguém? Ligue 156".
- **Links oficiais:**
  - Loga: `https://www.loga.com.br/pesquisa-de-coleta/`
  - Ecourbis: `https://www.ecourbis.com.br/coleta/index.html`

### 6.5 CEP inválido
- É a própria home com o estado de erro, sem trocar de página. O topo continua com o logo completo e a ilustração.
- A mensagem é "Este CEP está incompleto." e, abaixo, "O CEP tem 8 números. Confira na conta de luz ou de água."
- Valide no `submit`, não a cada tecla. Depois do erro, coloque o foco de volta no campo.

### 6.6 CEP fora de São Paulo
- A tela mostra:
  - a topbar;
  - um círculo `--creme` de 64px com o ícone `map-pin` em `--vermelho`;
  - "CEP [00000-000] · [Cidade]";
  - o h1 "Este CEP não é da cidade de São Paulo.";
  - um texto curto;
  - o botão principal "digitar outro CEP".

### 6.7 Dicas
1. h1 "O que pode ir para a reciclagem?"
2. Card **Pode reciclar**, com ícone `check` sobre `--verde-claro` e lista de papel, plástico, metal e vidro.
3. Card **Não vai na reciclagem**, com ícone `x` em `--vermelho` sobre `--creme`.
4. A divisória.
5. Bloco "Entulho, móveis, óleo e eletrônicos", com o card `--creme` do Ecoponto mais perto (nome, endereço e distância) e o botão secundário "ver no mapa".
6. Bloco do 156, com fundo `--verde-escuro`, texto branco e o botão inverso "ligar para 156".

- **Desktop:** os dois primeiros cards ficam em uma linha de 2 colunas, e o bloco do Ecoponto e o bloco do 156 ficam em outra linha de 2 colunas.

---

## 7. Comportamento e estados

- **Envio do formulário:**
  1. Normalize o CEP, removendo tudo que não for dígito.
  2. Valide se tem 8 dígitos. Se não tiver, mostre o erro da 6.5.
  3. Busque o endereço.
  4. Confira se a cidade é São Paulo. Se não for, mostre a 6.6.
  5. Identifique a empresa responsável.
  6. Busque os horários. Se a busca falhar, mostre a 6.4.
- **Carregando:**
  - o botão fica com `aria-busy="true"`, desabilitado e com o texto "buscando…";
  - **não** use spinner de tela cheia;
  - se a resposta passar de 8 segundos, mostre o fallback 6.4.
- **Navegação:** use URLs com o CEP na query string (`/?cep=01310100`), para o botão voltar do celular funcionar. Não guarde o CEP em lugar nenhum.
- **Foco:** ao mostrar um resultado, mova o foco para o `h1` da nova tela (`tabindex="-1"`).
- **Movimento:** se houver transições, mantenha-as abaixo de 200ms e desligue com `prefers-reduced-motion`.

---

## 8. Acessibilidade (checklist)

- [ ] `lang="pt-BR"` e um `<title>` por tela, por exemplo "Reciclaí – dias da coleta".
- [ ] Um único `h1` por tela, sem pular níveis de título.
- [ ] Todos os alvos de toque com pelo menos 44×44px.
- [ ] Foco visível em todos os elementos interativos.
- [ ] Todos os campos com `label`, e os erros ligados por `aria-describedby`.
- [ ] Contraste de pelo menos 4,5:1, verificado com as cores da seção 2.1.
- [ ] Zoom de 200% sem quebrar o layout. Use `rem` no CSS final, com 1rem = 16px.
- [ ] Nada de texto dentro de imagem, exceto o logo, que tem `alt`.

---

## 9. Performance

- **Meta:** abaixo de 100 KB transferidos na primeira visita, sem contar a fonte.
- Imagens:
  - a ilustração em WebP, com `width` e `height` declarados para evitar salto de layout e `fetchpriority="high"`, porque fica acima da dobra;
  - os logos em PNG ou SVG otimizado.
- A fonte carrega com `display=swap`.
- Use CSS em um único arquivo, sem frameworks de CSS pesados.
- Nenhum JS pode bloquear a primeira renderização. Use `defer`.

---

## 10. Arquivos de imagem

| Arquivo | Uso |
|---|---|
| `logo-reciclai.png` | Logo completo (símbolo + "reciclaí"). Topo da home. |
| `logo-simbolo.png` | Só o símbolo. Cabeçalho das telas internas. |
| `skyline-sp.webp` | Ilustração da cidade (1368×574). Topo da home. |

---

## 11. Não fazer

- Não use gradientes, sombras fortes, cards com borda colorida só na lateral nem emoji.
- Não crie cores, raios ou tamanhos de fonte fora dos tokens.
- Não coloque mais de um botão vermelho por tela.
- Não use texto branco sobre verde-claro, verde-médio ou creme.
- Não use modais, pop-ups nem banners de cookies, porque não há cookies.
- Não exija login nem guarde o CEP.


## 12. Referencias Visuais

- As referencias visuais do site (telas) estão na pasta layout em formato html e dentro de um .zip