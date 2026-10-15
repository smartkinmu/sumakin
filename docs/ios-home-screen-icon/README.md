# iPhone のホーム画面のアイコン（調べた結果）

2026-10-16 に、iPhone で「ホーム画面に追加」するとアイコンが「ス」の文字になる、と言われて調べた。
読んだ資料は `documents/web/` に保存し（git には入れない）、取った記録は `sources.md` にある。

## わかったこと

- iOS 16.4 から、ページに `manifest.json` があると、Safari はそのアイコンを使う。WebKit の Safari 26 の説明にも「manifest にアイコンを書けば、それが使われる」とある（https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/）
- manifest のアイコンの中に、Safari が扱えないものがあると、正しい PNG があってもアイコンを作らず、名前の頭の文字のアイコンになる。報告では SVG を外したら直った（https://bugs.webkit.org/show_bug.cgi?id=256429）
- iOS 26 から、ホーム画面に追加したサイトは、ふつう Web アプリとして開く（https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html）

## このアプリでしたこと

- v1.17.15 で、Android 向けに、同じ画像を `"purpose": "maskable"` としても manifest に並べていた。iPhone でアイコンが作られなくなった時期と合うので、v1.18.2 で外し、アイコンが出ていたころと同じ 2 つ（192・512、purpose なし）に戻した
- iPhone 用の `apple-touch-icon.png`（180×180、画像だけの単純な PNG）も、6 つの画面すべてで指定している（v1.18.1）
- 実機・シミュレーターでは確かめられていない。maskable を足し直すときは、別のファイル名にして、iOS シミュレーターで「ホーム画面に追加」を試してからにする
