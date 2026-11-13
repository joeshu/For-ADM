import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const run=promisify(execFile),sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const arm64=0x100000c,x86_64=0x1000007;
function macho(libraries=[],cpu=arm64,kind=2){
  const platform=Buffer.alloc(24);
  [0x32,24,2,15<<16,18<<16,0].forEach((value,index)=>platform.writeUInt32LE(value,index*4));
  const commands=[platform,...libraries.map(name=>{
    const text=Buffer.from(name+'\0'),length=Math.ceil((24+text.length)/8)*8,command=Buffer.alloc(length);
    [0xc,length,24,0,0,0].forEach((value,index)=>command.writeUInt32LE(value,index*4));
    text.copy(command,24);return command;
  })];
  const header=Buffer.alloc(32);
  [0xfeedfacf,cpu,0,kind,commands.length,commands.reduce((size,command)=>size+command.length,0),0,0]
    .forEach((value,index)=>header.writeUInt32LE(value,index*4));
  return Buffer.concat([header,...commands]);
}
function universal(armSlice){
  const intelSlice=macho(['@rpath/libswiftIntelOnly.dylib'],x86_64,6),header=Buffer.alloc(48);
  header.writeUInt32BE(0xcafebabe,0);header.writeUInt32BE(2,4);
  [x86_64,0,48,intelSlice.length,0,arm64,0,48+intelSlice.length,armSlice.length,0]
    .forEach((value,index)=>header.writeUInt32BE(value,8+index*4));
  return Buffer.concat([header,intelSlice,armSlice]);
}
async function fixture(t,libraries){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sanyuan-swift-runtime-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'tools'));
  for(const name of ['macho.py','cross-build.py','check-ipa.py'])
    await fs.copyFile(path.join(sourceRoot,'tools',name),path.join(root,'tools',name));
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({version:'1.0.0'}));
  await fs.mkdir(path.join(root,'Web/vendor'),{recursive:true});
  for(const name of ['index.html','app.js','app.css','hls-cleaner.js','vendor/crypto-js.js'])
    await fs.writeFile(path.join(root,'Web',name),'fixture resource '.repeat(20));
  await fs.writeFile(path.join(root,'Sanyuan'),macho(libraries));
  const support=path.join(root,'runtime');await fs.mkdir(support);
  return {
    root,support,ipa:path.join(root,'dist/Sanyuan-1.0.0-unsigned.ipa'),
    async library(name,libraries=[],fat=false){
      const bytes=macho(libraries,arm64,6);
      await fs.writeFile(path.join(support,name),fat?universal(bytes):bytes);
    },
    async framework(libraries){
      const dir=path.join(root,'Frameworks/Sample.framework');await fs.mkdir(dir,{recursive:true});
      await fs.writeFile(path.join(dir,'Sample'),macho(libraries,arm64,6));
    },
    async build(){
      const {stdout}=await run('python3',[path.join(root,'tools/cross-build.py'),'--binary',path.join(root,'Sanyuan'),'--swift-support',support],{env:{...process.env,SANYUAN_BUILD_NUMBER:'1'}});
      return JSON.parse(stdout);
    },
    async check(ipa=this.ipa){
      const {stdout}=await run('python3',[path.join(root,'tools/check-ipa.py'),ipa]);return JSON.parse(stdout);
    },
    async omit(member){
      const target=path.join(root,'incomplete.ipa');
      await run('python3',['-c','import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as src, zipfile.ZipFile(sys.argv[2],"w") as dst:\n for entry in src.infolist():\n  if entry.filename != sys.argv[3]: dst.writestr(entry,src.read(entry.filename))',this.ipa,target,member]);
      return target;
    },
  };
}

test('system Swift libraries do not require embedding or SwiftSupport',async t=>{
  const system=['/usr/lib/swift/libswiftCore.dylib','/usr/lib/swift/libswiftXPC.dylib'];
  const app=await fixture(t,system),built=await app.build(),checked=await app.check();
  for(const report of [built,checked]){
    assert.deepEqual(report.systemSwiftRuntimeDependencies,system);
    assert.deepEqual(report.embeddedSwiftRuntimeDependencies,[]);
    assert.equal(report.swiftRuntimeLibraries,0);
  }
});

test('a missing @rpath Swift library fails packaging',async t=>{
  const app=await fixture(t,['@rpath/libswiftFeature.dylib']);
  await assert.rejects(app.build(),error=>error.stderr.includes('App bundle is missing Swift runtime libraries: libswiftFeature.dylib'));
});

test('framework runtime closure is validated through the arm64 universal-library slice',async t=>{
  const app=await fixture(t,['/usr/lib/swift/libswiftCore.dylib']);
  await app.framework(['@rpath/libswiftFeature.dylib']);
  await app.library('libswiftFeature.dylib',['@rpath/libswiftDependency.dylib'],true);
  await app.library('libswiftDependency.dylib',['/usr/lib/swift/libswiftCore.dylib']);
  for(const report of [await app.build(),await app.check()])
    assert.deepEqual(report.embeddedSwiftRuntimeDependencies,['libswiftDependency.dylib','libswiftFeature.dylib']);
  const incomplete=await app.omit('Payload/Sanyuan.app/Frameworks/libswiftDependency.dylib');
  await assert.rejects(app.check(incomplete),error=>error.stderr.includes('App bundle is missing Swift runtime libraries: libswiftDependency.dylib'));
});

test('a missing transitive dependency fails before an IPA is produced',async t=>{
  const app=await fixture(t,[]);
  await app.framework(['@rpath/libswiftFeature.dylib']);
  await app.library('libswiftFeature.dylib',['@rpath/libswiftDependency.dylib']);
  await assert.rejects(app.build(),error=>error.stderr.includes('App bundle is missing Swift runtime libraries: libswiftDependency.dylib'));
  await assert.rejects(fs.access(app.ipa));
});

test('an embedded Swift library also requires its SwiftSupport counterpart',async t=>{
  const app=await fixture(t,['@rpath/libswiftFeature.dylib']);
  await app.library('libswiftFeature.dylib');await app.build();
  const incomplete=await app.omit('SwiftSupport/iphoneos/libswiftFeature.dylib');
  await assert.rejects(app.check(incomplete),error=>error.stderr.includes('SwiftSupport is missing Swift runtime libraries: libswiftFeature.dylib'));
});
