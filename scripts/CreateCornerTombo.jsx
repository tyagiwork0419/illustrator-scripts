// CreateCornerTombo.jsx
// 角のみトンボ(二重線: 内トンボ+外トンボ)を選択オブジェクトのバウンディングボックスに作成する
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var BLEED_MM = 3;      // 塗り足し量
  var MARK_LEN_MM = 3;   // トンボ線の長さ
  var STROKE_MM = 0.1;   // トンボ線の太さ

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

  function addLBracket(parent, cx, cy, sx, sy, lenPt, strokeColor, strokeWidthPt) {
    var p = parent.pathItems.add();
    p.setEntirePath([
      [cx + sx * lenPt, cy],
      [cx, cy],
      [cx, cy + sy * lenPt]
    ]);
    p.filled = false;
    p.stroked = true;
    p.strokeColor = strokeColor;
    p.strokeWidth = strokeWidthPt;
    p.strokeCap = StrokeCap.BUTTENDCAP;
    p.strokeJoin = StrokeJoin.MITERENDJOIN;
    try {
      p.strokeOverprint = true;
    } catch (e) {}
    return p;
  }

  function makeCornerBracket(parent, cx, cy, sx, sy, bleedPt, markPt, strokeColor, strokeWidthPt) {
    // 内トンボ(仕上がり位置)
    addLBracket(parent, cx, cy, sx, sy, markPt, strokeColor, strokeWidthPt);
    // 外トンボ(塗り足し位置)
    addLBracket(parent, cx + sx * bleedPt, cy + sy * bleedPt, sx, sy, markPt, strokeColor, strokeWidthPt);
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

    var bleedPt = mm2pt(BLEED_MM);
    var markPt = mm2pt(MARK_LEN_MM);
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
      makeCornerBracket(group, cn.cx, cn.cy, cn.sx, cn.sy, bleedPt, markPt, strokeColor, strokeWidthPt);
    }

    doc.selection = null;
    group.selected = true;
  }

  main();
})();
