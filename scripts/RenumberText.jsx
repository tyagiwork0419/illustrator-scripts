// RenumberText.jsx
// 選択した複数のテキストオブジェクトの中身を、位置順(上から下、同じ高さなら左から右)に
// 連番で振り直す。数字・丸数字・ローマ数字の3形式に対応する。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var CIRCLED_DIGITS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
    "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"]; // 1〜20まで対応(それ以降は算用数字にフォールバック)

  function toRoman(n) {
    var map = [
      [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
    ];
    var result = "";
    for (var i = 0; i < map.length; i++) {
      while (n >= map[i][0]) {
        result += map[i][1];
        n -= map[i][0];
      }
    }
    return result;
  }

  function formatNumber(n, format) {
    if (format === "circled") {
      if (n >= 1 && n <= CIRCLED_DIGITS.length) return CIRCLED_DIGITS[n - 1];
      return String(n); // 対応範囲外は算用数字にフォールバック
    }
    if (format === "roman") {
      return toRoman(n);
    }
    return String(n);
  }

  function promptFormat() {
    var input = prompt("番号の形式を入力してください(1=算用数字 / 2=丸数字 / 3=ローマ数字)", "1");
    if (input === null) return null;
    if (input === "2") return "circled";
    if (input === "3") return "roman";
    return "plain";
  }

  function promptStartAndStep() {
    var startInput = prompt("開始番号を入力してください", "1");
    if (startInput === null) return null;
    var start = parseInt(startInput, 10);
    if (isNaN(start)) {
      alert("開始番号には整数を入力してください。");
      return null;
    }
    var stepInput = prompt("増分を入力してください", "1");
    if (stepInput === null) return null;
    var step = parseInt(stepInput, 10);
    if (isNaN(step) || step === 0) {
      alert("増分には0以外の整数を入力してください。");
      return null;
    }
    return { start: start, step: step };
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      alert("連番を振りたいテキストオブジェクトを選択してください。");
      return;
    }

    var textItems = [];
    for (var i = 0; i < sel.length; i++) {
      if (sel[i].typename === "TextFrame") textItems.push(sel[i]);
    }
    if (textItems.length === 0) {
      alert("選択の中にテキストオブジェクトが見つかりませんでした。");
      return;
    }

    // 上から下、同じ高さなら左から右の読み順に並べ替える
    textItems.sort(function (a, b) {
      var ab = a.geometricBounds, bb = b.geometricBounds; // [left, top, right, bottom]
      if (Math.abs(ab[1] - bb[1]) > 0.01) return bb[1] - ab[1];
      return ab[0] - bb[0];
    });

    var format = promptFormat();
    if (format === null) return;
    var params = promptStartAndStep();
    if (params === null) return;

    var n = params.start;
    for (var t = 0; t < textItems.length; t++) {
      textItems[t].contents = formatNumber(n, format);
      n += params.step;
    }

    alert(textItems.length + "件のテキストに連番を振りました。");
  }

  main();
})();
