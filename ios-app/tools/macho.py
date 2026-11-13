"""Read Mach-O metadata without executing the iOS binary."""
import struct
from pathlib import PurePosixPath

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


def inspect_architecture(data, cpu=0x100000c):
    """Inspect an arm64 slice, or return None for a non-Mach-O resource."""
    if data[:4] == b'\xcf\xfa\xed\xfe':
        result = inspect(data)
        if result['cpu'] != cpu:
            raise ValueError('Bundled Mach-O is missing the required CPU architecture')
        return result
    fat_formats = {
        b'\xca\xfe\xba\xbe': ('>', False),
        b'\xbe\xba\xfe\xca': ('<', False),
        b'\xca\xfe\xba\xbf': ('>', True),
        b'\xbf\xba\xfe\xca': ('<', True),
    }
    if data[:4] not in fat_formats:
        return None
    endian, fat64 = fat_formats[data[:4]]
    count = struct.unpack_from(endian + 'I', data, 4)[0]
    entry_format = endian + ('IIQQII' if fat64 else 'IIIII')
    entry_size = struct.calcsize(entry_format)
    for index in range(count):
        fields = struct.unpack_from(entry_format, data, 8 + index * entry_size)
        arch_cpu, _, offset, length = fields[:4]
        if offset + length > len(data):
            raise ValueError('Invalid universal Mach-O slice')
        if arch_cpu == cpu:
            return inspect_architecture(data[offset:offset + length], cpu)
    raise ValueError('Universal Mach-O is missing the required CPU architecture')


def swift_runtime_dependencies(libraries):
    """Separate OS-provided Swift libraries from app-resolved dylibs."""
    system, embedded = set(), set()
    for install_name in libraries:
        name = PurePosixPath(install_name).name
        if not (name.startswith('libswift') and name.endswith('.dylib')):
            continue
        if install_name.startswith('/usr/lib/swift/'):
            system.add(install_name)
        else:
            embedded.add(name)
    return system, embedded


def validate_swift_runtime(binaries, app_libraries, support_libraries):
    """Validate runtime dependency closure for the app and every bundled binary.

    binaries is an iterable of (bundle-relative name, bytes), including embedded
    dylibs. Inspecting all of them catches runtime dependencies introduced by a
    framework or by another Swift compatibility library. OS libraries are never
    required in the bundle or SwiftSupport.
    """
    system, embedded = set(), set()
    for name, data in binaries:
        try:
            metadata = inspect_architecture(data)
        except (ValueError, struct.error) as error:
            raise ValueError('Cannot inspect bundled binary ' + name + ': ' + str(error)) from error
        if metadata is not None:
            system_dependencies, embedded_dependencies = swift_runtime_dependencies(metadata['libraries'])
            system.update(system_dependencies)
            embedded.update(embedded_dependencies)
    app_libraries, support_libraries = set(app_libraries), set(support_libraries)
    missing_app = sorted(embedded - app_libraries)
    if missing_app:
        raise ValueError('App bundle is missing Swift runtime libraries: ' + ', '.join(missing_app))
    missing_support = sorted((embedded | app_libraries) - support_libraries)
    if missing_support:
        raise ValueError('SwiftSupport is missing Swift runtime libraries: ' + ', '.join(missing_support))
    return {
        'systemSwiftRuntimeDependencies': sorted(system),
        'embeddedSwiftRuntimeDependencies': sorted(embedded),
        'swiftRuntimeLibraries': len(app_libraries),
    }
