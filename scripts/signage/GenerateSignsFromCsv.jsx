// GenerateSignsFromCsv.jsx
// 選択した看板テンプレートを、CSVの行ごとに複製してテキストを書き込み、「生成した看板」レイヤーに配置する。
//
// CSVを直してこのスクリプトを再実行した場合、同じID(「看板_<ID>」)が既にあれば
// 新しく増やさず中身だけ更新する。位置や大きさなど手動で調整した内容は保持される。
//
// 使い方:
//   1. 看板テンプレート内の、差し替えたいテキストフレームに、CSVの列名と完全に同じ名前を付けておく
//      (例: テキストフレーム名「会社名」⇔CSVの列「会社名」)
//   2. Excelのデータを「CSV UTF-8(コンマ区切り)」形式で書き出す。列名の1つを「ID」にする(複製オブジェクト名に使う)
//   3. テンプレートを選択してこのスクリプトを実行し、CSVファイルを指定する
//   4. 「生成した看板」レイヤーに複製が並ぶ。CSVを直したら、同じテンプレートを選んで
//      再実行すれば、既存の看板の中身だけが更新される
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var ID_COLUMN_NAME = "ID"; // 複製オブジェクト名に使う特別な列名(大文字小文字は区別しない)
  var RESULT_LAYER_NAME = "生成した看板";
  var SIGN_NAME_PREFIX = "看板_";
  var CASCADE_OFFSET_MM = 5; // 複製した看板どうしが完全に重ならないよう、1件ごとにずらす量

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

  function findIdColumnKey(headers) {
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].toUpperCase() === ID_COLUMN_NAME) {
        return headers[i];
      }
    }
    return null;
  }

  // --- テンプレート処理 ---

  function collectNamedTextFrames(item, out) {
    if (item.typename === "TextFrame") {
      if (item.name) out[item.name] = item;
    } else if (item.typename === "GroupItem") {
      for (var i = 0; i < item.pageItems.length; i++) {
        collectNamedTextFrames(item.pageItems[i], out);
      }
    }
  }

  function getOrCreateLayer(doc, name) {
    try {
      return doc.layers.getByName(name);
    } catch (e) {
      var layer = doc.layers.add();
      layer.name = name;
      return layer;
    }
  }

  // レイヤー直下から、名前が一致する既存アイテムを探す(無ければnull)
  function findItemByName(layer, name) {
    for (var i = 0; i < layer.pageItems.length; i++) {
      if (layer.pageItems[i].name === name) return layer.pageItems[i];
    }
    return null;
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length !== 1) {
      alert("看板のテンプレートとなるオブジェクトを1つだけ選択してください。");
      return;
    }
    var template = sel[0];

    var csvFile = File.openDialog("CSVファイルを選択してください");
    if (!csvFile) return;

    var csv = readCsvFile(csvFile);
    if (!csv) {
      alert("CSVの読み込みに失敗しました(ヘッダー行とデータ行が必要です)。");
      return;
    }

    var idKey = findIdColumnKey(csv.headers);
    if (!idKey) {
      alert("CSVに「" + ID_COLUMN_NAME + "」列が見つかりません。複製オブジェクト名に使う列名を「" + ID_COLUMN_NAME + "」にしてください。");
      return;
    }

    var templateFrames = {};
    collectNamedTextFrames(template, templateFrames);

    var matchedCount = 0;
    for (var key in templateFrames) {
      if (key === idKey) continue;
      for (var h = 0; h < csv.headers.length; h++) {
        if (csv.headers[h] === key) {
          matchedCount++;
          break;
        }
      }
    }
    if (matchedCount === 0) {
      alert("テンプレート内に、CSVの列名と一致する名前のテキストフレームが見つかりませんでした。");
      return;
    }

    var resultLayer = getOrCreateLayer(doc, RESULT_LAYER_NAME);
    var offsetPt = mm2pt(CASCADE_OFFSET_MM);

    // CSVの行ごとに、看板を複製(または既存のものを更新)してテキストを直接書き込み、
    // 「生成した看板」レイヤーに配置する。
    // 同じIDの看板が既にあれば、新しく増やすのではなく中身だけ差し替える
    // (CSVを直して再実行したときに、既存のIllustrator上のデータも追従するようにするため)
    var createdCount = 0;
    var updatedCount = 0;
    var skippedNoId = 0;
    for (var r = 0; r < csv.records.length; r++) {
      var rec = csv.records[r];
      var id = trimStr(rec[idKey] || "");
      if (!id) {
        skippedNoId++;
        continue;
      }

      var signName = SIGN_NAME_PREFIX + id;
      var target = findItemByName(resultLayer, signName);
      if (target) {
        updatedCount++;
      } else {
        target = template.duplicate(resultLayer, ElementPlacement.PLACEATEND);
        target.name = signName;
        target.translate(offsetPt * createdCount, -offsetPt * createdCount);
        createdCount++;
      }

      var dupFrames = {};
      collectNamedTextFrames(target, dupFrames);
      for (var key2 in dupFrames) {
        if (rec[key2] !== undefined) {
          dupFrames[key2].contents = rec[key2];
        }
      }
    }

    var message = "";
    if (createdCount > 0) message += createdCount + "件の看板を新規作成しました。\n";
    if (updatedCount > 0) message += updatedCount + "件の既存の看板の内容を更新しました。\n";
    if (skippedNoId > 0) {
      message += "ID未設定のため" + skippedNoId + "件をスキップしました。";
    }
    alert(message);
  }

  main();
})();
