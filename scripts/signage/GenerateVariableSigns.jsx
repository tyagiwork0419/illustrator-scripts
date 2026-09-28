// GenerateVariableSigns.jsx
// 選択した看板テンプレートのテキストフレームに、Illustrator標準の「変数」を自動で割り当て、
// CSVの行ごとに (1) 「データセット」の作成 と (2) テンプレートの複製+テキスト書き込み の両方を行う。
//
// (1) マスターテンプレート側は変数にCSVの値を流し込みながらデータセットを作成するので、
//     生成後も「ウィンドウ > 変数」パネルから各データセットを選んでプレビュー・手直しできる。
// (2) 実際に並べて印刷するための実体として、行ごとに看板を複製して「生成した看板」レイヤーに配置する。
//     複製側のテキストは(変数のバインドには頼らず)直接書き込んだ静的な内容になる。
//
// 使い方:
//   1. 看板テンプレート内の、差し替えたいテキストフレームに、CSVの列名と完全に同じ名前を付けておく
//      (例: テキストフレーム名「会社名」⇔CSVの列「会社名」)。変数がまだ割り当てられていなければ自動で作成・割り当てる
//   2. Excelのデータを「CSV UTF-8(コンマ区切り)」形式で書き出す。列名の1つを「ID」にする(データセット名・複製オブジェクト名に使う)
//   3. テンプレートを選択してこのスクリプトを実行し、CSVファイルを指定する
//   4. 「生成した看板」レイヤーに複製が並ぶ。マスターテンプレート側は「ウィンドウ > 変数」パネルから
//      各データセットを選んでプレビュー・手直しできる
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var ID_COLUMN_NAME = "ID"; // データセット名・複製オブジェクト名に使う特別な列名(大文字小文字は区別しない)
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

  // 名前に対応する変数を取得(既存があれば流用、なければ新規作成)。
  // 既存だがテキスト用ではない場合は null を返す。
  function getOrCreateTextVariable(doc, name) {
    try {
      var v = doc.variables.getByName(name);
      if (v.kind !== VariableKind.TEXTUAL) {
        return null;
      }
      return v;
    } catch (e) {
      var nv = doc.variables.add();
      nv.name = name;
      nv.kind = VariableKind.TEXTUAL;
      return nv;
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
      alert("CSVに「" + ID_COLUMN_NAME + "」列が見つかりません。データセット名に使う列名を「" + ID_COLUMN_NAME + "」にしてください。");
      return;
    }

    var frames = {};
    collectNamedTextFrames(template, frames);

    // テンプレート内の名前付きテキストフレームのうち、CSVの列名と一致するものに変数を割り当てる
    var boundFrames = {};
    var skippedFrameNames = [];
    for (var key in frames) {
      if (key === idKey) continue;
      var isColumn = false;
      for (var h = 0; h < csv.headers.length; h++) {
        if (csv.headers[h] === key) {
          isColumn = true;
          break;
        }
      }
      if (!isColumn) continue;

      var variable = getOrCreateTextVariable(doc, key);
      if (!variable) {
        skippedFrameNames.push(key);
        continue;
      }
      frames[key].contentVariable = variable;
      boundFrames[key] = frames[key];
    }

    if (skippedFrameNames.length > 0) {
      alert("以下の名前は既にテキスト用ではない変数として存在するため、割り当てをスキップしました:\n" + skippedFrameNames.join(", "));
    }

    var boundCount = 0;
    for (var bk in boundFrames) boundCount++;
    if (boundCount === 0) {
      alert("テンプレート内に、CSVの列名と一致する名前のテキストフレームが見つかりませんでした。");
      return;
    }

    var resultLayer = getOrCreateLayer(doc, RESULT_LAYER_NAME);
    var offsetPt = mm2pt(CASCADE_OFFSET_MM);

    // CSVの行ごとに、(1)マスターテンプレートの変数値を更新してデータセットを作成し、
    // (2)看板を複製してテキストを直接書き込み、「生成した看板」レイヤーに配置する
    var createdCount = 0;
    var skippedNoId = 0;
    for (var r = 0; r < csv.records.length; r++) {
      var rec = csv.records[r];
      var id = trimStr(rec[idKey] || "");
      if (!id) {
        skippedNoId++;
        continue;
      }

      // (1) マスターテンプレート側: 変数を更新してデータセットを作成(変数パネルでのプレビュー用)
      for (var key2 in boundFrames) {
        if (rec[key2] !== undefined) {
          boundFrames[key2].contents = rec[key2];
        }
      }
      try {
        var ds = doc.dataSets.add();
        ds.name = id;
      } catch (e) {}

      // (2) 複製側: 変数バインドには頼らず、複製したテキストフレームへ直接内容を書き込む
      var dup = template.duplicate(resultLayer, ElementPlacement.PLACEATEND);
      dup.name = SIGN_NAME_PREFIX + id;
      var dupFrames = {};
      collectNamedTextFrames(dup, dupFrames);
      for (var key3 in dupFrames) {
        if (rec[key3] !== undefined) {
          dupFrames[key3].contents = rec[key3];
        }
      }
      dup.translate(offsetPt * createdCount, -offsetPt * createdCount);

      createdCount++;
    }

    // マスターテンプレートは1件目のデータセットを表示し、見た目を分かりやすい状態に戻す
    try {
      if (doc.dataSets.length > 0) {
        doc.dataSets[0].display();
      }
    } catch (e) {}

    var message = createdCount + "件の看板を「" + RESULT_LAYER_NAME + "」レイヤーに複製しました。\n";
    message += "マスターテンプレート側は「ウィンドウ > 変数」パネルから、各データセットを選んでプレビュー・手直しできます。";
    if (skippedNoId > 0) {
      message += "\nID未設定のため" + skippedNoId + "件をスキップしました。";
    }
    alert(message);
  }

  main();
})();
