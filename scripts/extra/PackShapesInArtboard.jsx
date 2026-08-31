// PackShapesInArtboard.jsx
// 選択した複数の図形を、一定のスペースを空けながら現在のアートボードの範囲内に、
// できるだけ大きな1枚の矩形の空きスペースが残るように配置する(ギロチン分割法、回転対応)
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var DEFAULT_GAP_MM = 3;    // 図形間のデフォルトスペース
  var ALLOW_ROTATION = true; // 図形を90度回転させて配置してよいか

  function mm2pt(mm) {
    return mm * 2.834645669291339;
  }

  function pt2mm(pt) {
    return pt / 2.834645669291339;
  }

  function getActiveArtboardRect(doc) {
    var idx = doc.artboards.getActiveArtboardIndex();
    return doc.artboards[idx].artboardRect; // [left, top, right, bottom]
  }

  function promptGapMm() {
    var input = prompt("図形どうしの間隔(mm)を入力してください", String(DEFAULT_GAP_MM));
    if (input === null) return null; // キャンセル
    var v = parseFloat(input);
    if (isNaN(v) || v < 0) {
      alert("間隔には0以上の数値を入力してください。");
      return null;
    }
    return v;
  }

  // 空き矩形は { left, top, width, height } で表す(right = left+width, bottom = top-height)
  function rectArea(r) {
    return r.width * r.height;
  }

  // 空き矩形 freeRect を w x h のアイテムで使用したときの残り領域を、
  // なるべく大きな1枚の矩形が残るように2パターンのギロチン分割から選んで返す
  function splitFreeRect(freeRect, w, h) {
    // パターンA: 右側は使用分の高さだけ、下側は全幅
    var rightA = { left: freeRect.left + w, top: freeRect.top, width: freeRect.width - w, height: h };
    var bottomA = { left: freeRect.left, top: freeRect.top - h, width: freeRect.width, height: freeRect.height - h };
    // パターンB: 右側は全高、下側は使用分の幅だけ
    var rightB = { left: freeRect.left + w, top: freeRect.top, width: freeRect.width - w, height: freeRect.height };
    var bottomB = { left: freeRect.left, top: freeRect.top - h, width: w, height: freeRect.height - h };

    var maxA = Math.max(rectArea(rightA), rectArea(bottomA));
    var maxB = Math.max(rectArea(rightB), rectArea(bottomB));

    var chosen = (maxA >= maxB) ? [rightA, bottomA] : [rightB, bottomB];
    var result = [];
    for (var i = 0; i < chosen.length; i++) {
      if (chosen[i].width > 0.001 && chosen[i].height > 0.001) {
        result.push(chosen[i]);
      }
    }
    return result;
  }

  function main() {
    if (app.documents.length === 0) {
      alert("ドキュメントを開いてください。");
      return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      alert("配置する図形を選択してください。");
      return;
    }

    var gapMm = promptGapMm();
    if (gapMm === null) return;
    var gapPt = mm2pt(gapMm);

    var areaRect = getActiveArtboardRect(doc);
    var freeRects = [{
      left: areaRect[0],
      top: areaRect[1],
      width: areaRect[2] - areaRect[0],
      height: areaRect[1] - areaRect[3]
    }];

    // 図形ごとのバウンディングボックスを取得し、面積の降順に並べ替える(大きい図形から優先的に配置する)
    var items = [];
    for (var i = 0; i < sel.length; i++) {
      var b = sel[i].geometricBounds; // [left, top, right, bottom]
      var w = b[2] - b[0];
      var h = b[1] - b[3];
      items.push({ item: sel[i], width: w, height: h, area: w * h });
    }
    items.sort(function (a, b) {
      return b.area - a.area;
    });

    var overflowed = false;

    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      var candidates = [{ w: it.width, h: it.height, rotated: false }];
      if (ALLOW_ROTATION) {
        candidates.push({ w: it.height, h: it.width, rotated: true });
      }

      // 収まる空き矩形の中で最も小さいもの(Best Area Fit)を選び、
      // その中では分割後に残る最大片が大きくなる向きを選ぶ
      var bestRectIndex = -1;
      var bestRectArea = null;
      var bestOrientation = null;

      for (var r = 0; r < freeRects.length; r++) {
        var fr = freeRects[r];
        var fitting = [];
        for (var c = 0; c < candidates.length; c++) {
          var cand = candidates[c];
          if (cand.w + gapPt <= fr.width && cand.h + gapPt <= fr.height) {
            fitting.push(cand);
          }
        }
        if (fitting.length === 0) continue;

        var frArea = rectArea(fr);
        if (bestRectArea === null || frArea < bestRectArea) {
          var bestCand = fitting[0];
          var bestScore = null;
          for (var f = 0; f < fitting.length; f++) {
            var pieces = splitFreeRect(fr, fitting[f].w + gapPt, fitting[f].h + gapPt);
            var score = 0;
            for (var p = 0; p < pieces.length; p++) {
              if (rectArea(pieces[p]) > score) score = rectArea(pieces[p]);
            }
            if (bestScore === null || score > bestScore) {
              bestScore = score;
              bestCand = fitting[f];
            }
          }
          bestRectArea = frArea;
          bestRectIndex = r;
          bestOrientation = bestCand;
        }
      }

      if (bestRectIndex === -1) {
        overflowed = true;
        continue;
      }

      var target = freeRects[bestRectIndex];

      if (bestOrientation.rotated) {
        it.item.rotate(90);
      }
      var cb = it.item.geometricBounds; // 回転後の実測値を使う(基準点に依存しない)
      var dx = target.left - cb[0];
      var dy = target.top - cb[1];
      it.item.translate(dx, dy);

      var newPieces = splitFreeRect(target, bestOrientation.w + gapPt, bestOrientation.h + gapPt);
      freeRects.splice(bestRectIndex, 1);
      for (var np = 0; np < newPieces.length; np++) {
        freeRects.push(newPieces[np]);
      }
    }

    // 残った空き矩形の中で最大のものを求める(配置結果の目安として表示する)
    var largest = null;
    for (var q = 0; q < freeRects.length; q++) {
      if (largest === null || rectArea(freeRects[q]) > rectArea(largest)) {
        largest = freeRects[q];
      }
    }

    var message = "";
    if (overflowed) {
      message += "すべての図形がアートボードの範囲内に収まりませんでした。\n";
    }
    if (largest) {
      message += "残った最大の空きスペース: 幅" + pt2mm(largest.width).toFixed(1) + "mm x 高さ" + pt2mm(largest.height).toFixed(1) + "mm";
    }
    if (message) {
      alert(message);
    }
  }

  main();
})();
