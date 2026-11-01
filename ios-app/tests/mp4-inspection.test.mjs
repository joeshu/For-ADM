import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMP4Init} from '../Web/mp4-inspection.mjs';
import {mp4Init} from './fixtures/mp4-init.mjs';

test('ISO BMFF inspection recognizes a clear muxed MP4 and ignores payload bytes that resemble protection markers',()=>{
 const info=inspectMP4Init(mp4Init({payload:'encv enca sinf tenc'}).toString('binary'));
 assert.deepEqual(info,{mp4:true,moov:true,tracks:['avc1','mp4a'],encrypted:false});
});
test('ISO BMFF inspection detects encrypted video or audio sample entries before native playback',()=>{
 assert.equal(inspectMP4Init(mp4Init({video:'encv'}).toString('binary')).encrypted,true);
 assert.equal(inspectMP4Init(mp4Init({audio:'enca'}).toString('binary')).encrypted,true);
});
test('ISO BMFF inspection bounds truncated and malformed metadata instead of reading sample tables',()=>{
 assert.equal(inspectMP4Init('<html>unavailable</html>').mp4,false);
 assert.equal(inspectMP4Init('\0\0\0\x01ftyp').mp4,false);
 assert.throws(()=>inspectMP4Init('x'.repeat(65537)),/size/);
 const truncated=mp4Init({video:'encv'}).subarray(0,95);
 assert.equal(inspectMP4Init(truncated.toString('binary')).encrypted,true);
});
