#!/usr/bin/env python3
"""Package an unsigned arm64 iOS application built with Apple's iPhoneOS SDK."""
import argparse,os,pathlib,json,plistlib,zipfile,shutil,hashlib
from macho import inspect, validate_swift_runtime
root=pathlib.Path(__file__).resolve().parents[1]
# Marketing version comes from package.json (single source of truth); the IPA
# filename and CFBundleShortVersionString derive from it. CFBundleVersion is a
# monotonically increasing build counter: CI sets SANYUAN_BUILD_NUMBER to the
# workflow run number (133 at 2d8c7b7, well past the old manual counter 61);
# local builds without it keep '61'.
version=json.loads((root/'package.json').read_text())['version']
build_number=os.environ.get('SANYUAN_BUILD_NUMBER','61')
if not build_number.isdigit() or int(build_number)<=0:raise ValueError('SANYUAN_BUILD_NUMBER must be a positive integer, got '+repr(build_number))
p=argparse.ArgumentParser();p.add_argument('--binary',required=True,help='Package an executable built with the iPhoneOS SDK');p.add_argument('--swift-support',required=True,help='Directory of Swift runtime libraries produced by swift-stdlib-tool');p.add_argument('--out',default=str(root/'dist'));args=p.parse_args()
out=pathlib.Path(args.out).resolve();work=out/'build';work.mkdir(parents=True,exist_ok=True)
for stale in (out/'Payload',out/'SwiftSupport'):
    if stale.exists():shutil.rmtree(stale)
app=out/'Payload/Sanyuan.app';app.mkdir(parents=True,exist_ok=True)
shutil.copy2(args.binary,app/'Sanyuan')
os.chmod(app/'Sanyuan',0o755)
metadata=inspect((app/'Sanyuan').read_bytes())
info=dict(CFBundleName='三源影视',CFBundleDisplayName='三源影视',CFBundleIdentifier='com.joeshu.sanyuan',CFBundleExecutable='Sanyuan',CFBundlePackageType='APPL',CFBundleShortVersionString=version,CFBundleVersion=build_number,CFBundleSupportedPlatforms=['iPhoneOS'],MinimumOSVersion='15.0',UIDeviceFamily=[1,2],UIRequiredDeviceCapabilities=['arm64'],LSRequiresIPhoneOS=True,UILaunchScreen={},UIStatusBarStyle='UIStatusBarStyleDefault',UIViewControllerBasedStatusBarAppearance=True,UISupportedOrientations=['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'],ITSAppUsesNonExemptEncryption=False,NSAppTransportSecurity={'NSAllowsArbitraryLoads':True},CFBundleIcons={'CFBundlePrimaryIcon':{'CFBundleIconFiles':['AppIcon60x60'],'UIPrerenderedIcon':False}})
info['UIBackgroundModes']=['audio']
info['UIApplicationSceneManifest']={'UIApplicationSupportsMultipleScenes':False,'UISceneConfigurations':{'UIWindowSceneSessionRoleApplication':[{'UISceneConfigurationName':'Default Configuration','UISceneDelegateClassName':'SYSceneDelegate'}]}}
info['CFBundleIcons~ipad']={'CFBundlePrimaryIcon':{'CFBundleIconFiles':['AppIcon76x76','AppIcon83.5x83.5']}}
info['LSApplicationQueriesSchemes']=['vlc-x-callback']
with (app/'Info.plist').open('wb') as f:plistlib.dump(info,f)
(app/'PkgInfo').write_bytes(b'APPL????')
shutil.copytree(root/'Web',app/'Web',dirs_exist_ok=True)
for license_file in (root/'Resources').glob('*.txt'):shutil.copy2(license_file,app/license_file.name)
for icon in (root/'Resources').glob('*.png') if (root/'Resources').exists() else []:shutil.copy2(icon,app/icon.name)
# Embed bundled device frameworks (CicadaPlayerSDK + alivcffmpeg, arm64 thin)
# into the app bundle so the @rpath-linked main binary finds them at runtime.
# Skipped when ios-app/Frameworks/ is absent (--binary may be reused elsewhere).
frameworks_dir=root/'Frameworks'
if frameworks_dir.is_dir():
    app_frameworks=app/'Frameworks';app_frameworks.mkdir(exist_ok=True)
    for framework in sorted(frameworks_dir.glob('*.framework')):
        shutil.copytree(framework,app_frameworks/framework.name,dirs_exist_ok=True)
if args.swift_support:
    swift_support=pathlib.Path(args.swift_support).resolve()
    dylibs=sorted(swift_support.rglob('libswift*.dylib'))
    app_frameworks=app/'Frameworks';app_frameworks.mkdir(exist_ok=True)
    swift_support_ipa=out/'SwiftSupport/iphoneos';swift_support_ipa.mkdir(parents=True,exist_ok=True)
    for dylib in dylibs:
        shutil.copy2(dylib,app_frameworks/dylib.name)
        shutil.copy2(dylib,swift_support_ipa/dylib.name)
bundled_binaries=[('Sanyuan',(app/'Sanyuan').read_bytes())]
bundled_binaries.extend((str(path.relative_to(app)),path.read_bytes()) for path in sorted((app/'Frameworks').rglob('*')) if path.is_file())
swift_report=validate_swift_runtime(bundled_binaries,
    {path.name for path in (app/'Frameworks').glob('libswift*.dylib')},
    {path.name for path in (out/'SwiftSupport/iphoneos').glob('libswift*.dylib')})
assert metadata['cpu']==0x100000c and metadata['kind']==2 and metadata['platform'][0]==2 and not metadata['signed']
assert not (app/'embedded.mobileprovision').exists() and not (app/'_CodeSignature').exists()
ipa=out/f'Sanyuan-{version}-unsigned.ipa'
with zipfile.ZipFile(ipa,'w',zipfile.ZIP_DEFLATED) as z:
    for bundle_root in (out/'Payload',out/'SwiftSupport'):
        if not bundle_root.is_dir():continue
        for f in sorted(bundle_root.rglob('*')):
            if f.is_file():z.write(f,f.relative_to(out))
report={k:v for k,v in metadata.items() if k not in ('commands','undefined')};report.update(ipa=ipa.name,sha256=hashlib.sha256(ipa.read_bytes()).hexdigest(),bytes=ipa.stat().st_size,deviceLaunchTested=False,buildMethod='apple-sdk',**swift_report)
(out/'build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
