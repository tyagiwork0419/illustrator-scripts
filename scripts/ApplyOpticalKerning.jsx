// ApplyOpticalKerning.jsx
// 選択したテキストオブジェクト(未選択ならドキュメント内の全テキスト)に、
// カーニング方式「オプティカル」を一括適用する。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;

    var textFrames = [];
    if (doc.selection && doc.selection.length > 0) {
      for (var i = 0; i < doc.selection.length; i++) {
        if (doc.selection[i].typename === "TextFrame") textFrames.push(doc.selection[i]);
      }
      if (textFrames.length === 0) {
        alert("選択の中にテキストオブジェクトが見つかりませんでした。");
        return;
      }
    } else {
      for (var t = 0; t < doc.textFrames.length; t++) {
        textFrames.push(doc.textFrames[t]);
      }
      if (textFrames.length === 0) {
        alert("ドキュメント内にテキストが見つかりませんでした。");
        return;
      }
    }

    var count = 0;
    for (var n = 0; n < textFrames.length; n++) {
      try {
        textFrames[n].textRange.characterAttributes.kerningMethod = AutoKernType.OPTICAL;
        count++;
      } catch (e) {}
    }

    alert(count + "件のテキストにオプティカルカーニングを適用しました。");
  }

  main();
})();
