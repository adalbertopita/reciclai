var params = {
    urlApi: 'https://webservices.loga.com.br/sgo/eresiduos/BuscaPorLatLng',
    //urlApi: 'https://loga-apis-hom.clarifysistemas.com.br/sgo/eresiduos/BuscaPorLatLng',
    //urlApi: 'http://localhost/sgo/eresiduos/BuscaPorLatLng',
    //urlEcoboxApi: 'http://localhost/sgo/eresiduos/RecipientesPorArea',
    //urlEcoboxApi: 'https://loga-apis-hom.clarifysistemas.com.br/sgo/eresiduos/RecipientesPorArea',
	urlEcoboxApi: 'https://webservices.loga.com.br/sgo/eresiduos/RecipientesPorArea',
    raioLogradouro: 100,
    raioConteinersPev: 1000,
    raioEcoBoxVidros: 300
};
var shortAddress = "";
var geocoder = geocoder = new google.maps.Geocoder();
var center = new google.maps.LatLng(-23.529994, -46.663341);
var myOptions = {
    center: center,
    zoom: 14,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    fullscreenControl: false,
    zoomControl: false,
    scaleControl: false
};
var map = new google.maps.Map(document.getElementById("map-canvas"), myOptions);
google.maps.event.addListenerOnce(map, 'idle', function () {
    jQuery('.gm-style-iw').prev('div').remove();
});

// Inicializa listeners do mapa apis carregamento completo
google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
    if (typeof initializeMapListeners === 'function') {
        initializeMapListeners();
    } else {
        console.error('[EcoBox] Função initializeMapListeners não encontrada');
    }
});

var marcadores = [];

function load(isMobile, msg) {
    $("#div-results" +
        (isMobile ? "-m" : "")
    ).html(
      '<div style="text-align: center; margin-top: 30px;">' +
        '<img src="assets/img/loading.gif" style="width: 60px;" />' + 
        (msg ? '<br />' + msg : '') +
      '</div>'
    );
}

function changeVisibility(idx) {
    if ($('#divDetalheHoras_'+idx).css('display') == 'none') {
        $('#divDetalheHoras_'+idx).css('display', 'block');
        $('#result-header--item_'+idx).removeClass('toggle-on');
        $('#result-header--item_'+idx).addClass('toggle-off');
        $('#imgBtnDownUp_'+idx).attr('src', 'assets/img/top_white.png');
    } else {
        $('#divDetalheHoras_'+idx).css('display', 'none');
        $('#result-header--item_'+idx).removeClass('toggle-off');
        $('#result-header--item_'+idx).addClass('toggle-on');
        $('#imgBtnDownUp_'+idx).attr('src', 'assets/img/down.png');
    }
}

function horaCol(dia, data, key, hasdia) {
    return '<tr>' +
            '<td>' + dia + '</td>' +
            '<td>' +
                (data.Subprefeitura == 'SE' && data.Mecanizada == null && data.Domiciliar != null && dia == 'Domingo' ? 'Especial Noturno' :
                (data.Mecanizada != null && data.Mecanizada[hasdia] ?
                    (data.Mecanizada[key] != data.Mecanizada['Periodo'] && !data.Mecanizada['ConsultaMunicipeHideHorario'] && !data.Mecanizada['ConsultaMunicipeSetorEmRevisao'] ? data.Mecanizada[key] : data.Mecanizada['Periodo']) : 
                (data.Domiciliar != null && data.Domiciliar[hasdia] ?
                        (data.Domiciliar[key] != data.Domiciliar['Periodo'] && !data.Domiciliar['ConsultaMunicipeHideHorario'] && !data.Domiciliar['ConsultaMunicipeSetorEmRevisao'] ? data.Domiciliar[key] : data.Domiciliar['Periodo']) : ''))) +
            '</td>' +
            '<td>'
                + (data.Seletiva != null && data.Seletiva[hasdia] ?
                (data.Seletiva[key] != data.Seletiva['Periodo'] && !data.Seletiva['ConsultaMunicipeHideHorario'] && !data.Seletiva['ConsultaMunicipeSetorEmRevisao'] ? data.Seletiva[key] : data.Seletiva['Periodo']) : '') +
            '</td>' +
        '</tr>';
        
}
function getLogradouro (data) {
    return ((data.Tipo != null ? data.Tipo + ' ' : '')
        + (data.Titulo != null ? data.Titulo + ' ' : '')
        + (data.Preposicao != null ? data.Preposicao + ' ' : '')
        + (data.Logradouro != null ? data.Logradouro + ' ' : '')).replace(/  /g, ' ');
}

