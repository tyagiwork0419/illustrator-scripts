// GenerateSignsFromCsv.jsx
// 選択した「看板テンプレート」オブジェクトをもとに、CSVデータの行ごとに複製・テキスト差し替えを行い、
// 「生成した看板」レイヤーにまとめて配置する。地図上への配置は PlaceSignsOnMap.jsx で別途行う。
//
// 使い方:
//   1. 看板テンプレートを1つのグループにまとめ、差し替えたい箇所のテキストフレームに
//      CSVの列名と完全に同じ名前を付けておく(例: テキストフレーム名「会社名」⇔CSVの列「会社名」)
//   2. Excelのデータを「CSV UTF-8(コンマ区切り)」形式で書き出す。列名の1つを「ID」にする
//      (このID列の値が、PlaceSignsOnMap.jsx でマーカーと照合するときの識別子になる)
//   3. テンプレートを選択してこのスクリプトを実行し、CSVファイルを指定する
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var ID_COLUMN_NAME = "ID";          // マーカー照合に使う特別な列名(大文字小文字は区別しない)
  var RESULT_LAYER_NAME = "生成した看板";
  var SIGN_NAME_PREFIX = "看板_";       // PlaceSignsOnMap.jsx がこの接頭辞でIDを読み取る
  var CASCADE_OFFSET_MM = 5;          // 生成した看板どうしが完全に重ならないよう、1件ごとにずらす量

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

  // シンプルなCSVパーサ(ダブルクォート・""エスケープ・引用符内の改行に対応)。
  // 戻り値: 行(セル文字列の配列)の配列
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
          i++; // \r\n の \r は読み飛ばし、\n 側で改行を確定する
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

  // グループ内を再帰的に辿って、名前付きのTextFrameを { 名前: TextFrame } の形で集める
  function collectNamedTextFrames(item, out) {
    if (item.typename === "TextFrame") {
      if (item.name) out[item.name] = item;
    } else if (item.typename === "GroupItem") {
      for (var i = 0; i < item.pageItems.length; i++) {
        collectNamedTextFrames(item.pageItems[i], out);
      }
    }
  }

  function getOrCreateResultLayer(doc) {
    try {
      return doc.layers.getByName(RESULT_LAYER_NAME);
    } catch (e) {
      var layer = doc.layers.add();
      layer.name = RESULT_LAYER_NAME;
      return layer;
    }
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
      alert("CSVに「" + ID_COLUMN_NAME + "」列が見つかりません。マーカー照合用の列名を「" + ID_COLUMN_NAME + "」にしてください。");
      return;
    }

    var resultLayer = getOrCreateResultLayer(doc);
    var offsetPt = mm2pt(CASCADE_OFFSET_MM);

    var placedCount = 0;
    var skippedNoId = 0;

    for (var r = 0; r < csv.records.length; r++) {
      var rec = csv.records[r];
      var id = trimStr(rec[idKey] || "");
      if (!id) {
        skippedNoId++;
        continue;
      }

      var sign = template.duplicate(resultLayer, ElementPlacement.PLACEATEND);

      var frames = {};
      collectNamedTextFrames(sign, frames);
      for (var key in rec) {
        if (key === idKey) continue;
        if (frames[key]) {
          frames[key].contents = rec[key];
        }
      }

      sign.name = SIGN_NAME_PREFIX + id;
      sign.translate(offsetPt * placedCount, -offsetPt * placedCount);
      placedCount++;
    }

    var message = placedCount + "件の看板を「" + RESULT_LAYER_NAME + "」レイヤーに生成しました。";
    if (skippedNoId > 0) {
      message += "\nID未設定のため" + skippedNoId + "件をスキップしました。";
    }
    alert(message);
  }

  main();
})();
