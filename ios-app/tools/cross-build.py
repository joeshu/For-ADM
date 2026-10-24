#!/usr/bin/env python3
"""Build an unsigned arm64 iOS application using LLVM and public ABI stubs.
The stubs are link-time metadata only. System frameworks ship on the device.
"""
import argparse,os,pathlib,subprocess,json,plistlib,zipfile,shutil,hashlib
from macho import inspect
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--clang');p.add_argument('--linker');p.add_argument('--binary',help='Package an existing SDK-built executable');p.add_argument('--out',default=str(root/'dist'));args=p.parse_args()
out=pathlib.Path(args.out).resolve();work=out/'build';work.mkdir(parents=True,exist_ok=True)
app=out/'Payload/Sanyuan.app';app.mkdir(parents=True,exist_ok=True)
imports=[]
if args.binary:
    shutil.copy2(args.binary,app/'Sanyuan')
else:
    subprocess.run([args.clang,'-target','arm64-apple-ios15.0','-fobjc-arc','-fblocks','-Oz','-fno-ident','-c',str(root/'Sources/main.m'),'-o',str(work/'app.o')],check=True)
    imports=inspect((work/'app.o').read_bytes())['undefined'];groups={}
    for symbol in imports:
        if symbol.startswith('_CMTime'):provider='CoreMedia'
        elif symbol.startswith(('_SecItem','_kSec')):provider='Security'
        elif symbol.startswith('_objc_') or symbol.startswith(('__objc_','___objc_')) or symbol in ('_OBJC_CLASS_$_NSObject','_OBJC_METACLASS_$_NSObject'):provider='objc'
        elif symbol.startswith(('_OBJC_CLASS_$_UI','_OBJC_METACLASS_$_UI')) or symbol=='_UIApplicationMain':provider='UIKit'
        elif symbol.startswith('_OBJC_CLASS_$_WK'):provider='WebKit'
        elif symbol in ('_OBJC_CLASS_$_AVPlayerViewController','_OBJC_METACLASS_$_AVPlayerViewController'):provider='AVKit'
        elif symbol.startswith(('_OBJC_CLASS_$_AV','_AVAudioSession','_AVAudioTimePitch','_AVLayerVideoGravity','_AVMetadata')):provider='AVFoundation'
        elif symbol=='___CFConstantStringClassReference':provider='CoreFoundation'
        elif symbol.startswith('_OBJC_CLASS_$_NS') or symbol in ('_NSStringFromClass','___NSDictionary0__','___NSArray0__'):provider='Foundation'
        elif symbol.startswith(('__NSConcrete','__Block_','_dispatch_','__dispatch_','__Unwind_')) or symbol in ('___stack_chk_fail','___stack_chk_guard','_memcpy','_memset'):provider='System'
        else:raise RuntimeError('Unreviewed framework import: '+symbol)
        groups.setdefault(provider,[]).append(symbol)
    groups.setdefault('System',[]).append('dyld_stub_binder')
    for provider,symbols in groups.items():
        if provider in ('System','objc'):
            file=work/('lib'+provider+'.tbd');install='/usr/lib/'+('libSystem.B.dylib' if provider=='System' else 'libobjc.A.dylib')
        else:
            folder=work/(provider+'.framework');folder.mkdir(exist_ok=True);file=folder/(provider+'.tbd');install='/System/Library/Frameworks/'+provider+'.framework/'+provider
        file.write_text('--- !tapi-tbd\ntbd-version: 4\ntargets: [ arm64-ios ]\ninstall-name: '+json.dumps(install)+'\nexports:\n  - targets: [ arm64-ios ]\n    symbols: '+json.dumps(symbols)+'\n...\n')
    app=out/'Payload/Sanyuan.app';app.mkdir(parents=True,exist_ok=True)
    link=[args.linker,'-arch','arm64','-platform_version','ios','15.0','18.0','-e','_main','-pie','-dead_strip','-no_adhoc_codesign','-no_fixup_chains','-headerpad','0x1000','-L'+str(work),'-F'+str(work),str(work/'app.o'),'-o',str(app/'Sanyuan')]
    for provider in groups:
        link+=['-l'+provider] if provider in ('System','objc') else ['-framework',provider]
    subprocess.run(link,check=True);os.chmod(app/'Sanyuan',0o755)
info=dict(CFBundleName='三源影视',CFBundleDisplayName='三源影视',CFBundleIdentifier='com.joeshu.sanyuan',CFBundleExecutable='Sanyuan',CFBundlePackageType='APPL',CFBundleShortVersionString='0.2.14',CFBundleVersion='16',CFBundleSupportedPlatforms=['iPhoneOS'],MinimumOSVersion='15.0',UIDeviceFamily=[1,2],UIRequiredDeviceCapabilities=['arm64'],LSRequiresIPhoneOS=True,UILaunchScreen={},UIStatusBarStyle='UIStatusBarStyleDefault',UIViewControllerBasedStatusBarAppearance=True,UISupportedOrientations=['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'],ITSAppUsesNonExemptEncryption=False,NSAppTransportSecurity={'NSAllowsLocalNetworking':True},CFBundleIcons={'CFBundlePrimaryIcon':{'CFBundleIconFiles':['AppIcon60x60'],'UIPrerenderedIcon':False}})
info['UIBackgroundModes']=['audio']
info['UIApplicationSceneManifest']={'UIApplicationSupportsMultipleScenes':False,'UISceneConfigurations':{'UIWindowSceneSessionRoleApplication':[{'UISceneConfigurationName':'Default Configuration','UISceneDelegateClassName':'SYSceneDelegate'}]}}
info['CFBundleIcons~ipad']={'CFBundlePrimaryIcon':{'CFBundleIconFiles':['AppIcon76x76','AppIcon83.5x83.5']}}
with (app/'Info.plist').open('wb') as f:plistlib.dump(info,f)
(app/'PkgInfo').write_bytes(b'APPL????')
shutil.copytree(root/'Web',app/'Web',dirs_exist_ok=True)
for icon in (root/'Resources').glob('*.png') if (root/'Resources').exists() else []:shutil.copy2(icon,app/icon.name)
metadata=inspect((app/'Sanyuan').read_bytes())
assert metadata['cpu']==0x100000c and metadata['kind']==2 and metadata['platform'][0]==2 and not metadata['signed']
assert not (app/'embedded.mobileprovision').exists() and not (app/'_CodeSignature').exists()
ipa=out/'Sanyuan-0.2.14-unsigned.ipa'
with zipfile.ZipFile(ipa,'w',zipfile.ZIP_DEFLATED) as z:
    for f in sorted((out/'Payload').rglob('*')):
        if f.is_file():z.write(f,f.relative_to(out))
report={k:v for k,v in metadata.items() if k not in ('commands','undefined')};report.update(ipa=ipa.name,sha256=hashlib.sha256(ipa.read_bytes()).hexdigest(),bytes=ipa.stat().st_size,imports=len(imports),deviceLaunchTested=False,buildMethod='apple-sdk' if args.binary else 'experimental-llvm')
(out/'build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
