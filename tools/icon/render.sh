#!/bin/zsh
# アプリのアイコン（tools/icon/icon.svg）を、画面なしの Chrome で PNG にして、リポジトリの直下の
#   icon-512x512.png・icon-192x192.png（manifest.json。Android など）
#   apple-touch-icon.png（180×180。iPhone のホーム画面）
# を置き換える。画面なしの Chrome は小さい窓を作れず 192 では崩れるため、192 と 180 は 512 を縮めて作る。
# 縮めると色の情報や EXIF が入るため、画像だけの単純な PNG に戻す（strip-png.py）。
# iPhone はアイコンと manifest をアドレスごとに覚えているので、アイコンを変えたら、manifest.json の
# アイコンのアドレスと 6 つの画面の <link> に付けた印（?v=…）の数字を上げる（npm test で食い違いを確かめる）。
# 使い方：tools/icon/render.sh
set -e
dir="${0:A:h}"
root="${dir:h:h}"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=512,512 --screenshot="$root/icon-512x512.png" \
    "file://$dir/icon.svg" 2>/dev/null
sips -z 192 192 "$root/icon-512x512.png" --out "$root/icon-192x192.png" >/dev/null
sips -z 180 180 "$root/icon-512x512.png" --out "$root/apple-touch-icon.png" >/dev/null
python3 -I "$dir/strip-png.py" "$root/icon-512x512.png" "$root/icon-192x192.png" "$root/apple-touch-icon.png"
# iPhone 用（180）は、画像を取りに行かずに済むよう、manifest.json と 6 つの画面に書き込む（data URL）
python3 -I "$dir/embed.py"
sips -g pixelWidth -g pixelHeight "$root/icon-512x512.png" "$root/icon-192x192.png" "$root/apple-touch-icon.png"
