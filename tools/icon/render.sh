#!/bin/zsh
# アプリのアイコン（tools/icon/icon.svg）を、画面なしの Chrome で PNG にして、
# リポジトリの直下の icon-512x512.png と icon-192x192.png を置き換える。
# 画面なしの Chrome は小さい窓を作れず 192 では崩れるため、192 は 512 を縮めて作る。
# 使い方：tools/icon/render.sh
set -e
dir="${0:A:h}"
root="${dir:h:h}"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=512,512 --screenshot="$root/icon-512x512.png" \
    "file://$dir/icon.svg" 2>/dev/null
sips -z 192 192 "$root/icon-512x512.png" --out "$root/icon-192x192.png" >/dev/null
sips -g pixelWidth -g pixelHeight "$root/icon-512x512.png" "$root/icon-192x192.png"
