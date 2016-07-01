var Box = require('./box');
var Path = require('./path');

//=====================
// Site

var Site = function(id, name, latlng, m){
  this.name = name;  // Nom del Lloc
  this.latlng = latlng; // Posició del Lloc
  this.id = id;  // Identificador
  this.type = null;  // Tipus de lloc
  this.observations = null;  // Observacions
  this.marker = null;  // Marcador en el mapa
  this.map_parent = m;  // referencia al mapa on està
  this.boxs = new Array(); // Coses que hi ha al site
  this.actualFusionSite = null;  // L'última grup de dades d'una fusió
};

Site.prototype.save = function (){
  var that = this;
  strUrl = this.map_parent.serverUrl + "/api/v1/site";
  console.log('API call: ' + strUrl);
  if (this.id == 0 || this.id == null) {
    $.post( strUrl, JSON.stringify({ "name": this.name, "latitude": this.latlng.lat, "longitude": this.latlng.lng }))
      .done(function( data ) {
        that.map_parent.notify("Updated!");
        mySite = $.parseJSON( data );
        that.id = mySite.id;
      }, "json");
  } else {
    $.put( strUrl+"/"+this.id, JSON.stringify({ "name": this.name, "latitude": this.latlng.lat, "longitude": this.latlng.lng, "observations" : this.observations }))
      .done(function( data ) {
        that.map_parent.notify("Updated!");
      }, "json");
  }
};

Site.prototype.draw = function (){
  var that = this;
  this.marker = L.marker(this.latlng)
                  .on('click', function() { return that.onSiteClick(); })
                  .on('mouseover', function() { return that.onSiteMouseOver(); })
                  .on('mouseout', function() { return that.onSiteMouseOut(); })
                  .addTo(this.map_parent.map);
  if (!this.id)
    this.save();
};
Site.prototype.onSiteMouseOver = function (e){
  switch(this.map_parent.status) {
    case 'path':
      if ((this.map_parent.active_path) && (this.map_parent.active_path.first_site)){
        this.map_parent.setIconInSiteById(this.id, this.map_parent.redMarker);
      }
      break;
    default :
      this.map_parent.info.update('Site ' + this.name + '(' + this.id + ')');
      this.map_parent.setIconInSiteById(this.id, this.map_parent.greenMarker);
      $('#make_site').text('Edita Lloc');
      break;
  }
};
Site.prototype.onSiteMouseOut = function (e){
  switch(this.map_parent.status) {
    case 'path':
      if ((this.map_parent.active_path) && (this.map_parent.active_path.first_site) && (this.map_parent.active_path.first_site != this.id)){
        this.map_parent.setIconInSiteById(this.id, this.map_parent.blueMarker);
      }
      break;
    default :
      this.map_parent.info.update('');
      this.map_parent.setIconInSiteById(this.id, this.map_parent.blueMarker);
      $('#make_site').text('Crea Lloc');
      break;
  }
};
Site.prototype.onSiteClick = function (e){
  switch(this.map_parent.status){
    case "path":
      // Hi ha algun path actiu?
      if ((this.map_parent.active_path) && (this.map_parent.active_path.first_site)){
        // Sí
        console.log('tancar tram.');
        this.map_parent.active_path.setEndSite(this);
      } else {
        // No n'hi ha cap actiu, el creem.
        console.log('inici tram.');
        this.marker.setIcon(this.map_parent.redMarker);
        this.map_parent.active_path = new Path(null, null, null, null, new Array(), this.map_parent);
        this.map_parent.active_path.setFirstSite(this);
      }
      break;
    case "split":
      alert("No es pot fer un split a un Lloc!");
      break;
    case "site":
    default:
      // Anem a editar el site
      this.siteDefine();
      break;
    }
};
// Carraguem els seus boxs
Site.prototype.loadBoxes = function() {
  var that = this;
  strUrl = that.map_parent.serverUrl + "/api/v1/site/" + that.id + "/boxes";
  $.getJSON(strUrl, function (data) {
    // Iterem
    $.each(data, function (index, value) {
      box = new Box(value.id, value.uuid, value.name, value.type, that, that.map_parent);
      box.observations = value.observations;
      that.boxs[box.uuid] = box;
    });
    that.siteCallbackBoxes();
  });
};
Site.prototype.siteCallbackBoxes = function() {
  var that = this;

  // Mostrar els elements d'un site.
  for(idx_box in this.boxs){
    actual_box = this.boxs[idx_box];
    actual_box.addHtmlBox();
  }

};
// Pagina de Site
Site.prototype.siteDefine = function() {
  var that = this;

  if (!this.id) {
    alert("Aquesta caixa no ha estat grabada encarà!");
    return;
  }
  // Netejem events anteriors:
  $('#site-update').unbind("click");
  $('#site-fusion').unbind("click");

  // Load formulari
  $('#site-name').val(this.name);
  $('#site-latitude').val(this.latlng.lat);
  $('#site-longitude').val(this.latlng.lng);
  $('#site-observation').val(this.observations);
  // El declarem events
  $('#site-update').on('click', function(e){
    that.name = $('#site-name').val();
    that.latlng = L.latLng($('#site-latitude').val(), $('#site-longitude').val());
    that.observations = $('#site-observation').val();
    that.save();
  });

  $('#site-fusion').on('click', function(e){
    that.siteFusion();
    $('#zoom-site-group').toggleClass('hide');
  });

  // Neteja el que ja tenia
  $('#box').html("");
  $('#add-new-box').unbind("click");
  // Si els elements d'aquest site esta buit, mirem si n'hi han per carregar-ne.
  if (this.boxs.length == 0) {
    that.loadBoxes();
  } else {

    that.siteCallbackBoxes();
  }
  $('#add-new-box').on('click', function (e){
      box = new Box(0,gUUID(),'','',that,that.map_parent);
      that.boxs[box.uuid] = box;
      box.addHtmlBox();
  });
  // Posem el ID d'aquest site al
  that.map_parent.active_site = that;
  // Amagar mapa.
  $('#map-group').hide();
  $('#zoom-site-group').toggleClass('hide');
};
Site.prototype.deleteBox = function(uuid){
    //Buscar el box, i esborrar-lo
    box = this.boxs[uuid];
    if (box.id != 0)
      box.delete(box.id);
    else
      $('#box-'+ box.uuid).remove();
    delete this.boxs[uuid];
};

