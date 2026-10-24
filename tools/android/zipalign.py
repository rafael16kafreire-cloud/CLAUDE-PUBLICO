"""Alinha (em 4 bytes) os arquivos guardados sem compressão dentro do APK,
como o 'zipalign' do Android faz. Uso: python3 zipalign.py entrada.apk saida.apk"""
import sys
import zipfile

ALIGN = 4
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info)
        out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        out.compress_type = info.compress_type
        out.external_attr = info.external_attr
        out.create_system = info.create_system
        if info.compress_type == zipfile.ZIP_STORED:
            start = zout.fp.tell()
            name_len = len(out.filename.encode('utf-8'))
            pad = (ALIGN - (start + 30 + name_len) % ALIGN) % ALIGN
            out.extra = b'\0' * pad
        zout.writestr(out, data)
print(f'alinhado: {dst}')
