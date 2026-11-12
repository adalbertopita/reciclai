/*
 * Reciclaí: consulta da coleta pelo CEP.
 * JS puro (ES2017), sem build. Lê dados/cep/<5 dígitos>.json, dados/bairros.json e dados/meta.json.
 * O CEP só vive na URL (?cep=) e na memória: nada de cookie, localStorage ou analytics.
 */
(function () {
  'use strict'

  var LINKS = {
    Loga: 'https://www.loga.com.br/pesquisa-de-coleta/',
    Ecourbis: 'https://www.ecourbis.com.br/coleta/index.html',
  }
  var TEMPO_MAX_MS = 8000 // passou disso, mostra a tela "confira no site da empresa"
  var TEMPO_VIACEP_MS = 5000
  var DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
  var NOME_DIA = {
    seg: 'segunda',
    ter: 'terça',
    qua: 'quarta',
    qui: 'quinta',
    sex: 'sexta',
    sab: 'sábado',
    dom: 'domingo',
  }

  var tela = document.getElementById('tela')
  var hero = document.getElementById('hero')
  var topbar = document.getElementById('topbar')
  var HOME_HTML = tela.innerHTML
  var TITULO_HOME = document.title
  var consultaAtual = 0

  // ---------- utilidades ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function soDigitos(s) {
    return String(s || '').replace(/\D/g, '')
  }

  function formataCep(d) {
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5, 8) : d
  }

  /** Faixas de CEP da capital: 01000–05999 e 08000–08499. */
  function cepDaCapital(d) {
    var p = Number(d.slice(0, 5))
    return (p >= 1000 && p <= 5999) || (p >= 8000 && p <= 8499)
  }

  function chaveTexto(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function icone(id, tam, extra) {
    return (
      '<svg class="icone' + (extra ? ' ' + extra : '') + '" width="' + tam + '" height="' + tam +
      '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'
    )
  }

  function comTempo(promessa, ms) {
    return new Promise(function (ok, falha) {
      var t = setTimeout(function () {
        falha(new Error('tempo'))
      }, ms)
      promessa.then(
        function (v) {
          clearTimeout(t)
          ok(v)
        },
        function (e) {
          clearTimeout(t)
          falha(e)
        },
      )
    })
  }

  /** JSON ou null quando o arquivo não existe (404). Outros erros sobem. */
  function buscaJson(url) {
    return fetch(url).then(function (r) {
      if (r.status === 404) return null
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    })
  }

  /** ViaCEP direto do navegador. Devolve null se falhar ou demorar; {erro:true} se o CEP não existir. */
  function viaCep(d) {
    return comTempo(buscaJson('https://viacep.com.br/ws/' + d + '/json/'), TEMPO_VIACEP_MS).catch(function () {
      return null
    })
  }

  var cacheMeta = null
  function meta() {
    if (!cacheMeta) cacheMeta = buscaJson('dados/meta.json').catch(function () {
      return null
    })
    return cacheMeta
  }

  // ---------- textos ----------

  /** ['seg','qua','sex'] -> "Segunda, quarta e sexta"; seg..sab -> "Segunda a sábado". */
  function textoDias(dias) {
    var ds = DIAS.filter(function (d) {
      return dias.indexOf(d) >= 0
    })
    if (!ds.length) return ''
    var t
    if (ds.length === 7) t = 'todos os dias'
    else {
      var i0 = DIAS.indexOf(ds[0])
      var seguidos = ds.every(function (d, i) {
        return DIAS.indexOf(d) === i0 + i
      })
      if (seguidos && ds.length >= 3) t = NOME_DIA[ds[0]] + ' a ' + NOME_DIA[ds[ds.length - 1]]
      else {
        var nomes = ds.map(function (d) {
          return NOME_DIA[d]
        })
        t = nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
      }
    }
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  /** "entre 20h30 e 23h" -> "entre <strong>20h30</strong> e <strong>23h</strong>". */
  function textoHora(c) {
    if (c.horario) return esc(c.horario).replace(/(\d{1,2}h(?:\d{2})?)/g, '<strong>$1</strong>')
    if (c.turno === 'noturno') return '<strong>à noite</strong>'
    if (c.turno === 'diurno') return '<strong>durante o dia</strong>'
    return ''
  }

  // ---------- pedaços de tela ----------

  function cardColeta(tipo, c, conteiner, nivel) {
    var h = 'h' + nivel
    var reciclavel = tipo === 'seletiva'
    var topo =
      '<div class="card__topo">' +
      '<span class="circulo ' + (reciclavel ? 'circulo--verde' : 'circulo--creme') + '">' +
      icone(reciclavel ? 'reciclar' : 'lixo', 24) +
      '</span><div>' +
      '<' + h + ' class="card__titulo">' + (reciclavel ? 'Lixo reciclável' : 'Lixo comum') + '</' + h + '>' +
      '<p class="card__legenda">' + (reciclavel ? 'coleta seletiva' : 'coleta domiciliar') + '</p>' +
      '</div></div>'
    var corpo
    if (c && c.dias && c.dias.length) {
      var hora = textoHora(c)
      var dica = reciclavel
        ? 'Papel, plástico, metal e vidro. Limpos e secos.'
        : 'Restos de comida, papel higiênico e o que não é reciclável.'
      if (!reciclavel && conteiner) dica += ' Na sua rua também há contêiner.'
      corpo =
        '<p class="card__dias">' + textoDias(c.dias) + '</p>' +
        (hora ? '<p class="card__hora">' + hora + '</p>' : '') +
        '<p class="card__dica">' + dica + '</p>'
    } else if (!reciclavel && conteiner) {
      corpo =
        '<p class="card__dias card__dias--sem">Contêiner na rua</p>' +
        '<p class="card__dica">Coloque o lixo comum no contêiner da sua rua. Ele é esvaziado com frequência.</p>'
    } else if (reciclavel) {
      corpo =
        '<p class="card__dias card__dias--sem">Não passa na sua rua</p>' +
        '<p class="card__dica">Leve os recicláveis a um Ecoponto ou PEV. <a href="dicas.html">Veja como</a>.</p>'
    } else {
      corpo =
        '<p class="card__dias card__dias--sem">Sem horário publicado</p>' +
        '<p class="card__dica">Confira no site da empresa, no botão abaixo.</p>'
    }
    return '<section class="card">' + topo + corpo + '</section>'
  }

  function botaoEmpresa(empresa, principal) {
    return (
      '<a class="btn' + (principal ? '' : ' btn--outline') + '" href="' + LINKS[empresa] +
      '" target="_blank" rel="noopener">' +
      (principal ? 'abrir site da ' : 'conferir no site da ') + empresa + icone('externo', 18) + '</a>'
    )
  }

  function blocoEndereco(d, via, comoTitulo) {
    var partes = []
    if (via && !via.erro) {
      if (via.logradouro) partes.push(via.logradouro)
      if (via.bairro) partes.push(via.bairro)
    }
    var linha = partes.length ? partes.join(', ') : 'Seu endereço'
    return (
      '<div class="endereco"><p class="endereco__cep">CEP ' + formataCep(d) + '</p>' +
      (comoTitulo
        ? '<h1 class="titulo" tabindex="-1">' + esc(linha) + '</h1>'
        : partes.length
          ? '<p class="endereco__rua">' + esc(linha) + '</p>'
          : '') +
      '</div>'
    )
  }

  function rodapeDados(m) {
    return m && m.mesAno
      ? '<p class="atualizado">Horários de ' + esc(m.mesAno) + '. Eles podem mudar, então vale conferir no site da empresa.</p>'
      : ''
  }

  // ---------- telas ----------

  function mostra(html, titulo, interna) {
    hero.hidden = !!interna
    topbar.hidden = !interna
    tela.innerHTML = html
    document.title = titulo
    window.scrollTo(0, 0)
    var h1 = tela.querySelector('h1')
    if (h1 && interna) h1.focus()
  }

  function telaHome(erro) {
    mostra(HOME_HTML, TITULO_HOME, false)
    ligaForm()
    if (!erro) return
    var campo = document.getElementById('cep')
    var caixa = document.getElementById('cep-erro')
    campo.value = erro.valor || ''
    campo.setAttribute('aria-invalid', 'true')
    campo.setAttribute('aria-describedby', 'cep-erro cep-ajuda')
    caixa.className = 'erro'
    caixa.setAttribute('role', 'alert')
    caixa.innerHTML =
      icone('alerta', 22) +
      '<div><p class="erro__titulo">' + erro.titulo + '</p><p class="erro__texto">' + erro.texto + '</p></div>'
    caixa.hidden = false
    campo.focus()
  }

  var ERRO_INCOMPLETO = {
    titulo: 'Este CEP está incompleto.',
    texto: 'O CEP tem 8 números. Confira na conta de luz ou de água.',
  }
  var ERRO_INEXISTENTE = {
    titulo: 'Não encontramos este CEP.',
    texto: 'Confira os números na conta de luz ou de água.',
  }

  function telaResultado(d, via, arq, opcoes, m) {
    var setores = opcoes.map(function (o) {
      return arq.setores[o.setor]
    })
    var empresas = []
    setores.forEach(function (s) {
      if (empresas.indexOf(s.empresa) < 0) empresas.push(s.empresa)
    })
    var html = '<div class="conteudo">' + blocoEndereco(d, via, true)

    if (opcoes.length === 1) {
      var s = setores[0]
      html +=
        '<div class="cards">' +
        cardColeta('seletiva', s.seletiva, s.conteiner, 2) +
        cardColeta('comum', s.comum, s.conteiner, 2) +
        '</div>'
    } else {
      // Rótulos: o nome da rua; se a rua se repete, é a mesma rua com horários por trecho.
      var rotulos = opcoes.map(function (o) {
        return (o.ruas || []).join(' / ') || 'Sua rua'
      })
      // Mesma rua escrita com ou sem acento ("Rua Grauna" e "Rua Graúna") conta como a mesma.
      var chaves = rotulos.map(chaveTexto)
      var acentos = function (r) {
        var nfd = r.normalize('NFD')
        return nfd.length - nfd.replace(/[\u0300-\u036f]/g, '').length
      }
      var nomePorChave = {}
      rotulos.forEach(function (r, i) {
        var atual = nomePorChave[chaves[i]]
        if (!atual || acentos(r) > acentos(atual)) nomePorChave[chaves[i]] = r
      })
      var repete = chaves.some(function (c, i) {
        return chaves.indexOf(c) !== i
      })
      var contagem = {}
      var titulos = chaves.map(function (c) {
        var nome = nomePorChave[c]
        var n = chaves.filter(function (x) {
          return x === c
        }).length
        if (n === 1) return nome
        contagem[c] = (contagem[c] || 0) + 1
        return nome + ': trecho ' + contagem[c]
      })
      var umaEmpresa = empresas.length === 1
      html +=
        '<div class="aviso"><span class="circulo circulo--creme">' + icone('info', 22) + '</span>' +
        '<div class="aviso__corpo"><h2 class="aviso__titulo">' +
        (repete ? 'Depende do trecho da rua' : 'Qual é a sua rua?') +
        '</h2><p class="texto">' +
        (repete
          ? 'O caminhão passa em dias diferentes conforme o trecho da rua. Veja as opções abaixo. Se ficar em dúvida, confira no site da ' +
            (umaEmpresa ? empresas[0] : 'empresa') + '.'
          : 'Este CEP vale para mais de uma rua, e cada uma tem o seu horário. Procure a sua abaixo.') +
        '</p></div></div>'
      opcoes.forEach(function (o, i) {
        var s = setores[i]
        html +=
          '<section class="opcao"><div><h2 class="opcao__titulo">' + esc(titulos[i]) + '</h2>' +
          (umaEmpresa ? '' : '<p class="opcao__sub">coleta feita pela ' + s.empresa + '</p>') +
          '</div><div class="cards">' +
          cardColeta('seletiva', s.seletiva, s.conteiner, 3) +
          cardColeta('comum', s.comum, s.conteiner, 3) +
          '</div></section>'
      })
    }

    html += '<hr><div class="rodape-resultado">'
    if (empresas.length === 1) {
      html +=
        '<p class="empresa">Quem faz a coleta na sua rua: <strong>' + empresas[0] + '</strong></p>' +
        botaoEmpresa(empresas[0], false)
    } else {
      html +=
        '<p class="empresa">Quem faz a coleta: <strong>Loga</strong> ou <strong>Ecourbis</strong>, conforme o trecho.</p>' +
        botaoEmpresa('Loga', false) +
        botaoEmpresa('Ecourbis', false)
    }
    html += '</div>' + rodapeDados(m) + '</div>'
    mostra(html, 'Reciclaí – dias da coleta do CEP ' + formataCep(d), true)
  }

  function telaSemHorario(d, via, empresas, motivo) {
    var uma = empresas.length === 1
    var nome = uma ? empresas[0] : 'Loga ou a Ecourbis'
    var html =
      '<div class="conteudo">' + blocoEndereco(d, via, false) +
      '<div class="aviso__corpo"><h1 class="titulo" tabindex="-1">Quem recolhe o lixo da sua rua é a ' + nome + '.</h1>' +
      '<p class="texto">' +
      (motivo === 'tempo'
        ? 'Não conseguimos trazer o horário agora. '
        : 'Ainda não temos o horário deste CEP. ') +
      (uma ? 'Veja no site da empresa, é rápido:' : 'No seu bairro trabalham as duas empresas. Veja nos sites delas:') +
      '</p></div>' +
      '<ol class="passos">' +
      '<li><span class="passos__n">1</span><div class="passos__corpo"><p>Copie o seu CEP:</p>' +
      '<div class="copiar"><span class="copiar__cep">' + formataCep(d) + '</span>' +
      '<button type="button" class="btn btn--sm" id="btn-copiar" data-cep="' + formataCep(d) + '">' +
      icone('copiar', 16) + '<span>copiar</span></button></div></div></li>' +
      '<li><span class="passos__n">2</span><p class="passos__corpo">' +
      (uma
        ? 'Toque no botão abaixo para abrir o site da ' + nome + '.'
        : 'Toque num dos botões abaixo. Se o primeiro site não achar o seu CEP, tente o outro.') +
      '</p></li>' +
      '<li><span class="passos__n">3</span><p class="passos__corpo">Cole o CEP no campo de busca e toque em pesquisar.</p></li>' +
      '</ol>' +
      (uma ? botaoEmpresa(empresas[0], true) : botaoEmpresa('Loga', false) + botaoEmpresa('Ecourbis', false)) +
      '<hr><p class="nota">Prefere falar com alguém? <a href="tel:156"><strong>Ligue 156</strong></a>, a central da Prefeitura.</p>' +
      '</div>'
    mostra(html, 'Reciclaí – coleta do CEP ' + formataCep(d), true)
    var b = document.getElementById('btn-copiar')
    b.addEventListener('click', function () {
      var rotulo = b.querySelector('span')
      var feito = function () {
        rotulo.textContent = 'copiado!'
        setTimeout(function () {
          rotulo.textContent = 'copiar'
        }, 2000)
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(b.getAttribute('data-cep')).then(feito, function () {})
      }
    })
  }

  function telaForaSP(d, via) {
    var cidade = via && !via.erro && via.localidade ? ' · ' + esc(via.localidade) + (via.uf ? '/' + esc(via.uf) : '') : ''
    var html =
      '<div class="conteudo conteudo--fora">' +
      '<span class="circulo circulo--alerta circulo--grande">' + icone('pino', 32) + '</span>' +
      '<div class="aviso__corpo"><p class="endereco__cep">CEP ' + formataCep(d) + cidade + '</p>' +
      '<h1 class="titulo" tabindex="-1">Este CEP não é da cidade de São Paulo.</h1>' +
      '<p class="texto">Este site mostra a coleta só de endereços da capital. Para outra cidade, procure a prefeitura de lá.</p></div>' +
      '<a class="btn" href="./">digitar outro CEP</a>' +
      '</div>'
    mostra(html, 'Reciclaí – CEP fora de São Paulo', true)
  }

  // ---------- empresa sem horário (fallback) ----------

  var cacheBairros = null
  function bairros() {
    if (!cacheBairros) cacheBairros = buscaJson('dados/bairros.json').catch(function () {
      cacheBairros = null
      return null
    })
    return cacheBairros
  }

  var ABREVIACOES = [
    [/^jd /, 'jardim '],
    [/^vl /, 'vila '],
    [/^pq /, 'parque '],
    [/^cj /, 'conjunto '],
    [/^cid /, 'cidade '],
  ]

  /** Empresa pelo bairro do ViaCEP (lista do Recicla Sampa) ou, sem isso, pela maioria do prefixo. */
  function empresasProvaveis(via, arq, lista) {
    if (via && !via.erro && via.bairro && lista) {
      var ch = chaveTexto(via.bairro)
      ABREVIACOES.forEach(function (a) {
        ch = ch.replace(a[0], a[1])
      })
      var b = lista[ch] || lista[ch.replace(/^(jardim|vila|parque) /, '')]
      if (b && b.empresas && b.empresas.length) return b.empresas
    }
    if (arq) {
      var n = { Loga: 0, Ecourbis: 0 }
      Object.keys(arq.ceps).forEach(function (cep) {
        arq.ceps[cep].forEach(function (o) {
          var s = arq.setores[o.setor]
          if (s) n[s.empresa]++
        })
      })
      if (n.Loga || n.Ecourbis) {
        if (n.Loga && n.Ecourbis && Math.min(n.Loga, n.Ecourbis) / Math.max(n.Loga, n.Ecourbis) > 0.25)
          return ['Loga', 'Ecourbis']
        return [n.Loga >= n.Ecourbis ? 'Loga' : 'Ecourbis']
      }
    }
    return ['Loga', 'Ecourbis']
  }

  // ---------- consulta ----------

  function ocupado(sim) {
    var b = document.getElementById('btn-cep')
    if (!b) return
    b.disabled = sim
    if (sim) {
      b.setAttribute('aria-busy', 'true')
      b.textContent = 'buscando…'
    } else {
      b.removeAttribute('aria-busy')
      b.textContent = 'ver dias da coleta'
    }
  }

  function consultar(d) {
    var id = ++consultaAtual
    var vale = function () {
      return id === consultaAtual
    }
    ocupado(true)

    if (!cepDaCapital(d)) {
      return viaCep(d).then(function (via) {
        if (!vale()) return
        if (via && via.erro) return telaHome(Object.assign({ valor: formataCep(d) }, ERRO_INEXISTENTE))
        telaForaSP(d, via)
      })
    }

    var pVia = viaCep(d)
    var pArq = buscaJson('dados/cep/' + d.slice(0, 5) + '.json')
    return comTempo(Promise.all([pArq, pVia, meta()]), TEMPO_MAX_MS)
      .then(function (r) {
        if (!vale()) return
        var arq = r[0]
        var via = r[1]
        var opcoes = arq && arq.ceps[d]
        if (opcoes && opcoes.length) return telaResultado(d, via, arq, opcoes, r[2])
        if (via && via.erro) return telaHome(Object.assign({ valor: formataCep(d) }, ERRO_INEXISTENTE))
        return bairros().then(function (lista) {
          if (vale()) telaSemHorario(d, via, empresasProvaveis(via, arq, lista), 'sem-dado')
        })
      })
      .catch(function () {
        if (!vale()) return
        // Lento ou sem rede: diz quem atende, se der, e leva ao site oficial.
        Promise.all([pVia.catch(function () {
          return null
        }), bairros()]).then(function (r) {
          if (vale()) telaSemHorario(d, r[0], empresasProvaveis(r[0], null, r[1]), 'tempo')
        })
      })
  }

  // ---------- navegação ----------

  function cepDaUrl() {
    var m = /[?&]cep=([^&#]*)/.exec(location.search)
    return m ? soDigitos(decodeURIComponent(m[1])) : ''
  }

  function rota() {
    var d = cepDaUrl()
    if (!d) return telaHome()
    if (d.length !== 8) return telaHome(Object.assign({ valor: formataCep(d) }, ERRO_INCOMPLETO))
    consultar(d)
  }

  function ligaForm() {
    var form = document.getElementById('form-cep')
    var campo = document.getElementById('cep')
    if (!form || !campo) return
    campo.addEventListener('input', function () {
      var d = soDigitos(campo.value).slice(0, 8)
      var f = formataCep(d)
      if (campo.value !== f) campo.value = f
      // Some o erro quando a pessoa volta a digitar.
      if (campo.getAttribute('aria-invalid') === 'true') {
        campo.removeAttribute('aria-invalid')
        campo.setAttribute('aria-describedby', 'cep-ajuda')
        var caixa = document.getElementById('cep-erro')
        caixa.hidden = true
        caixa.innerHTML = ''
      }
    })
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var d = soDigitos(campo.value)
      if (d.length !== 8) return telaHome(Object.assign({ valor: campo.value }, ERRO_INCOMPLETO))
      history.pushState(null, '', '?cep=' + d)
      consultar(d)
    })
  }

  window.addEventListener('popstate', rota)
  rota()
})()
