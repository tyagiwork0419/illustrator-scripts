// AddBannerMargin.jsx
// 垂れ幕用に、アートボードの上下に指定値分の余白(縫い込み・グロメット等のための延長分)を追加し、
// 元の仕上がり端の位置を、非表示レイヤー上の点線ガイドで示す。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var DEFAULT_MARGIN_MM = 100; // 上下に追加する余白の既定値
  var GUIDE_LAYER_NAME = "垂れ幕ガイド";
  var GUIDE_DASH_PT = [4, 3]; // 点線のパターン(線の長さ, すき間)

  function mm2pt(mm) {
    return mm * 2.834645669291339;
  }

  function makeColor(c, m, y, k) {
    var col = new CMYKColor();
    col.cyan = c;
    col.magenta = m;
    col.yellow = y;
    col.black = k;
    return col;
  }

  function promptMarginMm() {
    var input = prompt("上下に追加する余白(mm)を入力してください", String(DEFAULT_MARGIN_MM));
    if (input === null) return null;
    var v = parseFloat(input);
    if (isNaN(v) || v <= 0) {
      alert("余白には0より大きい数値を入力してください。");
      return null;
    }
    return v;
  }

  function getOrCreateGuideLayer(doc) {
    var layer;
    try {
      layer = doc.layers.getByName(GUIDE_LAYER_NAME);
    } catch (e) {
      layer = doc.layers.add();
      layer.name = GUIDE_LAYER_NAME;
    }
    layer.printable = false;
    return layer;
  }

  function addDashedLine(layer, left, right, y) {
    var line = layer.pathItems.add();
    line.setEntirePath([[left, y], [right, y]]);
    line.filled = false;
    line.stroked = true;
    line.strokeColor = makeColor(0, 100, 0, 0);
    line.strokeWidth = 0.5;
    line.strokeDashes = GUIDE_DASH_PT;
    return line;
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;

    var marginMm = promptMarginMm();
    if (marginMm === null) return;
    var marginPt = mm2pt(marginMm);

    var idx = doc.artboards.getActiveArtboardIndex();
    var artboard = doc.artboards[idx];
    var rect = artboard.artboardRect; // [left, top, right, bottom]
    var left = rect[0], top = rect[1], right = rect[2], bottom = rect[3];

    var guideLayer = getOrCreateGuideLayer(doc);
    addDashedLine(guideLayer, left, right, top);
    addDashedLine(guideLayer, left, right, bottom);

    artboard.artboardRect = [left, top + marginPt, right, bottom - marginPt];

    alert(
      "アートボードの上下に" + marginMm + "mmずつ余白を追加しました。\n" +
      "元の仕上がり端は「" + GUIDE_LAYER_NAME + "」レイヤーの点線で示しています(印刷されません)。"
    );
  }

  main();
})();
