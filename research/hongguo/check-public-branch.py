"""Exercise only reviewed public functions of the exact attached script.

Does not import the attachment, read App caches, start its server, or execute
its legacy API or protected-media processing. Transport uses configured curl.
"""
import ast
import hashlib
import contextlib
import io
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

source = Path(sys.argv[1]).read_bytes()
digest = hashlib.sha256(source).hexdigest()
if digest != '276f26c5e29706a113c9b3fb1f5788cb8b9720e6bbb9547faf63cd9c752ee788':
    raise SystemExit('Attachment differs from the statically reviewed version')
tree = ast.parse(source)
web_ua = ast.literal_eval(next(node.value for node in tree.body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'UA_WEB' for target in node.targets)))
selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in {'_clean', '_episodes', 'url_ok'}]
selected += [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == '_cli']
spider = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'Spider')
selected.append(ast.ClassDef(name='PublicSpider', bases=[], keywords=[], body=[node for node in spider.body if isinstance(node, ast.FunctionDef) and node.name == 'playerContent'], decorator_list=[]))
module = ast.fix_missing_locations(ast.Module(body=selected, type_ignores=[]))

class MemoryCache:
    def __init__(self):
        self.values = {}
    def get(self, key):
        return self.values.get(key)
    def put(self, key, value):
        self.values[key] = value

class PublicHTTP:
    def request(self, url, headers=None, timeout=15, **_):
        if not url.startswith('https://hongguoduanju.com/'):
            raise ValueError('Only the reviewed public website is permitted')
        args = ['curl', '--silent', '--show-error', '--location', '--fail', '--max-time', str(timeout), '--max-filesize', '4000000']
        defaults = {'User-Agent': web_ua, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Accept': 'text/html,application/xhtml+xml,*/*'}
        defaults.update(headers or {})
        for name, value in defaults.items():
            args += ['-H', str(name)+': '+str(value)]
        result = subprocess.run(args+[url], capture_output=True)
        if result.returncode:
            raise RuntimeError('Public HTTP request failed, curl code '+str(result.returncode))
        return result.stdout
    def get_text(self, url, **options):
        return self.request(url, **options).decode('utf-8')

namespace = {'__name__': '__public_branch_audit__', 're': re, '_TAG_RE': re.compile(r'<[^>]+>'), '_ENT': {'&amp;': '&', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>'}, '_EPNUM_RE': re.compile(r'第\s*(\d+)\s*集'), 'CACHE': MemoryCache(), 'H': PublicHTTP(), 'SITE': 'https://hongguoduanju.com', 'TIMEOUT': 15, 'log': lambda *args: None, 'hd_cached': lambda _: None, 'PRECHECK': True, 'TRY_LEGACY_API': False, 'PUBLIC_URL': 'https://hongguoduanju.com/video/public/%s/360p.mp4', 'UA_WEB': web_ua, 'time': time}
exec(compile(module, '<reviewed public functions only>', 'exec'), namespace)
catalogue = json.loads(Path(__file__).with_name('public-series-audit.json').read_text())
listed = namespace['_episodes'](catalogue['seriesId'])
known = {row['itemId'] for row in catalogue['episodes']}
sp = namespace['PublicSpider']()
checks = []
for row in catalogue['episodes']:
    if row['number'] not in {1, 4, 23, catalogue['catalogueEpisodeCount']}:
        continue
    result = sp.playerContent('', row['itemId'], [])
    checks.append({'number': row['number'], 'itemId': row['itemId'], 'publicURLReturned': bool(result.get('url')), 'message': result.get('msg', ''), 'completePlaybackVerified': False})
class EmptySpider:
    def init(self, *_): pass
    def homeContent(self, *_): return {'class': []}
    def homeVideoContent(self, *_): return {'list': []}
    def searchContent(self, *_): return {'list': []}

namespace['Spider'] = EmptySpider
with contextlib.redirect_stdout(io.StringIO()):
    empty_selftest_exit = namespace['_cli'](['hgtv_plain.py', 'selftest'])
report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'attachmentSHA256': digest, 'executedFunctions': ['_clean', '_episodes', 'url_ok', 'Spider.playerContent (public branch only)', '_cli selftest (empty stub results, no network)'], 'appCachesAccessed': False, 'legacyOrProtectedMediaProcessingExecuted': False, 'seriesId': catalogue['seriesId'], 'expectedCatalogueCount': len(known), 'scriptListedCount': len(listed), 'matchingCatalogueIDs': len(known & {vid for _, vid in listed}), 'checks': checks, 'emptyResultsSelftestExitCode': empty_selftest_exit, 'conclusion': 'A nonempty public URL is not evidence of complete episode playback.'}
output = Path(__file__).with_name('attachment-public-branch-audit.json')
output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
