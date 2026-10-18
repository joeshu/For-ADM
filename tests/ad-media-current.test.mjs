import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readJSON, runCleaner, fixtureChecks} from '../scripts/lib/ad-sites.mjs';
import {auditModule} from '../scripts/audit-media-sites.mjs';

const root = new URL('../', import.meta.url);
const manifest = readJSON(new URL('universal/templates.json', root));
const sources = readJSON(new URL('./media-current-sources.json', import.meta.url));

for (const id of ['kkapp', 'ncat', 'happ']) {
  const template = manifest.templates.find(t => t.id === id);
  const code = fs.readFileSync(new URL(id + '/ad-clean.js', root), 'utf8');
  const items = sources.filter(i => i.template === id);

  test(id + ' current HTML refreshes both app builds and preserves the page shell', () => {
    const html = readJSON(new URL('universal/fixtures/' + id + '-current-html.json', root));
    const output = fixtureChecks(code, html);
    const revision = output.match(/for_adm=([^"&]+)/)[1];
    for (const info of items.filter(i => i.file.startsWith('app'))) {
      const fixture = readJSON(new URL('universal/fixtures/' + info.fixture, root));
      assert.ok(runCleaner(code, fixture.url, fixture.body).includes('for_adm=' + revision));
    }
  });

  test(id + ' current modern/legacy modules remove ads and retain protected content', () => {
    assert.equal(new Set(items.map(i => i.file)).size, 74);
    for (const info of items) {
      const fixture = readJSON(new URL('universal/fixtures/' + info.fixture, root));
      fixtureChecks(code, fixture);
      const action = template.actions[info.action];
      assert.equal(auditModule(fixture.body, [[info.action, action]]).status, 'PASS');
      // Missing/duplicated source must preserve the whole group, including the helper.
      const old = action.pairs[0][0];
      for (const body of [fixture.body.replace(old, 'changed-source'), fixture.body + '\n' + old]) {
        assert.equal(auditModule(body, [[info.action, action]]).status, 'CHANGED');
        assert.equal(runCleaner(code, fixture.url, body), body);
      }
      assert.equal(runCleaner(code, fixture.url.replace(/\.[a-f0-9]{8}\.js$/, '.ffffffff.js'), fixture.body), fixture.body);
    }
  });

  test(id + ' current core getters reject cached ads without changing account data', () => {
    const pairs = items.flatMap(i => template.actions[i.action].pairs);
    const getters = pairs.filter(([old]) => old.startsWith("'getAdvertiseById'"));
    assert.equal(getters.length, 2);
    for (const [, replacement] of getters) {
      const context = vm.createContext({});
      vm.runInContext('var holder={' + replacement + '};', context);
      context.holder.appAdvertisements = [{id: 'ad', items: [{url: 'promo'}]}];
      context.holder.user = {id: 'keep'};
      assert.equal(context.holder.getAdvertiseById('ad'), undefined);
      assert.equal(context.holder.user.id, 'keep');
    }
  });
}
