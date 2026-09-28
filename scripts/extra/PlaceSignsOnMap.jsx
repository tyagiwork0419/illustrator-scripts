// PlaceSignsOnMap.jsx
// GenerateSignsFromCsv.jsx で生成した「生成した看板」レイヤー内の看板(名前が「看板_<ID>」)を、
// 地図上のマーカー(名前が<ID>と一致するオブジェクト)の真上に、指定した縮尺で配置する。
//
// 使い方: 事前に GenerateSignsFromCsv.jsx で看板を生成し、地図上のマーカーオブジェクトに
// CSVのID列と同じ名前を付けておいてから、このスクリプトを実行してください。
// 縮尺を変えて何度でも再実行できます(前回適用した縮尺をタグとして記録し、
// 累積で二重に縮小/拡大されないよう、常に元のサイズを基準にした絶対倍率になります)。
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var GAP_MM = 2;                    // マーカーと看板の間の隙間
  var RESULT_LAYER_NAME = "生成した看板";
  var SIGN_NAME_PREFIX = "看板_";
  var SCALE_TAG_NAME = "signScale";  // 看板に適用済みの縮尺(%)を記録しておくタグ名

  function mm2pt(mm) {
    return mm * 2.834645669291339;
  }

  // ドキュメント全体(全レイヤー・全グループ)を再帰的に探索し、name === id のオブジェクトを探す
  function findMarkerById(doc, id) {
    for (var l = 0; l < doc.layers.length; l++) {
      var found = findMarkerInContainer(doc.layers[l], id);
      if (found) return found;
    }
    return null;
  }

  function findMarkerInContainer(container, id) {
    var items = container.pageItems;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.name === id) return it;
      if (it.typename === "GroupItem") {
        var found = findMarkerInContainer(it, id);
        if (found) return found;
      }
    }
    if (container.layers) {
      for (var j = 0; j < container.layers.length; j++) {
        var found2 = findMarkerInContainer(container.layers[j], id);
        if (found2) return found2;
      }
    }
    return null;
  }

  function getStoredScale(item) {
    try {
      for (var i = 0; i < item.tags.length; i++) {
        if (item.tags[i].name === SCALE_TAG_NAME) {
          var v = parseFloat(item.tags[i].value);
          if (!isNaN(v) && v > 0) return v;
        }
      }
    } catch (e) {}
    return 100;
  }

  function setStoredScale(item, value) {
    try {
      var tag = null;
      for (var i = 0; i < item.tags.length; i++) {
        if (item.tags[i].name === SCALE_TAG_NAME) {
          tag = item.tags[i];
          break;
        }
      }
      if (!tag) tag = item.tags.add(SCALE_TAG_NAME);
      tag.value = String(value);
    } catch (e) {}
  }

  function promptScalePercent() {
    var input = prompt("看板の縮尺(%)を入力してください(100=原寸)", "100");
    if (input === null) return null;
    var v = parseFloat(input);
    if (isNaN(v) || v <= 0) {
      alert("縮尺には0より大きい数値を入力してください。");
      return null;
    }
    return v;
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;

    var resultLayer;
    try {
      resultLayer = doc.layers.getByName(RESULT_LAYER_NAME);
    } catch (e) {
      alert("「" + RESULT_LAYER_NAME + "」レイヤーが見つかりません。先に GenerateSignsFromCsv.jsx で看板を生成してください。");
      return;
    }

    var scalePercent = promptScalePercent();
    if (scalePercent === null) return;
    var gapPt = mm2pt(GAP_MM);

    var items = [];
    for (var i = 0; i < resultLayer.pageItems.length; i++) {
      items.push(resultLayer.pageItems[i]);
    }

    var placedCount = 0;
    var noMarker = [];

    for (var n = 0; n < items.length; n++) {
      var sign = items[n];
      if (sign.name.indexOf(SIGN_NAME_PREFIX) !== 0) continue;
      var id = sign.name.substring(SIGN_NAME_PREFIX.length);

      var marker = findMarkerById(doc, id);
      if (!marker) {
        noMarker.push(id);
        continue;
      }

      var currentScale = getStoredScale(sign);
      if (scalePercent !== currentScale) {
        var relative = (scalePercent / currentScale) * 100;
        sign.resize(relative, relative);
        setStoredScale(sign, scalePercent);
      }

      var signBounds = sign.geometricBounds; // [left, top, right, bottom]
      var signCenterX = (signBounds[0] + signBounds[2]) / 2;
      var signBottomY = signBounds[3];

      var markerBounds = marker.geometricBounds;
      var markerCenterX = (markerBounds[0] + markerBounds[2]) / 2;
      var markerTopY = markerBounds[1];

      var dx = markerCenterX - signCenterX;
      var dy = (markerTopY + gapPt) - signBottomY;
      sign.translate(dx, dy);

      placedCount++;
    }

    var message = placedCount + "件の看板をマーカーの上に配置しました。";
    if (noMarker.length > 0) {
      message += "\n対応するマーカーが見つからなかったID:\n" + noMarker.join(", ");
    }
    alert(message);
  }

  main();
})();
