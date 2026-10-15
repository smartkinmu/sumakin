"""PNG から、画像そのもの以外の情報（色の情報・EXIF など）を取り除く。

sips で縮めた PNG には色の情報（sRGB）と EXIF が入る。iPhone のホーム画面のアイコンは、
前にうまく出ていたものと同じ、画像だけの単純な PNG にそろえる。
使い方：python3 -I strip-png.py <PNGのファイル>...（ファイルをその場で書き換える）
"""
import struct
import sys
import zlib

KEEP = {b'IHDR', b'PLTE', b'IDAT', b'IEND'}


def chunk(kind, body):
    """PNG のかたまり（長さ・種類・中身・CRC）を作る。"""
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))


def strip(path):
    """画像そのものに要るかたまり（IHDR・PLTE・IDAT・IEND）だけを残して書き直す。"""
    data = open(path, 'rb').read()
    signature = b'\x89PNG\r\n\x1a\n'
    if data[:8] != signature:
        raise SystemExit(f'{path}: PNG ではありません')
    out, removed, i = [signature], [], 8
    while i < len(data):
        length = struct.unpack('>I', data[i:i + 4])[0]
        kind = data[i + 4:i + 8]
        body = data[i + 8:i + 8 + length]
        if kind in KEEP:
            out.append(chunk(kind, body))
        else:
            removed.append(kind.decode('latin1'))
        i += 12 + length
    open(path, 'wb').write(b''.join(out))
    print(f'{path}: 取り除いた情報 {removed or "なし"}')


for name in sys.argv[1:]:
    strip(name)