// Pagina de Definició de fusió
Site.prototype.siteFusion = function(){
  if (!this.id) {
    alert("Aquesta caixa no ha estat grabada encarà!");
    return;
  }
  // Amagar mapa.
  $('#map-group').hide();
  $('#zoom-site-fusion-group').toggleClass('hide');

  this.siteFusionPaint();
};
Site.prototype.siteFusionPaint = function() {
  // Carreguem dades.
  var that =  this;

  var global = $('<div>');
  // Carreguem les fusions
  var strUrlMerger = that.map_parent.serverUrl + "/api/v1/site/" + that.id + "/merger";
  $.getJSON(strUrlMerger, function (dataMerger){
    // Carreguem les caixes.
    var strUrlSection = that.map_parent.serverUrl + "/api/v1/site/" + that.id + "/section";
    $.getJSON(strUrlSection, function (dataSection) {
      // Insertem els boto per fusionar o la fusió que té.
      that.actualFusionSite = that.map_parent.buildSiteMerger(dataSection, dataMerger);
      console.log(that.actualFusionSite);
      var row = $('<div class="row">').appendTo(global);
      $.each(that.actualFusionSite, function (index, tram) {
        try {
          colors = $.parseJSON(tram.colors);
        } catch (e) {
          console.log(e);
          console.log(tram.colors);
        }
        var columns = $('<div class="col-s-3">').appendTo(row);
        var title_tram = $('<h1 title="' + tram.name + '">Del Tram ' + tram.id + '</h1>');
        title_tram.on('click', function(){
          that.map_parent.getPath(tram.id);
        });
        title_tram.appendTo(columns);
        var this_site = $('<ul>').appendTo(columns);
        if (colors) {
          $.each(colors, function (itub,tub){
              var this_tub = $(document.createElement("li")).text(tub.name);
              var this_fibers = $(document.createElement("ul"));
              $.each(tub.fibers, function (ifiber, fiber){
                var this_select_fusio;
                if (!fiber.fusionat){
                  // Creem les opcions d'aquell cable.
                  this_select_fusio = $(document.createElement('select')).attr('id', 'slct-' +  tram.id + "_" + tub.name + "_" + fiber.color).attr('class', 'select-fiber');
                  this_select_fusio.append($('<option>').text("").attr('value', ""));
                  $.each(tram.fusion_options, function(i, value) {
                    this_select_fusio.append($('<option>').text(value.label).attr('value', value.value));
                  });
                  this_select_fusio.on('change',function(e){ that.onChangeSelect(e); });
                } else {
                  this_remove_link = $('<a class="fusion-fiber">')
                                      .attr('data-input', tram.id + "_" + tub.name + "_" + fiber.color)
                                      .html("&nbsp;X&nbsp;");
                  this_select_fusio = $('<div class="input-group">')
                                      .append($('<input type="text" class="readonly">')
                                        .attr({'value':fiber.fusionat, 'id':tram.id + "_" + tub.name + "_" + fiber.color}))
                                      .append($('<span class=".input-group-addon .supplement input-close">')
                                        .append(this_remove_link)
                                      );
                 this_remove_link.on('click', function(e){ that.removeFusion(e); });
                }
                var row_line = $('<div class="row">');
                var col_line_Name = $('<div class="col-s-4">')
                    .append($('<input type="text" class="readonly">')
                      .attr('value',fiber.color))
                    .appendTo(row_line);
                var col_line_Fusio = $('<div class="col-s-8">').append(this_select_fusio).appendTo(row_line);
                var linea = row_line;
                this_fibers.append(linea);
              });
             this_site.append(this_tub).append(this_fibers);
          });
        }
      });
    });
  });
  // Netejem les caixes existents al mapa?
  $('.site-fusion').html("");
  global.appendTo($('.site-fusion'));
};
Site.prototype.onChangeSelect = function(e){
  strFFiber = new String(e.target.id).substr(5);
  strLFiber = $('#'+e.target.id).val();
  ffiber = strFFiber.split('_');
    lfiber = strLFiber.split('.');

    // Mirar de grabar la fusió
  var that = this;
  strUrl = this.map_parent.serverUrl + "/api/v1/merger";
  console.log('API call: ' + strUrl);
  $.post( strUrl, JSON.stringify({ "site_id": that.id , "fsection_id": ffiber[0], "fcolor": ffiber[1]+"."+ffiber[2], "lsection_id": lfiber[0], "lcolor": lfiber[1]+"."+lfiber[2] }))
    .done(function( data ) {
      that.map_parent.notify("Updated!");
      myMerger = $.parseJSON( data );
      that.siteFusionPaint();
    }, "json");
    // Recarregar el Site
};
Site.prototype.removeFusion = function(e){
  strFFiber = $(e.target).data('input');
  strLFiber = $('#'+strFFiber).val();
  ffiber = strFFiber.split('_');
  lfiber = strLFiber.split('.');

  // Esborrar merge
  var that = this;
  strUrl = this.map_parent.serverUrl + "/api/v1/merger";
  console.log('API call: ' + strUrl);
  $.delete( strUrl, JSON.stringify({ "site_id": that.id ,"fsection_id": ffiber[0], "fcolor": ffiber[1]+"."+ffiber[2], "lsection_id": lfiber[0], "lcolor": lfiber[1]+"."+lfiber[2] }))
    .done(function( data ) {
      that.map_parent.notify("Deleted!");
      myMerger = $.parseJSON( data );
      that.siteFusionPaint();
    }, "json");
  return false;
};
module.exports = exports = Site;