function infoSetorRevisao(event) {
  event.stopPropagation();

  const conteudo = `
    <div id="flutuante">
      Os horários da via estão indisponíveis no momento em virtude de otimização operacional, entendemos que mudanças dessa 
      natureza impactam no dia a dia da população, porém, o aumento de resíduos na região exige readequação da logística de coleta. 
      Em breve os horários estarão disponíveis novamente, para mais dúvidas, 
	  <a href="https://www.loga.com.br/fale-com-a-loga/" target="_blank">entre em contato conosco</a>.
    </div>
  `;

  $("#flutuante").remove();

  $("body").append(conteudo);

  let $pop = $("#flutuante");
  let rect = event.target.getBoundingClientRect();
  let vw = $(window).width();
  let vh = $(window).height();

  // calcula posição preferida (direita/abaixo)
  let left = rect.right + 8;
  let top  = rect.bottom + 8;

  // se não couber na horizontal, tenta esquerda
  if (left + $pop.outerWidth() > vw) {
    left = rect.left - $pop.outerWidth() - 8;
  }
  // se não couber na vertical, tenta acima
  if (top + $pop.outerHeight() > vh) {
    top = rect.top - $pop.outerHeight() - 8;
  }

  $pop.css({left, top});

  const removerSeClicarForaDoPop = e => {
    if (e.target !== event.target && !$.contains(event.target, e.target)) {
      $pop.remove();
      $(document).off("click", removerSeClicarForaDoPop);
      $(document).off("touchstart", removerSeClicarForaDoPop);
    }
  };

  $(document).on("click", removerSeClicarForaDoPop);
  $(document).on("touchstart", removerSeClicarForaDoPop);
  $(document).one("keydown", e => e.key === "Escape" && $pop.remove());
}

function mountResult (data, isMobile, idx) {
    var result = '';

    result += '<div id="result-header--item_' + idx + '" class="result-header--item toggle-on" for="toggle_244441716_' + idx + '"><!-- div 1 -->';

    result += '<div class="Logradouro" onclick="changeVisibility(' + idx + '); return false;"><!-- div 2 -->';

    result += '<b>Logradouro:</b> '
        + getLogradouro(data) + '<br>';
    result += '<b>Subprefeitura:</b> ' + (data.Subprefeitura == null ? '' : data.Subprefeitura) + '<br>';
    result += '<b>CEP:</b> ' + (data.Cep == null ? '' : data.Cep) + '';

    if (
      (data.Domiciliar != null && data.Domiciliar['ConsultaMunicipeSetorEmRevisao']) ||
      (data.Seletiva != null && data.Seletiva['ConsultaMunicipeSetorEmRevisao']) ||
      (data.Mecanizada != null && data.Mecanizada['ConsultaMunicipeSetorEmRevisao'])
    ) {
      const icoSetorRevisao = `<i class="icoSetorRevisao"></i>`;
      result += `<br><b style="font-size: 1.5rem;">Via em revisão ${icoSetorRevisao} </b>`;
      result += '<i class="infoSetorRevisao" onmouseover="infoSetorRevisao(event)"></i>';
    }

    result += '<label class="btnShowHide"><img id="imgBtnDownUp_' + idx + '" src="assets/img/down.png" style="height: 25px; width: auto; vertical-align: middle;" /></label>';
    result += '</div><!-- end div 2 -->';
    result += '<div style="display: none;" id="divDetalheHoras_' + idx + '"><!-- div 3 -->';
    result += '<table class="result-table--result">';
    
    result +=
        '<thead>' +
            '<tr>' +
                '<th>Dia</th>' +
                '<th>Domiciliar</th>' +
                '<th>Seletiva</th>' +
            '</tr>'+
        '</thead>';
    
    result += '<tbody>';
    
    result +=
        '<tr>' +
            '<td>Período</td>'+
            '<td>'+ (data.Mecanizada != null ? 'MECANIZADA' : (data.Domiciliar != null ? data.Domiciliar.Periodo : '')) + '</td>'+
            '<td>'+ (data.Seletiva != null ? data.Seletiva.Periodo : '') + '</td>'+
        '</tr>';

    result += horaCol('Segunda', data, 'HoraSeg', 'HasSeg');
    result += horaCol('Terça', data, 'HoraTer', 'HasTer');
    result += horaCol('Quarta', data, 'HoraQua', 'HasQua');
    result += horaCol('Quinta', data, 'HoraQui', 'HasQui');
    result += horaCol('Sexta', data, 'HoraSex', 'HasSex');
    result += horaCol('Sábado', data, 'HoraSab', 'HasSab');
    result += horaCol('Domingo', data, 'HoraDom', 'HasDom');

    result += '</tbody>';

    result += '</table>';
    result += '</div><!-- end div 3 -->';
    result += '</div><!-- end div 1 -->';
    
    return result;
}

