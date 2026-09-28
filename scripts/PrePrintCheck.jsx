// PrePrintCheck.jsx
// 印刷前チェック: 実際に印刷する直前に行う最終確認・仕上げ処理。
// PreflightCheck.jsx(入稿前チェック、確認のみ)とは別の位置づけで、
// こちらはまず検出・レポートし、確認(はい/いいえ)を取ってから初めてドキュメントを書き換える。
//
// 内容:
//   - トリムマークの確認(検出のみ、自動修正はしない)
//     - 最前面のレイヤーにあるか
//     - 近くに暗い色のオブジェクトが重なっていて視認性が低くなっていないか(簡易判定)
//   - テキストのアウトライン化(検出後、確認を取ってから実行)
//   - アピアランスの分割(検出後、確認を取ってから実行。expandStyleコマンドを使用)
//
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var DARK_CMYK_AVG_THRESHOLD = 70;      // この平均インク量(%)以上を「暗い色」とみなす(CMYK)
  var DARK_RGB_LUMINANCE_THRESHOLD = 80; // この輝度(0-255)未満を「暗い色」とみなす(RGB)

  function isRegistrationColor(color) {
    return !!color && color.typename === "SpotColor" && color.spot && color.spot.colorType === ColorModel.REGISTRATION;
  }

  function isDarkColor(color) {
    if (!color) return false;
    if (color.typename === "CMYKColor") {
      var avg = (color.cyan + color.magenta + color.yellow + color.black) / 4;
      return avg >= DARK_CMYK_AVG_THRESHOLD;
    }
    if (color.typename === "RGBColor") {
      var luminance = 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue;
      return luminance < DARK_RGB_LUMINANCE_THRESHOLD;
    }
    return false;
  }

  function boundsOverlap(a, b) {
    // a, b: [left, top, right, bottom]
    return !(a[2] < b[0] || b[2] < a[0] || a[3] > b[1] || b[3] > a[1]);
  }

  // トリムマーク(レジストレーションカラーのオブジェクト)の状態を検出する(ドキュメントは変更しない)
  function checkTrimMarks(doc) {
    var messages = [];
    var trimMarks = [];
    for (var i = 0; i < doc.pathItems.length; i++) {
      var pi = doc.pathItems[i];
      try {
        if ((pi.stroked && isRegistrationColor(pi.strokeColor)) || (pi.filled && isRegistrationColor(pi.fillColor))) {
          trimMarks.push(pi);
        }
      } catch (e) {}
    }

    if (trimMarks.length === 0) {
      messages.push("トリムマーク(レジストレーションカラーのオブジェクト)が見つかりませんでした。");
      return messages;
    }

    // 最前面レイヤーにあるか
    var frontLayer = doc.layers[0];
    var notFrontCount = 0;
    for (var t = 0; t < trimMarks.length; t++) {
      try {
        if (trimMarks[t].layer !== frontLayer) notFrontCount++;
      } catch (e) {}
    }
    if (notFrontCount > 0) {
      messages.push("トリムマークが最前面のレイヤー(" + frontLayer.name + ")にないものが" + notFrontCount + "件あります。他のオブジェクトに埋もれていないか確認してください。");
    }

    // 近くに暗い色のオブジェクトが重なっていないか(簡易判定。正確な見た目判断ではありません)
    var lowVisibilityCount = 0;
    for (var m = 0; m < trimMarks.length; m++) {
      var mb = trimMarks[m].geometricBounds;
      var overlapFound = false;
      for (var o = 0; o < doc.pathItems.length; o++) {
        var other = doc.pathItems[o];
        if (other === trimMarks[m]) continue;
        try {
          if (isRegistrationColor(other.fillColor) || isRegistrationColor(other.strokeColor)) continue;
        } catch (e) {}
        try {
          var ob = other.geometricBounds;
          if (!boundsOverlap(mb, ob)) continue;
          if ((other.filled && isDarkColor(other.fillColor)) || (other.stroked && isDarkColor(other.strokeColor))) {
            overlapFound = true;
            break;
          }
        } catch (e) {}
      }
      if (overlapFound) lowVisibilityCount++;
    }
    if (lowVisibilityCount > 0) {
      messages.push("近くに暗い色のオブジェクトが重なっていて視認性が低い可能性のあるトリムマークが" + lowVisibilityCount + "件あります(簡易判定のため、目視でも確認してください)。");
    }

    if (messages.length === 0) {
      messages.push("トリムマーク(" + trimMarks.length + "件)は最前面にあり、目立った視認性の問題も見つかりませんでした。");
    }
    return messages;
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;

    // --- 検出フェーズ(この時点ではドキュメントを変更しない) ---
    var trimMarkMessages = checkTrimMarks(doc);

    var liveTextFrames = [];
    for (var t = 0; t < doc.textFrames.length; t++) {
      liveTextFrames.push(doc.textFrames[t]);
    }

    var report = "【トリムマーク】\n" + trimMarkMessages.join("\n") + "\n\n";
    report += "【テキスト】\nアウトライン化されていないテキストが" + liveTextFrames.length + "件あります。\n\n";
    report += "【アピアランス】\n自動検出はできないため、実行時に一律「アピアランスを分割」を適用します(効果が無いオブジェクトには影響しません)。";

    alert(report);

    // --- 確認フェーズ ---
    if (liveTextFrames.length === 0) {
      var proceedAppearanceOnly = confirm("アウトライン化が必要なテキストはありません。アピアランスの分割のみ実行しますか?");
      if (!proceedAppearanceOnly) return;
    } else {
      var proceed = confirm(
        "以下を実行します。実行後は元のテキストや個別のアピアランスには戻せません(保存前ならCtrl+Zで取り消せます)。\n\n" +
        "・テキスト" + liveTextFrames.length + "件をすべてアウトライン化\n" +
        "・ドキュメント全体のアピアランスを分割\n\n" +
        "実行してよろしいですか?"
      );
      if (!proceed) return;

      for (var i = 0; i < liveTextFrames.length; i++) {
        try {
          liveTextFrames[i].createOutline();
        } catch (e) {}
      }
    }

    // --- 実行フェーズ(アピアランスの分割) ---
    try {
      app.executeMenuCommand("selectall");
      app.executeMenuCommand("expandStyle");
      doc.selection = null;
    } catch (e) {}

    alert("印刷前チェックの処理が完了しました。");
  }

  main();
})();
