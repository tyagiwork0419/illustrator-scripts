// NestShapesInArtboard.jsx
// 選択した複数の図形(曲線を含む自由な形状)を、実際の輪郭が重ならない範囲で、
// 現在のアートボードの範囲内にできるだけ詰めて配置する(回転も考慮した実形状ネスティング)
// PackShapesInArtboard.jsx との違い: バウンディングボックスではなく実際の輪郭で衝突判定を行う。
// そのぶん計算量が多く、図形数・曲線の複雑さ・グリッドの細かさによっては時間がかかる。
// 複合パスやグループ内の穴(内側のパス)は、空きスペースとしては扱わず障害物として扱う。
// 対象: Adobe Illustrator CS6
#target illustrator

(function () {
  var DEFAULT_GAP_MM = 3;                    // 図形間の最小間隔
  var CURVE_SEGMENTS = 8;                    // ベジェ曲線1本あたりの近似直線分割数(多いほど精度が上がるが遅くなる)
  var ROTATION_ANGLES_DEG = [0, 90, 180, 270]; // 試す回転角度(度)。増やすほど精度が上がるが遅くなる
  var GRID_STEP_MM = 2;                      // 配置位置を探索するグリッドの間隔(小さいほど精度が上がるが遅くなる)
  // 曲線は直線近似のため、弦(サンプル点を結ぶ直線)が本物の曲線よりわずかに内側になる。
  // 曲線を含む図形どうしが絡む判定にはこの分だけ余分な間隔を上乗せし、実際に重なることを防ぐ
  // (CURVE_SEGMENTSを増やすほど近似誤差は小さくなるが、念のための安全マージンとして残す)
  var CURVE_SAFETY_MARGIN_MM = 0.5;

  function mm2pt(mm) {
    return mm * 2.834645669291339;
  }

  function promptGapMm() {
    var message =
      "選択した図形を現在のアートボード内にできるだけ詰めて配置します。\n\n" +
      "図形どうしの最小間隔(mm)を入力してください";
    var input = prompt(message, String(DEFAULT_GAP_MM));
    if (input === null) return null; // キャンセル
    var v = parseFloat(input);
    if (isNaN(v) || v < 0) {
      alert("間隔には0以上の数値を入力してください。");
      return null;
    }
    return v;
  }

  function getActiveArtboardRect(doc) {
    var idx = doc.artboards.getActiveArtboardIndex();
    return doc.artboards[idx].artboardRect; // [left, top, right, bottom]
  }

  // --- ベジェ曲線の近似・多角形化 ---

  function cubicBezierPoint(p0, p1, p2, p3, t) {
    var mt = 1 - t;
    var a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return [
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]
    ];
  }

  var STRAIGHT_EPS_PT = 0.01; // ハンドルとアンカーの位置差がこれ未満なら直線区間とみなす

  function pointsNearlyEqual(a, b) {
    return Math.abs(a[0] - b[0]) < STRAIGHT_EPS_PT && Math.abs(a[1] - b[1]) < STRAIGHT_EPS_PT;
  }

  // PathItem 1個を { points: [...], hasCurve: bool } に変換する。
  // 直線区間(ハンドルがアンカーと同じ位置)は端点だけ使い、曲線区間だけ分割する。
  // hasCurve は、曲線近似による誤差の安全マージンを後で足すかどうかの判定に使う
  function pathToPolygon(pathItem) {
    var pts = pathItem.pathPoints;
    var n = pts.length;
    if (n < 2) return null;
    var points = [];
    var hasCurve = false;
    var segCount = pathItem.closed ? n : n - 1;
    for (var i = 0; i < segCount; i++) {
      var p0 = pts[i];
      var p1 = pts[(i + 1) % n];
      var a0 = p0.anchor;
      var c0 = p0.rightDirection;
      var c1 = p1.leftDirection;
      var a1 = p1.anchor;
      if (pointsNearlyEqual(a0, c0) && pointsNearlyEqual(a1, c1)) {
        points.push(a0);
      } else {
        hasCurve = true;
        for (var s = 0; s < CURVE_SEGMENTS; s++) {
          points.push(cubicBezierPoint(a0, c0, c1, a1, s / CURVE_SEGMENTS));
        }
      }
    }
    if (!pathItem.closed) {
      points.push(pts[n - 1].anchor);
    }
    return { points: points, hasCurve: hasCurve };
  }

  // PageItem(パス/複合パス/グループ)から輪郭多角形の配列を集める(穴は障害物として扱う)
  function collectPolygons(item, out) {
    if (item.typename === "PathItem") {
      var poly = pathToPolygon(item);
      if (poly) out.push(poly);
    } else if (item.typename === "CompoundPathItem") {
      for (var i = 0; i < item.pathItems.length; i++) {
        collectPolygons(item.pathItems[i], out);
      }
    } else if (item.typename === "GroupItem") {
      for (var j = 0; j < item.pageItems.length; j++) {
        collectPolygons(item.pageItems[j], out);
      }
    }
    // TextFrame等、パスを持たない型は対象外
  }

  function itemToPolygons(item) {
    var polys = [];
    collectPolygons(item, polys);
    return polys;
  }

  // --- 幾何ユーティリティ ---

  // poly: { points: [...], hasCurve } を受け取る
  function polygonBounds(poly) {
    var pts = poly.points;
    var minX = null, minY = null, maxX = null, maxY = null;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (minX === null || p[0] < minX) minX = p[0];
      if (maxX === null || p[0] > maxX) maxX = p[0];
      if (minY === null || p[1] < minY) minY = p[1];
      if (maxY === null || p[1] > maxY) maxY = p[1];
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  // polys: { points, hasCurve } の配列
  function boundsOfMulti(polys) {
    var minX = null, minY = null, maxX = null, maxY = null;
    for (var i = 0; i < polys.length; i++) {
      var b = polygonBounds(polys[i]);
      if (minX === null || b.minX < minX) minX = b.minX;
      if (maxX === null || b.maxX > maxX) maxX = b.maxX;
      if (minY === null || b.minY < minY) minY = b.minY;
      if (maxY === null || b.maxY > maxY) maxY = b.maxY;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function boundsOverlap(b1, b2, gap) {
    return !(b1.maxX + gap <= b2.minX || b2.maxX + gap <= b1.minX ||
             b1.maxY + gap <= b2.minY || b2.maxY + gap <= b1.minY);
  }

  // angleDeg: 反時計回りを正とする(数学の標準的な向き)。pivotを中心に回転してからdx,dy平行移動する
  // polys: { points, hasCurve } の配列。hasCurveフラグはそのまま引き継ぐ
  function transformPolygons(polys, angleDeg, pivot, dx, dy) {
    var rad = angleDeg * Math.PI / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    var result = [];
    for (var i = 0; i < polys.length; i++) {
      var pts = polys[i].points;
      var newPoints = [];
      for (var j = 0; j < pts.length; j++) {
        var px = pts[j][0] - pivot[0];
        var py = pts[j][1] - pivot[1];
        var rx = pivot[0] + px * cos - py * sin;
        var ry = pivot[1] + px * sin + py * cos;
        newPoints.push([rx + dx, ry + dy]);
      }
      result.push({ points: newPoints, hasCurve: polys[i].hasCurve });
    }
    return result;
  }

  function cross(o, p, q) {
    return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  }

  function segmentsIntersect(a, b, c, d) {
    var d1 = cross(c, d, a);
    var d2 = cross(c, d, b);
    var d3 = cross(a, b, c);
    var d4 = cross(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  function pointInPolygon(pt, poly) {
    var inside = false;
    var n = poly.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      var intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
        (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointSegDistance(p, a, b) {
    var abx = b[0] - a[0], aby = b[1] - a[1];
    var apx = p[0] - a[0], apy = p[1] - a[1];
    var lenSq = abx * abx + aby * aby;
    var t = lenSq > 0 ? (apx * abx + apy * aby) / lenSq : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var cx = a[0] + t * abx, cy = a[1] + t * aby;
    var dx = p[0] - cx, dy = p[1] - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function segSegDistance(a, b, c, d) {
    if (segmentsIntersect(a, b, c, d)) return 0;
    var d1 = pointSegDistance(a, c, d);
    var d2 = pointSegDistance(b, c, d);
    var d3 = pointSegDistance(c, a, b);
    var d4 = pointSegDistance(d, a, b);
    return Math.min(Math.min(d1, d2), Math.min(d3, d4));
  }

  // 2つの多角形が、最小間隔gapを含めて衝突しているか
  function polygonsCollide(polyA, polyB, gap) {
    var n = polyA.length, m = polyB.length;
    var minDist = null;
    for (var i = 0; i < n; i++) {
      var a1 = polyA[i], a2 = polyA[(i + 1) % n];
      for (var j = 0; j < m; j++) {
        var b1 = polyB[j], b2 = polyB[(j + 1) % m];
        var d = segSegDistance(a1, a2, b1, b2);
        if (d === 0) return true; // 辺同士が交差 = 衝突
        if (minDist === null || d < minDist) minDist = d;
      }
    }
    // 辺は交差していなくても、一方が他方を完全に内包している場合がある
    if (pointInPolygon(polyA[0], polyB) || pointInPolygon(polyB[0], polyA)) {
      return true;
    }
    return minDist !== null && minDist < gap;
  }

  // gapBase: 通常の最小間隔 / curveMargin: 曲線を含む組み合わせにだけ追加で足す安全マージン
  function polysCollideMulti(polysA, polysB, gapBase, curveMargin) {
    for (var i = 0; i < polysA.length; i++) {
      for (var j = 0; j < polysB.length; j++) {
        var gap = gapBase;
        if (polysA[i].hasCurve || polysB[j].hasCurve) gap += curveMargin;
        if (polygonsCollide(polysA[i].points, polysB[j].points, gap)) return true;
      }
    }
    return false;
  }

  // Illustratorのrotate()が反時計回り正か時計回り正かを、使い捨てのテストパスで実測して判定する
  // 戻り値: 1なら反時計回り正(このスクリプトの数式と同じ)、-1なら時計回り正(符号反転が必要)
  function detectRotationSign(doc) {
    var tmpLayer = doc.layers.add();
    var sign = 1;
    try {
      var p = tmpLayer.pathItems.add();
      p.setEntirePath([[0, 0], [100, 0]]);
      p.rotate(10);
      var a0 = p.pathPoints[0].anchor;
      var a1 = p.pathPoints[1].anchor;
      var far = (Math.abs(a0[0]) + Math.abs(a0[1]) > Math.abs(a1[0]) + Math.abs(a1[1])) ? a0 : a1;
      sign = far[1] > 0 ? 1 : -1;
    } catch (e) {
      sign = 1;
    }
    tmpLayer.remove();
    return sign;
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
    var curveMarginPt = mm2pt(CURVE_SAFETY_MARGIN_MM);

    var areaRect = getActiveArtboardRect(doc);
    var areaLeft = areaRect[0], areaTop = areaRect[1], areaRight = areaRect[2], areaBottom = areaRect[3];
    var gridStepPt = mm2pt(GRID_STEP_MM);
    var rotationSign = detectRotationSign(doc);

    var items = [];
    var skipped = 0;
    for (var i = 0; i < sel.length; i++) {
      var polys = itemToPolygons(sel[i]);
      if (polys.length === 0) {
        skipped++;
        continue;
      }
      var b = boundsOfMulti(polys);
      var area = (b.maxX - b.minX) * (b.maxY - b.minY);
      items.push({ item: sel[i], polys: polys, area: area });
    }
    if (items.length === 0) {
      alert("パスを持つオブジェクトが選択されていません。");
      return;
    }
    items.sort(function (a, b) { return b.area - a.area; });

    var placedPolys = [];
    var placedBounds = [];
    var overflowed = 0;

    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      var found = null;

      for (var ai = 0; ai < ROTATION_ANGLES_DEG.length && !found; ai++) {
        var angle = ROTATION_ANGLES_DEG[ai];
        var rotated = transformPolygons(it.polys, angle, [0, 0], 0, 0);
        var rb = boundsOfMulti(rotated);
        var w = rb.maxX - rb.minX;
        var h = rb.maxY - rb.minY;
        if (w > areaRight - areaLeft || h > areaTop - areaBottom) continue;

        for (var y = areaTop - h; y >= areaBottom && !found; y -= gridStepPt) {
          for (var x = areaLeft; x <= areaRight - w && !found; x += gridStepPt) {
            var dx = x - rb.minX;
            var dy = y - rb.minY;
            var candidate = transformPolygons(it.polys, angle, [0, 0], dx, dy);
            var candBounds = boundsOfMulti(candidate);

            var collides = false;
            for (var p2 = 0; p2 < placedPolys.length; p2++) {
              // 事前の矩形チェックは、曲線の安全マージンぶんも含めて多めに見ておく(誤って足切りしないため)
              if (!boundsOverlap(candBounds, placedBounds[p2], gapPt + curveMarginPt)) continue;
              if (polysCollideMulti(candidate, placedPolys[p2], gapPt, curveMarginPt)) {
                collides = true;
                break;
              }
            }
            if (!collides) {
              found = { angle: angle, dx: dx, dy: dy, bounds: candBounds };
            }
          }
        }
      }

      if (!found) {
        overflowed++;
        continue;
      }

      if (found.angle !== 0) {
        it.item.rotate(found.angle * rotationSign);
      }
      // 回転後の実測ポリゴンを取り直し、目標位置(found.bounds)に平行移動する
      // (rotate()の回転中心がどこであっても、実測してから合わせるので位置がずれない)
      var actualPolys = itemToPolygons(it.item);
      var actualBounds = boundsOfMulti(actualPolys);
      var moveDx = found.bounds.minX - actualBounds.minX;
      var moveDy = found.bounds.minY - actualBounds.minY;
      it.item.translate(moveDx, moveDy);

      var finalPolys = transformPolygons(actualPolys, 0, [0, 0], moveDx, moveDy);
      placedPolys.push(finalPolys);
      placedBounds.push(boundsOfMulti(finalPolys));
    }

    var message = "";
    if (overflowed > 0) {
      message += overflowed + "個の図形がアートボードに収まりませんでした。\n";
    }
    if (skipped > 0) {
      message += skipped + "個のオブジェクトはパスを持たないため対象外にしました。\n";
    }
    if (message) {
      alert(message);
    }
  }

  main();
})();