function callApi(lat, lng, address, isMobile, retrying) {
    if (typeof callApi.retries == 'undefined' || !retrying) {
      callApi.retries = 0;
    }

    // Loading
    switch (callApi.retries) {
      case 1: load(isMobile, 'Consultando informações...'); break;
      case 2: load(isMobile, 'Por favor, aguarde...'); break;
      default: load(isMobile);
    }

    // Apaga marcadores antigos.
    for(var idx = marcadores.length - 1; idx >= 0; idx--) {
      try {
        marcadores[idx].setMap(null);
        marcadores[idx] = null;
      } catch (e) {}
      delete marcadores[idx]
    }
    marcadores = marcadores.filter(m => m);

    // Request
    jQuery.ajax({
        method: 'GET',
        url: params.urlApi,
        data: {
            distance: params.raioLogradouro,
            lat: lat,
            lng: lng,
            distanceEBVidro: params.raioEcoBoxVidros
        },
        dataType: 'json'
    }).done(function (data) {
        $('#bottom-results').addClass('houvePesquisa');
        if (data.naoAtendido) {
            $("#div-results" +
                (isMobile ? "-m" : "")
            ).html('<div style="text-align: center; margin-top: 30px;">Endereço não atendido pela LOGA</div>');
        } else if (data.found) {
            var result = '';
            result = '<div class="' + (isMobile ? '' : 'div-content-result') + '"><!-- div 0 -->';

            result +=
                '<div class="result-message">' +
                    '<p>' +
                        '<img src="assets/img/pin.png" class="message-marker--icon">' +
                        '<span class="message-marker-msg">Caso tenha divergência na localização, arraste o marcador para o endereço correto.</span>' +
                    '</p>' +
                '</div>';

            for (var idx = 0; idx < data.result.Logradouros.length; idx++) {
                result += mountResult(data.result.Logradouros[idx], isMobile, idx);
            }

            result += '<table><tfoot><tr><td>';
            result += '<p class ="observacoes">Observações</p>';
            result += '<p class ="desc">Domiciliar e Seletiva: Atenção: Os horários, quando informados, estão sujeitos à defasagem em virtude dos seguintes fatores: aumento de resíduos disponibilizados no setor, principalmente às segundas e terças-feiras, trânsito, desvios, interdição de vias, e/ou quaisquer outros alheios à operação.</p>';
            result += '<p class ="desc">PEV Público Seletiva: para disponibilização dos resíduos recicláveis 24 horas por dia.</p>';
            result += '<p class ="desc">Coleta Mecanizada com Contêineres: para disponibilização dos Resíduos Domiciliares 24 horas por dia.</p>';
            result += '</td></tr></tfoot></table>';

            result += '</div><!-- end div 0 -->';

            $("#div-results" +
                (isMobile ? "-m" : "")
            ).html(result);

            if (data.result.Logradouros.length == 1) {
                changeVisibility(0);
            } else if (shortAddress != '') {
                var idxProx = -1;
                var lastProx = 100000;
                for (var idx = 0; idx < data.result.Logradouros.length; idx++)
                {
                    var ld = levenshteinDistance(shortAddress, getLogradouro(data.result.Logradouros[idx]).toUpperCase());
                    //console.log('a1: ' + shortAddress + ' \r\na2: ' + getLogradouro(data.result.Logradouros[idx]).toUpperCase() + ' \r\nld ' + ld);
                    if (ld <= 3 && ld < lastProx) {
                        idxProx = idx;
                    }
                }
                if (idxProx > -1) {
                    changeVisibility(idxProx);
                }
            }
        } else {
            $("#div-results" +
                (isMobile ? "-m" : "")
            ).html('<div style="text-align: center; margin-top: 30px;">Nenhum resultado encontrado para o endereço ' + address + '</div>');
        }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      if (++callApi.retries < 3) {
        setTimeout(function() {
          callApi(lat, lng, address, isMobile, true);
        }, 1000);
      } else {
        $("#div-results" + (isMobile ? "-m" : "")).html(
          '<div style="text-align: center; margin-top: 30px;">Falha na consulta.</div>' +
          '<div style="text-align: center;">Tente novamente!</div>'
        );
      }
    });
}

