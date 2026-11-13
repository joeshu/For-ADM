import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = new URL('tests/fixtures/simulator-media/', root);

function videoStreamTypes(bytes) {
  const types = new Set();
  assert.equal(bytes.length % 188, 0, 'TS data must contain complete transport packets');
  for (let offset = 0; offset < bytes.length; offset += 188) {
    const packet = bytes.subarray(offset, offset + 188);
    assert.equal(packet[0], 0x47, 'every transport packet must retain its sync byte');
    const control = (packet[3] >> 4) & 3;
    if (!(packet[1] & 0x40) || !(control & 1)) continue;
    let at = 4;
    if (control & 2) at += packet[4] + 1;
    if (at >= 188) continue;
    at += packet[at] + 1; // PSI pointer field.
    if (packet[at] !== 2 || at + 12 > 188) continue; // PMT table.
    const end = at + 3 + (((packet[at + 1] & 15) << 8) | packet[at + 2]) - 4;
    let stream = at + 12 + (((packet[at + 10] & 15) << 8) | packet[at + 11]);
    while (stream + 5 <= Math.min(end, 188)) {
      types.add(packet[stream]);
      stream += 5 + (((packet[stream + 3] & 15) << 8) | packet[stream + 4]);
    }
  }
  return types;
}

test('the simulator fixture contains real H.264 video in every VOD segment', () => {
  const playlist = fs.readFileSync(new URL('video.m3u8', fixture), 'utf8');
  assert.match(playlist, /#EXT-X-PLAYLIST-TYPE:VOD/);
  assert.match(playlist, /#EXT-X-ENDLIST/);
  const duration = [...playlist.matchAll(/#EXTINF:([\d.]+)/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  assert.ok(duration >= 10 && duration <= 12.1, 'the fixture must allow playback progress without a long test');
  const segments = playlist.split('\n').filter(line => line && !line.startsWith('#'));
  assert.equal(segments.length, 3);
  for (const segment of segments) {
    assert.match(segment, /^segment-\d{2}\.ts$/);
    assert.ok(videoStreamTypes(fs.readFileSync(new URL(segment, fixture))).has(0x1b), `${segment} must declare an H.264 video stream, not audio-only media`);
  }
});

test('the smoke exercises loopback HLS and rendered video without a local-file bypass', () => {
  const main = read('Sources/main.m');
  const runner = read('tools/simulator-smoke.sh');
  assert.ok(main.includes('smokeConfig.protocolClasses=@[SYSmokeMediaProtocol.class]'));
  assert.ok(main.includes('https://smoke.invalid/video.m3u8'));
  assert.ok(!main.includes('smokeAudioFixtureURL') && !main.includes('sanyuan-smoke-silence.wav'));
  assert.ok(main.includes('[event[@"status"] isEqualToString:@"firstFrame"]&&self.nativeVideoReady'));
  assert.ok(main.includes('self.vodRendererLayer.readyForDisplay&&self.nativeItem.presentationSize.width>0&&self.nativeItem.presentationSize.height>0'));
  assert.ok(runner.includes('cp tests/fixtures/simulator-media/video.m3u8 tests/fixtures/simulator-media/segment-*.ts'));
  assert.ok(runner.includes('p["firstFrameReady"] and p["rendererReady"] and p["presentationWidth"]>0 and p["presentationHeight"]>0 and p["playbackTime"]>1'));
});
