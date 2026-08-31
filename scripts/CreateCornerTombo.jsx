// CreateCornerTombo.jsx
// 選択オブジェクトのバウンディングボックスの角に、日本式トンボ(内トンボ+外トンボが
// たすき掛けに重なる二重線)の角トンボを作成する。中央のセンタートンボ(十字マーク)は作成しない。
// 各角の座標は、Illustrator純正の「トリムマークを作成」(日本式トンボ設定)が実際に生成する
// パスを実測して求めたもの(仕上がり線からのアキ0.5pt、塗り足し3mm、腕の長さ9mm)。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var BLEED_MM = 3;    // 塗り足し量
  var ARM_LEN_MM = 9;  // トンボの腕の長さ(塗り足し線からの延長分)
  var GAP_PT = 0.5;    // 仕上がり線からのアキ
  var STROKE_MM = 0.1; // トンボ線の太さ

  function mm2pt(mm) {
    return mm * 2.834645669291339;
  }

  function getRegistrationColor(doc) {
    try {
      return doc.swatches.getByName("[Registration]").color;
    } catch (e) {
      var c = new CMYKColor();
      c.cyan = 0;
      c.magenta = 0;
      c.yellow = 0;
      c.black = 100;
      return c;
    }
  }

  function getOrCreateTomboLayer(doc) {
    var name = "トンボ";
    try {
      return doc.layers.getByName(name);
    } catch (e) {
      var layer = doc.layers.add();
      layer.name = name;
      return layer;
    }
  }

  function applyStrokeStyle(p, strokeColor, strokeWidthPt) {
    p.filled = false;
    p.stroked = true;
    p.strokeColor = strokeColor;
    p.strokeWidth = strokeWidthPt;
    p.strokeCap = StrokeCap.BUTTENDCAP;
    p.strokeJoin = StrokeJoin.MITERENDJOIN;
    try {
      p.strokeOverprint = true;
    } catch (e) {}
  }

  function addPath(parent, points, strokeColor, strokeWidthPt) {
    var p = parent.pathItems.add();
    p.setEntirePath(points);
    applyStrokeStyle(p, strokeColor, strokeWidthPt);
    return p;
  }

  // 仕上がり角(cx, cy)を基準に、日本式の角トンボ(L字2本がたすき掛けに重なる形)を作成する
  // r1: 仕上がり線からのアキ / r2: 塗り足し線の位置 / r3: 腕の先端位置(いずれも仕上がり角からの距離)
  function makeCornerMark(parent, cx, cy, sx, sy, r1, r2, r3, strokeColor, strokeWidthPt) {
    addPath(parent, [
      [cx + sx * r1, cy + sy * r3],
      [cx + sx * r1, cy + sy * r2],
      [cx + sx * r3, cy + sy * r2]
    ], strokeColor, strokeWidthPt);

    addPath(parent, [
      [cx + sx * r3, cy + sy * r1],
      [cx + sx * r2, cy + sy * r1],
      [cx + sx * r2, cy + sy * r3]
    ], strokeColor, strokeWidthPt);
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      alert("トンボを作成する対象のオブジェクトを選択してください。");
      return;
    }

    var left = null, top = null, right = null, bottom = null;
    for (var i = 0; i < sel.length; i++) {
      var b = sel[i].geometricBounds; // [left, top, right, bottom]
      if (left === null || b[0] < left) left = b[0];
      if (top === null || b[1] > top) top = b[1];
      if (right === null || b[2] > right) right = b[2];
      if (bottom === null || b[3] < bottom) bottom = b[3];
    }

    var r1 = GAP_PT;
    var r2 = GAP_PT + mm2pt(BLEED_MM);
    var r3 = r2 + mm2pt(ARM_LEN_MM);
    var strokeWidthPt = mm2pt(STROKE_MM);
    var strokeColor = getRegistrationColor(doc);

    var tomboLayer = getOrCreateTomboLayer(doc);
    var group = tomboLayer.groupItems.add();
    group.name = "角トンボ";

    var corners = [
      { cx: left, cy: bottom, sx: -1, sy: -1 }, // 左下
      { cx: right, cy: bottom, sx: 1, sy: -1 }, // 右下
      { cx: left, cy: top, sx: -1, sy: 1 },     // 左上
      { cx: right, cy: top, sx: 1, sy: 1 }      // 右上
    ];

    for (var c = 0; c < corners.length; c++) {
      var cn = corners[c];
      makeCornerMark(group, cn.cx, cn.cy, cn.sx, cn.sy, r1, r2, r3, strokeColor, strokeWidthPt);
    }

    doc.selection = null;
    group.selected = true;
  }

  main();
})();