function levenshteinDistance(a, b) {
    if (a.length == 0) return b.length;
    if (b.length == 0) return a.length;

    var matrix = [];

    // increment along the first column of each row
    var i;
    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    var j;
    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1)); // deletion
            }
        }
    }
    return matrix[b.length][a.length];
}

function searchAddress (address, isMobile) {
    if (address == null || address.trim() == '') {
        return;
    }
    else if(!address.toLowerCase().includes('são paulo')){
        address += ' são paulo';
    }
    shortAddress = "";
    load(isMobile);
    geocoder.geocode({ 'address': address }, function (results, status) {
        if (status == 'OK') {

            for (var idx = 0; idx < results[0].address_components.length; idx++) {
                if (results[0].address_components[idx].types.includes("route")) {
                    shortAddress = results[0].address_components[idx].short_name.toUpperCase().replace(/\./g, '');
                    break;
                }
            }
            //console.log(shortAddress)

            map.setCenter(results[0].geometry.location);
            setMarker(results[0].geometry.location);
            callApi(results[0].geometry.location.lat(), results[0].geometry.location.lng(), address, isMobile);
        } else if (navigator.onLine === false) {
            $("#div-results" + (isMobile ? "-m" : "")).html(
              'Ops! Parece que você está sem conexão com a internet. Verifique sua rede e tente novamente.'
            );
        } else {
            $("#div-results" + (isMobile ? "-m" : "")).html(
              'Não foi possível encontrar o endereço. Use Endereço + nº + Bairro ou Cep.'
            );
        }

    });
}

var marker = null;

function setMarker(position, isMobile) {
    if (marker == null) {
        marker = new google.maps.Marker({
            position: position,
            map: map,
            draggable: true,
        });
        handleIsMobile = isMobile;
        marker.addListener('dragend', handleEndDrag);
        const infowindow = new google.maps.InfoWindow({
            content: 'Caso tenha divergência no endereço, arraste o marcador para o endereço correto',
            maxWidth: 280
        });
        infowindow.open(map, marker);
    } else {
        marker.setPosition(position);
    }

}

var handleIsMobile = false;
function handleEndDrag(event) {
    callApi(event.latLng.lat(), event.latLng.lng(), '', handleIsMobile);
}

