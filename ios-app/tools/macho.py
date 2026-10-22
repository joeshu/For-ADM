"""Read Mach-O metadata without executing the iOS binary."""
import struct

def inspect(data):
    if data[:4] != b'\xcf\xfa\xed\xfe': raise ValueError('Not a little-endian Mach-O 64 binary')
    _, cpu, subtype, kind, count, size, flags, reserved=struct.unpack_from('<8I',data)
    offset=32;commands=[];libraries=[];symbols=[];platform=None
    for _ in range(count):
        cmd,length=struct.unpack_from('<II',data,offset)
        if length<8 or offset+length>len(data):raise ValueError('Invalid load command')
        commands.append(cmd)
        if cmd in (0xc,0x80000018,0x8000001f):
            at=offset+struct.unpack_from('<I',data,offset+8)[0]
            libraries.append(data[at:data.index(b'\0',at)].decode())
        if cmd==0x32:platform=struct.unpack_from('<III',data,offset+8)
        if cmd==2:
            symoff,nsyms,stroff,strsize=struct.unpack_from('<4I',data,offset+8)
            for i in range(nsyms):
                ix,typ,sect,desc,value=struct.unpack_from('<IBBHQ',data,symoff+16*i)
                if ix and typ&0xe==0 and typ&1 and not value:
                    begin=stroff+ix;symbols.append(data[begin:data.index(b'\0',begin)].decode())
        offset+=length
    return dict(cpu=cpu,kind=kind,platform=platform,libraries=libraries,undefined=sorted(set(symbols)),signed=0x1d in commands,commands=commands)
