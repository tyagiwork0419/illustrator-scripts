// SyncMapLabelsToCsv.jsx
// 「地図ラベル」レイヤー内の各ラベル(GenerateMapLabels.jsxで作成したもの)から、
// 現在のテキスト内容と、アイコンの現在の向き(角度)を実際の形状から計算して読み取り、
// CSVファイルに書き出す。
//
// 人がIllustrator上で直接テキストを直したり、アイコンを手作業で回転させて向きを
// 調整したりした結果を、表(Excel)側に反映させるための「保険」スクリプト。
// 位置(座標)そのものは書き出さない(位置は地図上の見た目で管理する想定のため)。
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var LABEL_LAYER_NAME = "地図ラベル";
  var ID_TAG_NAME = "labelId";

  function getTag(item, name) {
    try {
      for (var i = 0; i < item.tags.length; i++) {
        if (item.tags[i].name === name) return item.tags[i].value;
      }
    } catch (e) {}
    return null;
  }

  // グループ内から名前が"icon"のパスを探す
  function findIcon(group) {
    for (var i = 0; i < group.pathItems.length; i++) {
      if (group.pathItems[i].name === "icon") return group.pathItems[i];
    }
    return null;
  }

  // アイコン(角度0で先頭の頂点=先端が真上を向く三角形)の現在の向きを、
  // 実際のアンカーポイントの位置から計算する(タグの値には頼らない。
  // 手動で回転させた結果を正しく反映するため)
  function computeIconAngleDeg(icon) {
    if (!icon) return null;
    var pts = icon.pathPoints;
    if (pts.length < 3) return null;
    var cx = 0, cy = 0;
    for (var i = 0; i < pts.length; i++) {
      cx += pts[i].anchor[0];
      cy += pts[i].anchor[1];
    }
    cx /= pts.length;
    cy /= pts.length;

    var apex = pts[0].anchor; // 生成時の先頭アンカー = 先端(角度0では真上)
    var dx = apex[0] - cx;
    var dy = apex[1] - cy;
    var rad = Math.atan2(dx, dy); // dx=0, dy>0(真上)のとき0度。時計回りを正とする
    return rad * 180 / Math.PI;
  }

  function csvEscape(value) {
    var s = String(value);
    if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1 || s.indexOf("\r") !== -1) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;

    var layer;
    try {
      layer = doc.layers.getByName(LABEL_LAYER_NAME);
    } catch (e) {
      alert("「" + LABEL_LAYER_NAME + "」レイヤーが見つかりません。先に GenerateMapLabels.jsx でラベルを作成してください。");
      return;
    }

    var rows = [["ID", "テキスト", "角度"]];
    var count = 0;
    var noIconCount = 0;

    for (var i = 0; i < layer.groupItems.length; i++) {
      var group = layer.groupItems[i];
      var id = getTag(group, ID_TAG_NAME);
      if (!id) continue;

      var text = "";
      if (group.textFrames.length > 0) {
        text = group.textFrames[0].contents;
      }

      var icon = findIcon(group);
      var angleDeg = computeIconAngleDeg(icon);
      if (angleDeg === null) {
        noIconCount++;
        angleDeg = 0;
      }

      rows.push([id, text, angleDeg.toFixed(1)]);
      count++;
    }

    if (count === 0) {
      alert("「" + LABEL_LAYER_NAME + "」レイヤー内に、対象のラベルが見つかりませんでした。");
      return;
    }

    var saveFile = File.saveDialog("書き出すCSVファイル名を指定してください");
    if (!saveFile) return;

    var lines = [];
    for (var r = 0; r < rows.length; r++) {
      var cells = [];
      for (var c = 0; c < rows[r].length; c++) {
        cells.push(csvEscape(rows[r][c]));
      }
      lines.push(cells.join(","));
    }

    saveFile.encoding = "UTF-8";
    saveFile.open("w");
    saveFile.write("﻿" + lines.join("\r\n") + "\r\n");
    saveFile.close();

    var message = count + "件のラベルをCSVに書き出しました。\n" + saveFile.fsName;
    if (noIconCount > 0) {
      message += "\nアイコンが見つからず角度を0扱いにしたものが" + noIconCount + "件あります。";
    }
    alert(message);
  }

  main();
})();
