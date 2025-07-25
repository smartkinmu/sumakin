# バージョン管理ルール

アプリのバージョンは `major.minor.patch` の形式で付与します。初期値は `1.0.0` です。

- **patch (右端)**: 修正や小さな機能追加のたびに 1 ずつ増やします。ドキュメントのみの変更では更新しません。変更が発生したときは必ず更新します。
- **minor (中央)**: UI が大きく変わりユーザーが戸惑う場合に増やします。このとき patch は 0 に戻します。
- **major (左端)**: 指示があったときにのみ増やします。minor と patch は 0 に戻します。

バージョンは `index.html` 内の `<span class="version">ver.*</span>` と `manifest.json` の `"version"` に同じ値を記載します。今後の開発ではこの規則に従ってバージョン番号を更新してください。
