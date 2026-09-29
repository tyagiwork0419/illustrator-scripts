// ArrangeShapesInGrid.jsx
// 選択した複数のオブジェクトを、指定した順番・方向で格子状(グリッド)に整列させる。
// セルの大きさは選択オブジェクトの中で最大の幅・高さに揃えるため、サイズがまちまちでも重なりなく並ぶ。
// 各オブジェクトはセルの左上に揃える。
//
// 並べる順番は2種類から選べる:
//   ・名前順(自然順ソート。例:「看板_2」→「看板_10」の順)
//   ・現在の位置順(現在のX,Y座標から読み順を推定)。指定した列数/行数で単純に区切って
//     行(または列)を決めるため、厳密に同じ高さに並んでいなくても、
//     手動でおおよそ格子状に配置済みのものを整える用途に使える
//
// 並べる方向も2種類から選べる(上で決めた並び順を、新しいグリッドにどう敷き詰めるか):
//   ・横方向(行優先): 左から右へ並べ、指定列数に達したら次の行へ
//   ・縦方向(列優先): 上から下へ並べ、指定行数に達したら次の列へ
//
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

  function sortByName(items) {
    var sorted = items.slice();
    sorted.sort(function (x, y) {
      return naturalCompare(x.name || "", y.name || "");
    });
    return sorted;
  }

  // 現在のX,Y座標から読み順に並べ替える。行・列を推測するのではなく、
  // 指定された列数(行優先の場合)/行数(列優先の場合)でそのまま区切ることで行・列を決める。
  // 行優先: Yの降順(上から下)に並べたものを列数ごとに区切り、各行の中をXの昇順(左から右)に並べ替える
  // 列優先: Xの昇順(左から右)に並べたものを行数ごとに区切り、各列の中をYの降順(上から下)に並べ替える
  function sortByPosition(items, direction, count) {
    var primary, secondary;
    if (direction === "column") {
      primary = function (a, b) { return a.geometricBounds[0] - b.geometricBounds[0]; }; // X昇順
      secondary = function (a, b) { return b.geometricBounds[1] - a.geometricBounds[1]; }; // Y降順
    } else {
      primary = function (a, b) { return b.geometricBounds[1] - a.geometricBounds[1]; }; // Y降順
      secondary = function (a, b) { return a.geometricBounds[0] - b.geometricBounds[0]; }; // X昇順
    }

    var sorted = items.slice();
    sorted.sort(primary);

    var result = [];
    for (var i = 0; i < sorted.length; i += count) {
      var chunk = sorted.slice(i, i + count);
      chunk.sort(secondary);
      result = result.concat(chunk);
    }
    return result;
  }

  // オプション選択ダイアログ。キャンセル時はnullを返す
  function showOptionsDialog(defaultCount) {
    var dlg = new Window("dialog", "格子状に整列");
    dlg.orientation = "column";
    dlg.alignChildren = "fill";

    var orderPanel = dlg.add("panel", undefined, "並べる順番");
    orderPanel.orientation = "column";
    orderPanel.alignChildren = "left";
    orderPanel.margins = 15;
    var orderName = orderPanel.add("radiobutton", undefined, "名前順(自然順ソート)");
    var orderPosition = orderPanel.add("radiobutton", undefined, "現在の位置順(上→下、同じ行は左→右)");
    orderName.value = true;

    var dirPanel = dlg.add("panel", undefined, "並べる方向");
    dirPanel.orientation = "column";
    dirPanel.alignChildren = "left";
    dirPanel.margins = 15;
    var dirRow = dirPanel.add("radiobutton", undefined, "横方向(行優先): 左→右、指定列数で次の行へ");
    var dirColumn = dirPanel.add("radiobutton", undefined, "縦方向(列優先): 上→下、指定行数で次の列へ");
    dirRow.value = true;

    var countGroup = dlg.add("group");
    countGroup.orientation = "row";
    var countLabel = countGroup.add("statictext", undefined, "1行あたりの列数:");
    countLabel.preferredSize.width = 120;
    var countInput = countGroup.add("edittext", undefined, String(defaultCount));
    countInput.characters = 6;

    dirRow.onClick = function () { countLabel.text = "1行あたりの列数:"; };
    dirColumn.onClick = function () { countLabel.text = "1列あたりの行数:"; };

    var gapGroup = dlg.add("group");
    gapGroup.orientation = "row";
    var gapLabel = gapGroup.add("statictext", undefined, "間隔(mm):");
    gapLabel.preferredSize.width = 120;
    var gapInput = gapGroup.add("edittext", undefined, String(DEFAULT_GAP_MM));
    gapInput.characters = 6;

    var btnGroup = dlg.add("group");
    btnGroup.alignment = "right";
    var cancelBtn = btnGroup.add("button", undefined, "キャンセル", { name: "cancel" });
    var okBtn = btnGroup.add("button", undefined, "OK", { name: "ok" });

    var result = null;
    okBtn.onClick = function () {
      var count = parseInt(countInput.text, 10);
      if (isNaN(count) || count < 1) {
        alert("列数/行数には1以上の整数を入力してください。");
        return;
      }
      var gapMm = parseFloat(gapInput.text);
      if (isNaN(gapMm) || gapMm < 0) {
        alert("間隔には0以上の数値を入力してください。");
        return;
      }
      result = {
        order: orderPosition.value ? "position" : "name",
        direction: dirColumn.value ? "column" : "row",
        count: count,
        gapMm: gapMm
      };
      dlg.close();
    };
    cancelBtn.onClick = function () {
      dlg.close();
    };

    dlg.show();
    return result;
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

    var defaultCount = Math.ceil(Math.sqrt(items.length));
    var options = showOptionsDialog(defaultCount);
    if (!options) return; // キャンセル

    items = options.order === "position"
      ? sortByPosition(items, options.direction, options.count)
      : sortByName(items);
    var gapPt = mm2pt(options.gapMm);

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
      var col, row;
      if (options.direction === "column") {
        row = n % options.count;
        col = Math.floor(n / options.count);
      } else {
        col = n % options.count;
        row = Math.floor(n / options.count);
      }
      var cellLeft = originLeft + col * (cellWidth + gapPt);
      var cellTop = originTop - row * (cellHeight + gapPt);

      var bounds = items[n].geometricBounds;
      var dx = cellLeft - bounds[0];
      var dy = cellTop - bounds[1];
      items[n].translate(dx, dy);
    }

    alert(items.length + "件のオブジェクトを格子状に並べました。");
  }

  main();
})();