function useMyLocation(isMobile) {
    if ("geolocation" in navigator) {
        //check geolocation available 
        //try to get user current location using getCurrentPosition() method
        navigator.geolocation.getCurrentPosition(function (position) {
            load(isMobile);
            var positionMarker = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
            map.setCenter(positionMarker);
            map.setZoom(16);
            handleIsMobile = isMobile;
            setMarker(positionMarker, isMobile);
            callApi(position.coords.latitude, position.coords.longitude, '', isMobile);
        });
    } else {
        alert("Browser doesn't support geolocation!");
    }
}

function showResultsMobile() {
    $('#bottom-results').toggleClass('compact');
}

$(document).ready(function() {
    let inputSearch = document.getElementById("inputSearch");
    $(inputSearch).keypress(function (event) {
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if (keycode == '13') {
            searchAddress($('#inputSearch').val(), false);
        }
    });
    $('#inputSearchM').keypress(function (event) {
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if (keycode == '13') {
            searchAddress($('#inputSearchM').val(), true);
        }
    });

    // Autocomplete Google Maps
    const autocomplete = new google.maps.places.Autocomplete(inputSearch, {
        bounds: { // Limitando consulta em uma área; 0.1 = 10Km
            north: center.lat() + (0.01 * params.raioLogradouro),
            south: center.lat() - (0.01 * params.raioLogradouro),
            east: center.lng() + (0.01 * params.raioLogradouro),
            west: center.lng() - (0.01 * params.raioLogradouro)
        },
        componentRestrictions: { country: "br" },
        fields: ["address_components", "geometry", "icon", "name"],
        strictBounds: false,
        types: ["address"],
    });

    autocomplete.addListener("place_changed", () => {
        $('#button-addon2').click();
    });
})

var debounceTimer = null;
var markerEcoBox = [];
var ecoBoxCluster = null;
var lastInfoWindow = null;
function clearMarkers(markers) {
    if (markers != null && markers.length > 0) {
        for (var idx = 0; idx < markers.length; idx++) {
            markers[idx].setMap(null);
            markers[idx] = null;
        }
    }
    return [];
}

function clearEcoBoxMarkers() {
    if (ecoBoxCluster) {
        ecoBoxCluster.clearMarkers();
        ecoBoxCluster.setMap(null);
        ecoBoxCluster = null;
    }
    markerEcoBox = clearMarkers(markerEcoBox);
}

function updateEcoBoxCluster() {
    // UVR (TipoId 999) fica fora do cluster — sempre visível individualmente
    var markersCluster = [];
    markerEcoBox.forEach(function (m) {
        if (m.tipoId === 999) {
            m.setMap(map);
        } else {
            markersCluster.push(m);
        }
    });

    if (typeof markerClusterer === 'undefined') {
        console.error('[EcoBox] Biblioteca MarkerClusterer não carregada');
        markersCluster.forEach(function (m) { m.setMap(map); });
        return;
    }
    ecoBoxCluster = new markerClusterer.MarkerClusterer({
        map: map,
        markers: markersCluster,
        renderer: {
            render: function ({ count, position }) {
                return new google.maps.Marker({
                    position: position,
                    label: { text: String(count), color: '#fff', fontSize: '12px' },
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 18,
                        fillColor: '#2e7d32',
                        fillOpacity: 0.9,
                        strokeColor: '#fff',
                        strokeWeight: 2
                    },
                    zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
                });
            }
        }
    });
}

