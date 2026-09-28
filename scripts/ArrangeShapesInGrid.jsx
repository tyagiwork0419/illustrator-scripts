// ArrangeShapesInGrid.jsx
// 選択した複数のオブジェクトを、名前順(数字を含む場合は数値として比較)に並べ替えたうえで、
// 格子状(グリッド)に整列させる。セルの大きさは選択オブジェクトの中で最大の幅・高さに揃えるため、
// サイズがまちまちでも重なりなく並ぶ。各オブジェクトはセルの左上に揃える。
// GenerateSignsFromCsv.jsx が生成する「生成した看板」レイヤーの複製(看板_<ID>)を、
// 手直し前に整った状態で見渡せるようにする用途を想定しているが、汎用的に使える。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var DEFAULT_GAP_MM = 5; // セル間の間隔

  function mm2pt(mm) {
    return mm * 2.834645669291339;
  }

  // "看板_2" と "看板_10" のような名前を、数値部分は数値として比較する(自然順ソート)
  function naturalCompare(a, b) {
    var re = /(\d+)|(\D+)/g;
    var aParts = a.match(re) || [];
    var bParts = b.match(re) || [];
    var len = Math.min(aParts.length, bParts.length);
    for (var i = 0; i < len; i++) {
      var ap = aParts[i], bp = bParts[i];
      var aNum = /^\d+$/.test(ap), bNum = /^\d+$/.test(bp);
      if (aNum && bNum) {
        var diff = parseInt(ap, 10) - parseInt(bp, 10);
        if (diff !== 0) return diff;
      } else if (ap !== bp) {
        return ap < bp ? -1 : 1;
      }
    }
    return aParts.length - bParts.length;
  }

  function promptInt(message, defaultValue) {
    var input = prompt(message, String(defaultValue));
    if (input === null) return null; // キャンセル
    var v = parseInt(input, 10);
    if (isNaN(v) || v < 1) {
      alert("1以上の整数を入力してください。");
      return null;
    }
    return v;
  }

  function promptFloat(message, defaultValue) {
    var input = prompt(message, String(defaultValue));
    if (input === null) return null; // キャンセル
    var v = parseFloat(input);
    if (isNaN(v) || v < 0) {
      alert("0以上の数値を入力してください。");
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
    var sel = doc.selection;
    if (!sel || sel.length < 1) {
      alert("格子状に並べたいオブジェクトを選択してください。");
      return;
    }

    var items = [];
    for (var i = 0; i < sel.length; i++) items.push(sel[i]);
    items.sort(function (x, y) {
      return naturalCompare(x.name || "", y.name || "");
    });

    var defaultColumns = Math.ceil(Math.sqrt(items.length));
    var columns = promptInt("1行あたりに並べる列数を入力してください", defaultColumns);
    if (columns === null) return;

    var gapMm = promptFloat("オブジェクト間の間隔(mm)を入力してください", DEFAULT_GAP_MM);
    if (gapMm === null) return;
    var gapPt = mm2pt(gapMm);

    // セルの大きさは、選択オブジェクトの中で最大の幅・高さに揃える(サイズがまちまちでも重ならないように)
    var cellWidth = 0, cellHeight = 0;
    for (var b = 0; b < items.length; b++) {
      var gb = items[b].geometricBounds; // [left, top, right, bottom]
      cellWidth = Math.max(cellWidth, gb[2] - gb[0]);
      cellHeight = Math.max(cellHeight, gb[1] - gb[3]);
    }

    // 並べ替え後の基準位置は、現在選択されている全オブジェクトのバウンディングボックスの左上
    var originLeft = null, originTop = null;
    for (var o = 0; o < items.length; o++) {
      var ob = items[o].geometricBounds;
      if (originLeft === null || ob[0] < originLeft) originLeft = ob[0];
      if (originTop === null || ob[1] > originTop) originTop = ob[1];
    }

    for (var n = 0; n < items.length; n++) {
      var col = n % columns;
      var row = Math.floor(n / columns);
      var cellLeft = originLeft + col * (cellWidth + gapPt);
      var cellTop = originTop - row * (cellHeight + gapPt);

      var bounds = items[n].geometricBounds;
      var dx = cellLeft - bounds[0];
      var dy = cellTop - bounds[1];
      items[n].translate(dx, dy);
    }

    alert(items.length + "件のオブジェクトを" + columns + "列の格子状に並べました。");
  }

  main();
})();
