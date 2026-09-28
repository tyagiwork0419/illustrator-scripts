// GenerateMapLabels.jsx
// CSVの行ごとに、地図に貼り付けるための「ラベル(向きを示すアイコン+テキスト)」を一括生成し、
// 人が地図上へ1つずつドラッグして配置できるよう、ステージング領域(グリッド状)に並べて置く。
// 位置合わせは人の目で行う想定。ラベルの向き(角度)は、CSVに「角度」列があれば初期値として反映する。
// 実際に人がIllustrator上で手直しした内容(テキスト・向き)は、SyncMapLabelsToCsv.jsx でCSVに書き戻せる。
//
// 使い方:
//   1. Excelのデータを「CSV UTF-8(コンマ区切り)」形式で書き出す。列名の1つを「ID」にする
//      (任意で「角度」列を追加すると、アイコンの初期の向き(度、時計回り)に反映される)
//   2. ドキュメントを開いた状態でこのスクリプトを実行し、CSVファイルを指定する
//   3. 「地図ラベル」レイヤーに生成されたラベルを、地図上の該当位置までドラッグして配置する
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var ID_COLUMN_NAME = "ID";
  var ANGLE_COLUMN_NAME = "角度"; // 省略可能。無ければ0度扱い
  var LABEL_LAYER_NAME = "地図ラベル";
  var LABEL_NAME_PREFIX = "地図ラベル_";
  var ICON_SIZE_MM = 6;
  var CASCADE_COLUMNS = 5;
  var CASCADE_STEP_MM = 15;
  var ID_TAG_NAME = "labelId";
  var ANGLE_TAG_NAME = "labelAngle"; // 参考値(生成時の角度)。実際の向きはアイコンの形状から都度計算する

  function mm2pt(mm) {
    return mm * 2.834645669291339;
  }

  function trimStr(s) {
    return s.replace(/^\s+|\s+$/g, "");
  }

  // --- CSV パース ---

  function stripBOM(text) {
    if (text.length > 0 && text.charCodeAt(0) === 0xFEFF) {
      return text.substring(1);
    }
    return text;
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    function endField() {
      row.push(field);
      field = "";
    }
    function endRow() {
      endField();
      rows.push(row);
      row = [];
    }

    while (i < len) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ',') {
          endField();
          i++;
        } else if (ch === '\r') {
          i++;
        } else if (ch === '\n') {
          endRow();
          i++;
        } else {
          field += ch;
          i++;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      endRow();
    }
    while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
      rows.pop();
    }
    return rows;
  }

  function readCsvFile(file) {
    file.encoding = "UTF-8";
    if (!file.open("r")) {
      return null;
    }
    var text = file.read();
    file.close();
    text = stripBOM(text);

    var rows = parseCsv(text);
    if (rows.length < 2) return null;

    var headers = [];
    for (var h = 0; h < rows[0].length; h++) {
      headers.push(trimStr(rows[0][h]));
    }

    var records = [];
    for (var r = 1; r < rows.length; r++) {
      var rec = {};
      for (var c = 0; c < headers.length; c++) {
        rec[headers[c]] = rows[r][c] !== undefined ? rows[r][c] : "";
      }
      records.push(rec);
    }
    return { headers: headers, records: records };
  }

  function findColumnKey(headers, name) {
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].toUpperCase() === name.toUpperCase()) return headers[i];
    }
    return null;
  }

  // --- 生成処理 ---

  function makeColor(c, m, y, k) {
    var col = new CMYKColor();
    col.cyan = c;
    col.magenta = m;
    col.yellow = y;
    col.black = k;
    return col;
  }

  function getOrCreateLayer(doc, name) {
    try {
      return doc.layers.getByName(name);
    } catch (e) {
      var l = doc.layers.add();
      l.name = name;
      return l;
    }
  }

  function setTag(item, name, value) {
    try {
      for (var i = 0; i < item.tags.length; i++) {
        if (item.tags[i].name === name) {
          item.tags[i].value = value;
          return;
        }
      }
      item.tags.add(name, value);
    } catch (e) {}
  }

  // アイコン(角度0で真上を向く三角形。先頭の頂点が「先端」)+ テキストのラベルを作成する
  function createLabel(layer, iconSizePt, text) {
    var group = layer.groupItems.add();

    var icon = group.pathItems.add();
    icon.setEntirePath([
      [0, iconSizePt / 2],
      [iconSizePt / 2, -iconSizePt / 2],
      [-iconSizePt / 2, -iconSizePt / 2]
    ]);
    icon.name = "icon";
    icon.closed = true;
    icon.filled = true;
    icon.fillColor = makeColor(0, 0, 0, 100);
    icon.stroked = false;

    var label = group.textFrames.add();
    label.contents = text;
    label.top = iconSizePt / 2;
    label.left = iconSizePt;
    try {
      label.textRange.characterAttributes.size = 8;
    } catch (e) {}

    return { group: group, icon: icon };
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;

    var csvFile = File.openDialog("CSVファイルを選択してください");
    if (!csvFile) return;

    var csv = readCsvFile(csvFile);
    if (!csv) {
      alert("CSVの読み込みに失敗しました(ヘッダー行とデータ行が必要です)。");
      return;
    }

    var idKey = findColumnKey(csv.headers, ID_COLUMN_NAME);
    if (!idKey) {
      alert("CSVに「" + ID_COLUMN_NAME + "」列が見つかりません。");
      return;
    }
    var angleKey = findColumnKey(csv.headers, ANGLE_COLUMN_NAME);

    var layer = getOrCreateLayer(doc, LABEL_LAYER_NAME);
    var iconSizePt = mm2pt(ICON_SIZE_MM);
    var stepPt = mm2pt(CASCADE_STEP_MM);

    var createdCount = 0;
    var skippedNoId = 0;

    for (var r = 0; r < csv.records.length; r++) {
      var rec = csv.records[r];
      var id = trimStr(rec[idKey] || "");
      if (!id) {
        skippedNoId++;
        continue;
      }

      var labelParts = [];
      for (var h = 0; h < csv.headers.length; h++) {
        var col = csv.headers[h];
        if (col === idKey || col === angleKey) continue;
        if (rec[col]) labelParts.push(rec[col]);
      }
      var labelText = labelParts.join(" ");

      var created = createLabel(layer, iconSizePt, labelText);
      created.group.name = LABEL_NAME_PREFIX + id;
      setTag(created.group, ID_TAG_NAME, id);

      var angle = 0;
      if (angleKey && rec[angleKey]) {
        var parsed = parseFloat(rec[angleKey]);
        if (!isNaN(parsed)) angle = parsed;
      }
      if (angle !== 0) {
        created.icon.rotate(angle);
      }
      setTag(created.group, ANGLE_TAG_NAME, String(angle));

      // ステージング領域にグリッド状に並べる
      var col2 = createdCount % CASCADE_COLUMNS;
      var row2 = Math.floor(createdCount / CASCADE_COLUMNS);
      created.group.translate(col2 * stepPt, -row2 * stepPt);

      createdCount++;
    }

    var message = createdCount + "件のラベルを「" + LABEL_LAYER_NAME + "」レイヤーに生成しました。\n";
    message += "地図上の該当位置まで、1つずつドラッグして配置してください。";
    if (skippedNoId > 0) {
      message += "\nID未設定のため" + skippedNoId + "件をスキップしました。";
    }
    alert(message);
  }

  main();
})();