function setMarkerEcoBox(items) {
    var item = items[0];
    var tipos = items.map(function(i) { return i.TipoId; });

    let position = new google.maps.LatLng(item.Latitude, item.Longitude);
    let iconFile, tipoNome, size;

    iconFile = item.TipoId === 3 ? 'ecobox-verde.png' : (item.TipoId === 4 ? 'ecobox-vidro.png' : 'uvr.png');
    tipoNome = item.TipoId === 3 ? 'EcoBox' : (item.TipoId === 4 ? 'Ecovidro' : 'UVR');
    size = item.TipoId === 999 ? new google.maps.Size(50, 60) : new google.maps.Size(40, 40);

    // Monta o conteúdo do popup
    let contentString = "<div class='popup-ecobox'>"
        + "<h4 style=''>" + tipoNome + "</h4>";

    if (item.Logradouro) {
        contentString += "<p><b>Endereço:</b> " + item.Logradouro + "</p>";
    }

    if (item.Subprefeitura) {
        contentString += "<p><b>Subprefeitura:</b> " + item.Subprefeitura + "</p>";
    }

    if (item.DiasColeta) {
        contentString += "<p><b>Dias de coleta:</b> " + item.DiasColeta + "</p>";
    }
    if (item.PeriodoColeta) {
        contentString += "<p><b>Período:</b> " + item.PeriodoColeta + "</p>";
    }

    // Botao de rota para Google Maps
    let routeUrl = "https://www.google.com/maps/dir/?api=1&destination=" + item.Latitude + "," + item.Longitude;
    contentString += "<div style='margin-top: 15px; text-align: center;'>"
        + "<a href='" + routeUrl + "' target='_blank' class='btn-rota'>"
        + "<img src='assets/img/rota.svg' alt='Ver rota'></img>"
        + "</a>"
        + "</div>";

    contentString += "</div>";

    let infowindow = new google.maps.InfoWindow({
        content: contentString
    });

    let m = new google.maps.Marker({
        position: position,
        icon: {
            url: 'assets/img/' + iconFile,
            scaledSize: size
        },
        title: tipoNome
    });
    m.tipoId = item.TipoId;

    m.addListener('click', function () {
        if (lastInfoWindow) lastInfoWindow.close();
        infowindow.open(map, m);
        lastInfoWindow = infowindow;
    });

    markerEcoBox.push(m);
}

function callApiByBounds() {

    // Cancela chamadas anteriores pendentes
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    // Debounce de 250ms para evitar chamadas excessivas
    debounceTimer = setTimeout(function () {
        var bounds = map.getBounds();
        if (!bounds) {
            return;
        }

        var ne = bounds.getNorthEast();
        var sw = bounds.getSouthWest();

        var north = ne.lat();
        var south = sw.lat();
        var east = ne.lng();
        var west = sw.lng();
        var empresaId = 1;


        // Chama a API com os parâmetros de bounding box
        $.ajax({
            type: "GET",
            url: params.urlEcoboxApi,
            data: {
                north: north,
                south: south,
                east: east,
                west: west,
                tipos: '3,4,999', // 3 = EcoBox, 4 = EcoBox Vidro, 999 = UVR
                empresaId: empresaId
            },
            success: function (data) {

                // Limpa marcadores anteriores de EcoBox
                clearEcoBoxMarkers();

                // Renderiza novos marcadores
                if (data && data.items && data.items.length > 0) {

                    // Agrupa por lat/lng: mesmo tipo → 1 marker; tipos diferentes → marker cluster
                    var grupos = {};
                    data.items.forEach(function (item) {
                        var key = item.Latitude + ',' + item.Longitude;
                        if (!grupos[key]) grupos[key] = [];
                        // Deduplicar: não adiciona se já existe item do mesmo TipoId neste local
                        var jaExiste = grupos[key].some(function(i) { return i.TipoId === item.TipoId; });
                        if (!jaExiste) grupos[key].push(item);
                    });
                    Object.keys(grupos).forEach(function (key) {
                        setMarkerEcoBox(grupos[key]);
                    });
                    updateEcoBoxCluster();
                } else {
                    console.log('[EcoBox] Nenhum ponto encontrado na área');
                }
            },
            error: function (xhr, status, error) {
                console.error('[EcoBox] Erro ao carregar pontos:', error);
                console.error('[EcoBox] Status:', status);
                console.error('[EcoBox] Response:', xhr.responseText);
            }
        });
    }, 250);
}


// Inicializa o listener do mapa e carregamento inicial
function initializeMapListeners() {
    console.log('[EcoBox] initializeMapListeners chamado');

    // Carrega pontos iniciais imediatamente (mapa já está pronto)
    callApiByBounds();

    // Atualiza pontos quando o mapa para de se mover ou dar zoom
    map.addListener('idle', function () {
        console.log('[EcoBox] Evento idle disparado');
        callApiByBounds();
    });
}

