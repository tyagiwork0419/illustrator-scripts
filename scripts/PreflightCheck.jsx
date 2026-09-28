// PreflightCheck.jsx
// 入稿前チェック: ドキュメント全体を対象に、印刷入稿でよくある問題点を一括確認してレポートする。
// 選択は不要(ドキュメント全体をチェックする)。
//
// チェック内容:
//   - ドキュメントのカラーモードがRGBになっていないか
//   - 個々のオブジェクトの塗り/線にRGBカラーが使われていないか(CMYKドキュメントでの混入)
//   - アウトライン化されていないテキスト(ライブテキスト)が残っていないか
//   - エリア内テキストがオーバーフロー(はみ出し)していないか
//   - リンク画像でファイルが見つからない(パスが切れている)ものがないか
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  function isRgbColor(color) {
    return !!color && color.typename === "RGBColor";
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;
    var issues = [];

    // カラーモード
    if (doc.documentColorSpace === DocumentColorSpace.RGB) {
      issues.push("ドキュメントのカラーモードがRGBです。印刷用にはCMYKへの変換を検討してください。");
    }

    // 塗り・線にRGBカラーが使われているオブジェクト(document.pathItemsは全レイヤー・全グループを含む)
    var rgbItems = [];
    for (var i = 0; i < doc.pathItems.length; i++) {
      var pi = doc.pathItems[i];
      var label = pi.name || pi.typename;
      try {
        if (pi.filled && isRgbColor(pi.fillColor)) rgbItems.push(label + "(塗り)");
      } catch (e) {}
      try {
        if (pi.stroked && isRgbColor(pi.strokeColor)) rgbItems.push(label + "(線)");
      } catch (e) {}
    }
    if (rgbItems.length > 0) {
      issues.push("RGBカラーが使われているオブジェクトが" + rgbItems.length + "件あります:\n  " + rgbItems.join("\n  "));
    }

    // 未アウトライン化テキスト・オーバーフローテキスト(document.textFramesは全レイヤー・全グループを含む)
    var liveTextCount = doc.textFrames.length;
    var overflowItems = [];
    for (var t = 0; t < doc.textFrames.length; t++) {
      var tf = doc.textFrames[t];
      try {
        if (tf.kind === TextType.AREATEXT && tf.overflown) {
          overflowItems.push(tf.name || tf.contents.substring(0, 20));
        }
      } catch (e) {}
    }
    if (liveTextCount > 0) {
      issues.push("アウトライン化されていないテキストが" + liveTextCount + "件あります(文字化け防止のため、入稿前にアウトライン化または埋め込みを検討してください)。");
    }
    if (overflowItems.length > 0) {
      issues.push("エリアからはみ出している(オーバーフロー)テキストが" + overflowItems.length + "件あります:\n  " + overflowItems.join("\n  "));
    }

    // リンク画像の欠落(埋め込み画像はdocument.placedItemsに含まれないため対象外)
    var missingLinks = [];
    for (var p = 0; p < doc.placedItems.length; p++) {
      var placed = doc.placedItems[p];
      try {
        if (!placed.file.exists) {
          missingLinks.push(placed.name || placed.file.name);
        }
      } catch (e) {
        missingLinks.push(placed.name || "(不明なリンク画像)");
      }
    }
    if (missingLinks.length > 0) {
      issues.push("リンク画像でファイルが見つからないものが" + missingLinks.length + "件あります:\n  " + missingLinks.join("\n  "));
    }

    if (issues.length === 0) {
      alert("入稿前チェック: 問題は見つかりませんでした。");
    } else {
      alert("入稿前チェックで" + issues.length + "件の指摘があります:\n\n" + issues.join("\n\n"));
    }
  }

  main();
})();
