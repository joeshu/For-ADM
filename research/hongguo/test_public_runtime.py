import importlib.util
import io
import json
import struct
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request

spec = importlib.util.spec_from_file_location('hgtv_public_runtime_tested', Path(__file__).with_name('hgtv_public_optimized.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def page(loader):
    return ('<script>window._ROUTER_DATA = '+json.dumps({'loaderData': loader})+';</script>').encode()

def box(kind, body):
    return struct.pack('>I4s', len(body)+8, kind.encode())+body

def media(encrypted=False, duration=108.33):
    track = box('trak', box('mdia', box('minf', box('stbl', box('stsd', b'\0'*4+struct.pack('>I', 1)+box('encv' if encrypted else 'avc1', b'\0'*8))))))
    return box('ftyp', b'isom\0\0\0\0isom')+box('moov', box('mvhd', b'\0'*12+struct.pack('>II',1000,int(duration*1000)))+track)+box('mdat', b'payload encv is not a sample entry')

class Response:
    def __init__(self, body=b'', headers=None, status=200, url=None):
        self.body, self.pos, self.headers, self.status, self.url = body, 0, headers or {}, status, url
        self.closed, self.reads = False, 0
    def geturl(self): return self.url
    def getcode(self): return self.status
    def __enter__(self): return self
    def __exit__(self, *_): self.closed = True
    def read1(self, n):
        self.reads += 1
        result = self.body[self.pos:self.pos+n]
        self.pos += len(result)
        return result

class Opener:
    def __init__(self, values): self.values, self.requests = list(values), []
    def open(self, req, timeout=None):
        self.requests.append(req)
        value = self.values.pop(0)
        if isinstance(value, Exception): raise value
        value.url = value.url or req.full_url
        return value

def http(values):
    h = m.PublicHTTP()
    opener = Opener(values)
    h._opener = lambda: opener
    return h, opener

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        for target in ('urllib.request.OpenerDirector.open', 'socket.create_connection'):
            guard = patch(target, side_effect=AssertionError('network disabled'))
            guard.start()
            self.addCleanup(guard.stop)

    def test_page_requests_are_cached_and_parsed_once(self):
        html = page({'page': {'isSuccess': True, 'homeSections': []}})
        h, op = http([Response(html)])
        with patch.object(m, 'parse_router_data', wraps=m.parse_router_data) as parse:
            c = m.Catalog(h)
            for _ in range(8): self.assertEqual(c.home()['items'], [])
            self.assertEqual(parse.call_count, 1)
        self.assertEqual(len(op.requests), 1)

    def test_invalid_page_is_not_cached(self):
        h, op = http([Response(b'<html>maintenance</html>'), Response(page({'page':{'homeSections':[]}}))])
        with self.assertRaises(m.CatalogError): h.page('/')
        self.assertIn('_ROUTER_DATA', h.page('/'))
        self.assertEqual(len(op.requests), 2)

    def test_thread_local_opener_reuses_cookie_jar(self):
        h = m.PublicHTTP()
        first = h._opener()
        self.assertIs(first, h._opener())
        jar = next(handler.cookiejar for handler in first.handlers if hasattr(handler, 'cookiejar'))
        self.assertIsNotNone(jar)
        with ThreadPoolExecutor(max_workers=1) as pool:
            other = pool.submit(h._opener).result()
        self.assertIsNot(first, other)

    def test_ignored_range_is_rejected_before_read(self):
        response = Response(b'x'*1000000, status=200)
        h, _ = http([response])
        with self.assertRaises(m.SourceError): h.probe('https://v3-hgweb.qznovelvod.com/video/')
        self.assertEqual(response.reads, 0)
        self.assertTrue(response.closed)

    def test_oversize_response_is_rejected_and_closed(self):
        response = Response(b'x'*17)
        h, _ = http([response])
        with self.assertRaises(m.SourceError): h.request(m.ORIGIN+'/', limit=16)
        self.assertTrue(response.closed)

    def test_403_is_not_retried_but_503_can_recover(self):
        forbidden = HTTPError(m.ORIGIN+m.COMPAT_PATH,403,'denied',{},io.BytesIO())
        h, op = http([forbidden])
        with self.assertRaises(m.SourceError) as caught: h.compat('1','2')
        self.assertEqual(caught.exception.status,403)
        self.assertEqual(len(op.requests),1)
        retry = HTTPError(m.ORIGIN+'/',503,'down',{},io.BytesIO())
        h, op = http([retry,Response(b'ok')])
        with patch.object(m.time,'sleep'):
            self.assertEqual(h.request(m.ORIGIN+'/')[2],b'ok')
        self.assertEqual(len(op.requests),2)

    def test_redirect_rejects_destination_before_following(self):
        handler = m._CheckedRedirect(m.PublicHTTP()._check)
        with self.assertRaises(m.SourceError):
            handler.redirect_request(Request(m.ORIGIN+'/'),None,302,'',{},'https://untrusted.example/')
        with self.assertRaises(m.SourceError):
            handler.redirect_request(Request(m.ORIGIN+'/'),None,302,'',{},m.ORIGIN+'/api/video/protected/play-info')

    def test_probe_uses_playback_headers_and_validates_lengths(self):
        body = media()
        headers = {'Content-Range':'bytes 0-%d/1000'%(len(body)-1),'Content-Type':'video/mp4'}
        h, op = http([Response(body,headers,206)])
        info = h.probe('https://v3-hgweb.qznovelvod.com/video/',{'Referer':m.ORIGIN+'/player/1/2'})
        self.assertAlmostEqual(info['duration'],108.33)
        self.assertEqual(op.requests[0].get_header('Referer'),m.ORIGIN+'/player/1/2')
        h, _ = http([Response(body,dict(headers,**{'Content-Range':'bytes 0-999/1000'}),206)])
        with self.assertRaisesRegex(m.SourceError,'长度或范围'): h.probe('https://v3-hgweb.qznovelvod.com/video/')

    def test_encrypted_samples_are_rejected_and_payload_text_is_ignored(self):
        self.assertFalse(m.inspect_mp4(media())['encrypted'])
        body = media(True)
        h, _ = http([Response(body,{'Content-Range':'bytes 0-%d/1000'%(len(body)-1)},206)])
        with self.assertRaises(m.SourceError): h.probe('https://v3-hgweb.qznovelvod.com/video/')

    def test_invalid_input_does_not_reach_network(self):
        h, op = http([])
        sp = m.Spider(h)
        for call in [lambda:sp.detailContent([]), lambda:sp.categoryContent('real-drama','abc'), lambda:sp.playerContent('', 'not-an-id'), lambda:sp.searchContent('x',pg='no')]:
            result=call()
            self.assertTrue(result.get('msg'))
        self.assertEqual(op.requests,[])

    def test_public_transport_has_no_legacy_or_local_service_route(self):
        h, _ = http([])
        for url in ['http://127.0.0.1:8788/play/1',m.ORIGIN+'/api/video/protected/play-info','https://api5-normal-lq.fqnovel.com/novel/player/model','https://user:password@hongguoduanju.com/']:
            with self.assertRaises(m.SourceError):h.request(url)

    def test_cache_single_flight_and_no_failure_poisoning(self):
        cache=m.BoundedCache()
        entered, release = threading.Event(), threading.Event()
        count=[0]
        def load():
            count[0]+=1
            entered.set()
            release.wait(1)
            return {'value':1}
        with ThreadPoolExecutor(max_workers=8) as pool:
            jobs=[pool.submit(cache.load,'same',load) for _ in range(8)]
            self.assertTrue(entered.wait(1))
            deadline=time.monotonic()+1
            while cache.shared<7 and time.monotonic()<deadline: time.sleep(.001)
            release.set()
            self.assertTrue(all(job.result()=={'value':1} for job in jobs))
        self.assertEqual(count[0],1)
        with self.assertRaises(ValueError): cache.load('fail',lambda:(_ for _ in ()).throw(ValueError('temporary')))
        self.assertEqual(cache.load('fail',lambda:'recovered'),'recovered')

    def test_distinct_keys_can_load_concurrently(self):
        cache=m.BoundedCache()
        barrier=threading.Barrier(2)
        def load():barrier.wait(1);return 'ok'
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs=[pool.submit(cache.load,key,load) for key in ('a','b')]
            self.assertEqual([j.result() for j in jobs],['ok','ok'])

    def test_cache_expiry_and_size_bounds(self):
        now=[0.0]
        cache=m.BoundedCache(max_items=2,max_bytes=20,clock=lambda:now[0])
        self.assertEqual(cache.load('a',lambda:'one',ttl=1),'one')
        now[0]=2
        self.assertEqual(cache.load('a',lambda:'two',ttl=1),'two')
        for key in ('b','c','d'): cache.load(key,lambda:'small')
        self.assertLessEqual(len(cache.entries),2)
        self.assertLessEqual(cache.bytes,20)

    def test_aliases_supported_by_cache_validator(self):
        h,_=http([Response(page({'page':{'banner_list':[]}}))])
        self.assertEqual(m.Catalog(h).home()['items'],[])
        data={'series_id':'1','series_name':'test','videoList':['2'],'episode_cnt':1}
        h,_=http([Response(page({'detail_page':{'seriesDetail':data}}))])
        self.assertEqual(m.Catalog(h).detail('1')['episode_count'],1)

    def test_detail_sources_have_separate_episode_counts_and_escaped_labels(self):
        data={'series_id':'1','series_name':'test','vid_list':['2','3'],'episode_cnt':2}
        h,_=http([Response(page({'detail_page':{'seriesDetail':data}}))])
        result=m.Spider(h).detailContent(['1'])['list'][0]
        groups=result['vod_play_url'].split('$$$')
        self.assertEqual([len(group.split('#')) for group in groups],[2,2])
        self.assertFalse(result['playback_verified'])
        self.assertNotIn('$',m._label('a$b#c'))

    def test_expired_compat_url_is_not_returned(self):
        payload={'main_url':'https://v3-hgweb.qznovelvod.com/video/','url_expire':time.time()-1,'base_resp':{'StatusCode':0}}
        h,_=http([Response(json.dumps(payload).encode())])
        with self.assertRaisesRegex(m.SourceError,'过期'): h.compat('1','2')

    def test_player_headers_expiry_cache_and_explicit_preview(self):
        class PlaybackHTTP:
            def __init__(self):
                self.now = 0
                self.cache = m.BoundedCache(clock=lambda:self.now)
                self.calls = 0
                self.probes = []
            def page(self, path): raise AssertionError('not needed')
            def compat(self, sid, vid):
                self.calls += 1
                if vid == '4': raise m.SourceError('not provided',403)
                return 'https://v3-hgweb.qznovelvod.com/video/',m.ORIGIN+'/player/'+sid+'/'+vid,105
            def probe(self, url, headers):
                self.probes.append((url,dict(headers)))
                return {'duration':10.08 if '/video/public/' in url else 108.33}
        h=PlaybackHTTP();sp=m.Spider(h)
        with patch.object(m.time,'time',return_value=100):
            first=sp.playerContent('full','1~2')
            self.assertTrue(first['url']);self.assertFalse(first['preview'])
            first['header']['Referer']='changed'
            again=sp.playerContent('full','1~2')
            self.assertEqual(h.calls,1)
            self.assertEqual(again['header']['Referer'],m.ORIGIN+'/player/1/2')
            self.assertEqual(h.probes[0][1]['Referer'],again['header']['Referer'])
            h.now=4
            sp.playerContent('full','1~2')
            self.assertEqual(h.calls,2,'cache must expire before the media URL')
            denied=sp.playerContent('full','1~4')
            self.assertFalse(denied['url'])
            self.assertEqual(len(h.probes),2,'a denial must not silently resolve a preview')
            preview=sp.playerContent('公开试看','1~2')
            self.assertTrue(preview['preview']);self.assertEqual(preview['duration'],10.08)
            self.assertFalse(preview['playback_verified'])

    def test_probe_cannot_return_a_url_that_expired_while_reading(self):
        now=[100.0]
        class SlowProbeHTTP:
            cache=m.BoundedCache()
            def page(self,path):raise AssertionError('not needed')
            def compat(self,sid,vid):return 'https://v3-hgweb.qznovelvod.com/video/',m.ORIGIN+'/',105.0
            def probe(self,url,headers):now[0]=106.0;return {'duration':108.33}
        with patch.object(m.time,'time',side_effect=lambda:now[0]):
            result=m.Spider(SlowProbeHTTP()).playerContent('full','1~2')
        self.assertFalse(result['url']);self.assertIn('过期',result['msg'])

    def test_search_warming_is_per_catalogue_instance(self):
        class WarmHTTP:
            def __init__(self):self.cache=m.BoundedCache()
            def page(self, path):raise AssertionError('mock catalogue only')
        h=WarmHTTP();a,b=m.Spider(h),m.Spider(h)
        for sp in (a,b):
            sp.catalog.home=lambda:{'items':[]}
            sp.catalog.category=lambda *args:{'items':[]}
        with patch.object(a.catalog,'home',wraps=a.catalog.home) as one,patch.object(b.catalog,'home',wraps=b.catalog.home) as two:
            a._warm_search();a._warm_search();b._warm_search()
            self.assertEqual(one.call_count,1);self.assertEqual(two.call_count,1)

    def test_all_episode_selftest_checks_each_id_once_and_reports_denial(self):
        class Fake:
            def __init__(self):self.catalog=self;self.ids=[]
            def detail(self,sid):return {'id':sid,'episodes':[{'id':'2','number':1},{'id':'3','number':2}],'episode_count':2,'catalog_complete':True}
            def playerContent(self,flag,eid):
                self.ids.append(eid)
                return {'url':'https://example.invalid/' if eid.endswith('~2') else '', 'msg':'checked','status':200 if eid.endswith('~2') else 403}
        fake=Fake();out=io.StringIO()
        with patch.object(m,'Spider',return_value=fake),patch('sys.stdout',new=out):
            self.assertEqual(m._cli(['selftest','--series','1','--all']),1)
        self.assertEqual(sorted(fake.ids),['1~2','1~3'])
        report=json.loads(out.getvalue());self.assertEqual(report['checked_count'],2)
        self.assertFalse(report['all_episodes_playback_verified'])

    def test_selftest_fails_with_empty_or_failed_data(self):
        fake=m.Spider(http([])[0])
        with patch.object(m,'Spider',return_value=fake), patch('sys.stdout',new=io.StringIO()):
            self.assertEqual(m._cli(['selftest']),1)

if __name__=='__main__':unittest.main()
