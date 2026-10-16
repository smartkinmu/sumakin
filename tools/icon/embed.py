"""iPhone 用のアイコン（apple-touch-icon.png）を、画像を書き込んだ形（data URL）にして、
manifest.json の 180×180 のアイコンと、6 つの画面の <link rel="apple-touch-icon"> に入れる。

実機（iOS 27.1）では、ホーム画面に追加するときにアイコンの画像を取りに行けず、名前の頭の文字（「ス」）の
アイコンのままになった。書き込んだ画像なら取りに行かずに済む。docs/ios-home-screen-icon/README.md
使い方：python3 -I embed.py（render.sh の最後で動く）
"""
import base64
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGES = ['index.html', 'logs.html', 'due_logs.html', 'settings.html', 'backup.html', 'manual.html']

data_url = 'data:image/png;base64,' + base64.b64encode((ROOT / 'apple-touch-icon.png').read_bytes()).decode()

# manifest.json：180×180 のアイコンを書き込んだ画像にする（192・512 は Android 用にファイルのまま）
manifest_path = ROOT / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
icons = [icon for icon in manifest['icons'] if icon.get('sizes') != '180x180']
manifest['icons'] = [{'src': data_url, 'sizes': '180x180', 'type': 'image/png'}] + icons
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')

# 6 つの画面：iPhone 用のアイコンの指定を、同じ書き込んだ画像にする
link = re.compile(r'<link rel="apple-touch-icon" sizes="180x180" href="[^"]*">')
for page in PAGES:
    path = ROOT / page
    html = path.read_text(encoding='utf-8')
    new, count = link.subn(f'<link rel="apple-touch-icon" sizes="180x180" href="{data_url}">', html)
    if count != 1:
        raise SystemExit(f'{page}: iPhone 用のアイコンの指定が {count} 個（1 個のはず）')
    path.write_text(new, encoding='utf-8')

print(f'書き込んだ画像（{len(data_url)} 文字）を manifest.json と {len(PAGES)} つの画面に入れた')
