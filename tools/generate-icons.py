from pathlib import Path
import struct,zlib,json
root=Path("com.noobatwork.voicemeeter.sdPlugin/imgs")
root.mkdir(parents=True,exist_ok=True)
def png(size,kind):
    rows=[]
    for y in range(size):
        line=bytearray(b'\x00')
        for x in range(size):
            u=x/size;v=y/size
            bg=(17,27,43,255) if kind in ('plugin','key') else (0,0,0,0)
            center=any(abs(u-c)<.032 and .19<v<.83 for c in (.28,.50,.72))
            handles=any(abs(u-c)<.105 and abs(v-h)<.050 for c,h in ((.28,.36),(.50,.66),(.72,.49)))
            color=(255,255,255,255) if handles else ((28,190,170,255) if kind in ('plugin','key') else (255,255,255,255)) if center else bg
            line.extend(bytes(color))
        rows.append(bytes(line))
    def chunk(k,d):return struct.pack('!I',len(d))+k+d+struct.pack('!I',zlib.crc32(k+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
for name,size in [('plugin',256),('plugin@2x',512),('category',28),('category@2x',56),('action',20),('action@2x',40),('key',72),('key@2x',144)]:
    (root/(name+'.png')).write_bytes(png(size,name.split('@')[0]))
m=json.loads(Path("com.noobatwork.voicemeeter.sdPlugin/manifest.json").read_text(encoding='utf8'))
assert m["Version"] == "0.6.0.0"
assert len({a["UUID"] for a in m["Actions"]})==len(m["Actions"])
assert any(a["UUID"].endswith('.app') for a in m["Actions"])
for name in [m["Icon"],m["CategoryIcon"]]+[i for a in m["Actions"] for i in [a["Icon"]]+[s["Image"] for s in a["States"]]]:
    assert (root.parent/(name+".png")).exists(),name
    assert (root.parent/(name+"@2x.png")).exists(),name
print("Validated manifest and required icons")
