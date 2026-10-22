#!/usr/bin/env python3
import sys,zipfile,plistlib,json,hashlib
from macho import inspect
path=sys.argv[1]
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    names=z.namelist();base='Payload/Sanyuan.app/'
    info=plistlib.loads(z.read(base+'Info.plist'));binary=z.read(base+info['CFBundleExecutable']);meta=inspect(binary)
    assert info['MinimumOSVersion']=='15.0' and info['CFBundlePackageType']=='APPL'
    assert meta['cpu']==0x100000c and meta['kind']==2 and meta['platform'][0]==2
    assert 0x80000034 not in meta['commands'], 'Chained fixups can be incompatible with older signing tools'
    assert info['UIApplicationSceneManifest']['UISceneConfigurations']['UIWindowSceneSessionRoleApplication'][0]['UISceneDelegateClassName']=='SYSceneDelegate'
    assert not meta['signed'] and not any('_CodeSignature/' in n or n.endswith('embedded.mobileprovision') for n in names)
    assert z.getinfo(base+'Sanyuan').external_attr>>16&0o111
    for resource in ['Web/index.html','Web/app.js','Web/app.css','Web/hls-cleaner.js','Web/vendor/crypto-js.js']:
        assert len(z.read(base+resource))>100
    assert b'<script type="module"' not in z.read(base+'Web/index.html')
print(json.dumps({'validUnsignedIPA':True,'bundleId':info['CFBundleIdentifier'],'architecture':'arm64','minimumOS':info['MinimumOSVersion'],'deviceLaunchTested':False,'sha256':hashlib.sha256(open(path,'rb').read()).hexdigest()},indent=2))
