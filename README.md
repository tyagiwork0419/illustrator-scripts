# illustrator_scripts

Adobe Illustrator 用のスクリプト(ExtendScript / .jsx)をまとめて管理するリポジトリです。
複数PCへは、このリポジトリをクローン(または pull)してスクリプトフォルダを配置する運用を想定しています。

## 動作環境

- Adobe Illustrator CS6 (ExtendScript)

## 使い方

1. `scripts/` 内の `.jsx` ファイルを Illustrator のスクリプトフォルダにコピーします。
   - macOS: `/Applications/Adobe Illustrator CS6/Presets.localized/en_US/Scripts/`
   - Windows: `C:\Program Files\Adobe\Adobe Illustrator CS6\Presets\ja_JP\スクリプト\`
   - (バージョン/言語によりパスは異なります)
2. Illustrator を再起動します。
3. `ファイル > スクリプト` メニューから対象のスクリプトを実行します。

## スクリプト一覧

### CreateCornerTombo.jsx

角のみのトンボ(二重線: 内トンボ+外トンボ)を、選択オブジェクトのバウンディングボックスを基準に作成します。
中央のセンタートンボ(十字マーク)は作成しません。

- 対象: 選択オブジェクトのバウンディングボックス
- 塗り足し: 3mm
- トンボ線の長さ: 3mm
- トンボ線の太さ: 0.1mm
- 線色: レジストレーションカラー(全版に印刷)。見つからない場合は K100% で代用
- 作成結果は「トンボ」レイヤー内の「角トンボ」グループにまとめられます

デフォルト値はスクリプト先頭の `BLEED_MM` / `MARK_LEN_MM` / `STROKE_MM` を編集することで変更できます。

**使い方**: トンボを付けたいオブジェクト(またはアートボード上の仕上がり範囲を示すオブジェクト)を選択してからスクリプトを実行してください。
