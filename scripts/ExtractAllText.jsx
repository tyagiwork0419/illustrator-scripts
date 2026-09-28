// ExtractAllText.jsx
// ドキュメント内の全テキストを、開かずにテキストファイルへ書き出す。
// 誤字脱字チェック用にAIへ渡せる形にする(1行目からテキスト内容のみを並べる)。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;

    if (doc.textFrames.length === 0) {
      alert("ドキュメント内にテキストが見つかりませんでした。");
      return;
    }

    var lines = [];
    for (var i = 0; i < doc.textFrames.length; i++) {
      var tf = doc.textFrames[i];
      var label = tf.name ? tf.name : String(i + 1);
      lines.push("[" + label + "] " + tf.contents);
    }

    var saveFile = File.saveDialog("書き出すテキストファイル名を指定してください");
    if (!saveFile) return;

    saveFile.encoding = "UTF-8";
    saveFile.open("w");
    saveFile.write(lines.join("\r\n") + "\r\n");
    saveFile.close();

    alert(doc.textFrames.length + "件のテキストを書き出しました。\n" + saveFile.fsName);
  }

  main();
})();
