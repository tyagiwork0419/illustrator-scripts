// CreateSampleDocument.jsx (テスト用・GenerateSignsFromCsv.jsx / PlaceSignsOnMap.jsx の動作確認用)
// 新規ドキュメントを作成し、「テンプレート」レイヤーに看板テンプレートを1つ、
// 「地図」レイヤーに会場の枠とマーカー(名前1〜10)を作成する。
// 同じフォルダの sample-data.csv と組み合わせて、看板生成〜地図配置の一連の流れを試せる。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var DOC_WIDTH_MM = 400;
  var DOC_HEIGHT_MM = 300;
  var MARKER_COUNT = 10;
  var MARKER_DIAMETER_MM = 4;
  var MARKER_COLS = 5;
  var MAP_MARGIN_MM = 20;
  var SIGN_WIDTH_MM = 40;
  var SIGN_HEIGHT_MM = 20;

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

  // 「テンプレート」レイヤーに、名前付きテキストフレーム(企業名・業種)を持つ看板テンプレートを作る
  function createTemplateLayer(doc) {
    var layer = doc.layers.add();
    layer.name = "テンプレート";

    var group = layer.groupItems.add();
    group.name = "看板テンプレート";

    var w = mm2pt(SIGN_WIDTH_MM);
    var h = mm2pt(SIGN_HEIGHT_MM);

    var bg = group.pathItems.rectangle(0, 0, w, h);
    bg.filled = true;
    bg.fillColor = makeColor(0, 0, 0, 0);
    bg.stroked = true;
    bg.strokeColor = makeColor(0, 0, 0, 100);
    bg.strokeWidth = 1;

    var nameFrame = group.textFrames.add();
    nameFrame.contents = "企業名";
    nameFrame.name = "企業名";
    nameFrame.top = -mm2pt(4);
    nameFrame.left = mm2pt(3);
    try {
      nameFrame.textRange.characterAttributes.size = 14;
    } catch (e) {}

    var typeFrame = group.textFrames.add();
    typeFrame.contents = "業種";
    typeFrame.name = "業種";
    typeFrame.top = -mm2pt(13);
    typeFrame.left = mm2pt(3);
    try {
      typeFrame.textRange.characterAttributes.size = 9;
    } catch (e) {}

    return group;
  }

  // 「地図」レイヤーに、会場の枠と、名前が1〜MARKER_COUNTのマーカー(小さな丸)を作る
  function createMapLayer(doc, areaRect) {
    var layer = doc.layers.add();
    layer.name = "地図";

    var marginPt = mm2pt(MAP_MARGIN_MM);
    var venueLeft = areaRect[0] + marginPt;
    var venueTop = areaRect[1] - marginPt;
    var venueWidth = (areaRect[2] - marginPt) - venueLeft;
    var venueHeight = venueTop - (areaRect[3] + marginPt);

    var venue = layer.pathItems.rectangle(venueTop, venueLeft, venueWidth, venueHeight);
    venue.name = "会場";
    venue.filled = false;
    venue.stroked = true;
    venue.strokeColor = makeColor(0, 0, 0, 100);
    venue.strokeWidth = 2;

    var cols = MARKER_COLS;
    var rows = Math.ceil(MARKER_COUNT / cols);
    var cellW = venueWidth / cols;
    var cellH = venueHeight / rows;
    var d = mm2pt(MARKER_DIAMETER_MM);

    for (var i = 1; i <= MARKER_COUNT; i++) {
      var col = (i - 1) % cols;
      var row = Math.floor((i - 1) / cols);
      var cx = venueLeft + cellW * (col + 0.5);
      var cy = venueTop - cellH * (row + 0.5);

      var marker = layer.pathItems.ellipse(cy + d / 2, cx - d / 2, d, d);
      marker.name = String(i);
      marker.filled = true;
      marker.fillColor = makeColor(0, 0, 0, 100);
      marker.stroked = false;

      var label = layer.textFrames.add();
      label.contents = String(i);
      label.top = cy - d / 2;
      label.left = cx + d;
      try {
        label.textRange.characterAttributes.size = 6;
      } catch (e) {}
    }
  }

  function main() {
    var doc = app.documents.add(DocumentColorSpace.CMYK, mm2pt(DOC_WIDTH_MM), mm2pt(DOC_HEIGHT_MM));
    var areaRect = doc.artboards[0].artboardRect; // [left, top, right, bottom]

    var template = createTemplateLayer(doc);
    createMapLayer(doc, areaRect);

    doc.selection = null;
    template.selected = true;

    alert(
      "サンプルデータを作成しました。\n" +
      "・「テンプレート」レイヤー: 看板テンプレート(選択済み。テキストフレーム名は「企業名」「業種」)\n" +
      "・「地図」レイヤー: 会場の枠と、名前が1〜" + MARKER_COUNT + " のマーカー" + MARKER_COUNT + "個\n\n" +
      "この状態で GenerateSignsFromCsv.jsx を実行し、同じフォルダの sample-data.csv を指定してください。\n" +
      "続けて PlaceSignsOnMap.jsx を実行すると、マーカーの上に看板が配置されます。"
    );
  }

  main();
})();
