"""Confere o APK: arquivos obrigatórios e alinhamento de 4 bytes dos
arquivos guardados sem compressão (exigência do Android 11+)."""
import struct
import sys
import zipfile

path = sys.argv[1]
problems = []
with zipfile.ZipFile(path) as z, open(path, 'rb') as f:
    names = z.namelist()
    for required in ('AndroidManifest.xml', 'classes.dex', 'resources.arsc', 'assets/index.html'):
        if required not in names:
            problems.append(f'falta {required}')
    for info in z.infolist():
        f.seek(info.header_offset)
        header = f.read(30)
        name_len, extra_len = struct.unpack('<HH', header[26:30])
        data_offset = info.header_offset + 30 + name_len + extra_len
        if info.compress_type == zipfile.ZIP_STORED and data_offset % 4 != 0:
            problems.append(f'{info.filename} desalinhado ({data_offset})')
        if info.filename == 'resources.arsc' and info.compress_type != zipfile.ZIP_STORED:
            problems.append('resources.arsc está comprimido')
if problems:
    print('PROBLEMAS:', *problems, sep='\n  ')
    sys.exit(1)
print(f'APK OK: {len(names)} arquivos, alinhamento correto')
