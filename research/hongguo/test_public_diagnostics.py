"""Offline diagnostics contracts for a host that may only display msg/stderr."""
import io
import json
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import redirect_stderr
from unittest.mock import patch
from urllib.error import HTTPError

from test_public_runtime import m, http


SID, VID = '7690961604636052505', '7690963410778868761'
SECRET_URL = 'https://v3-hgweb.qznovelvod.com/video/?token=NEVER_LOG_TOKEN&signature=NEVER_LOG_SIGNATURE'
TRACE_FIELDS = {'event', 'source_version', 'series_id', 'episode_id', 'preview',
                'elapsed_ms', 'status', 'failure_stage', 'error_code', 'retryable'}


class PlaybackHTTP:
    def __init__(self, probe_error=None, api_error=None):
        self.cache = m.BoundedCache()
        self.probe_error, self.api_error = probe_error, api_error
        self.api_calls = self.probe_calls = 0

    def page(self, path):
        raise AssertionError('diagnostics checks must not load the catalogue')

    def compat(self, sid, vid):
        self.api_calls += 1
        if self.api_error is not None:
            raise self.api_error
        return SECRET_URL, m.ORIGIN + '/player/' + sid + '/' + vid, time.time() + 3600

    def probe(self, url, headers=None):
        self.probe_calls += 1
        if self.probe_error is not None:
            raise self.probe_error
        return {'duration': 108.331, 'initialization_complete': True,
                'has_video': True, 'video_codecs': ['avc1'],
                'video_dimensions': [{'width': 360, 'height': 640}]}


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        for target in ('urllib.request.OpenerDirector.open', 'socket.create_connection'):
            guard = patch(target, side_effect=AssertionError('network disabled'))
            guard.start()
            self.addCleanup(guard.stop)

    def traces(self, stream):
        lines = stream.getvalue().splitlines()
        self.assertTrue(lines, 'expected bounded JSON diagnostic events')
        rows = []
        for line in lines:
            self.assertTrue(line.startswith('[HGTV] '), line)
            row = json.loads(line[len('[HGTV] '):])
            self.assertLessEqual(set(row), TRACE_FIELDS)
            self.assertEqual(row['source_version'], m.VERSION)
            rows.append(row)
        return rows

    def assert_identity(self, result):
        self.assertEqual(result['source_version'], m.VERSION)
        self.assertEqual(result['series_id'], SID)
        self.assertEqual(result['episode_id'], VID)

    def test_http_403_and_404_are_distinct_and_reach_host_message(self):
        for status, code in ((403, 'provider_http_forbidden'), (404, 'provider_http_not_found')):
            with self.subTest(status=status):
                error = HTTPError(m.ORIGIN + m.COMPAT_PATH, status, 'denied', {}, io.BytesIO(b''))
                transport, opener = http([error])
                stream = io.StringIO()
                with redirect_stderr(stream):
                    spider = m.Spider(transport)
                    spider.init('')
                    result = spider.playerContent('full', SID + '~' + VID)
                self.assert_identity(result)
                self.assertFalse(result['url'])
                self.assertEqual(result['status'], status)
                self.assertEqual(result['failure_stage'], 'resolve_api')
                self.assertEqual(result['error_code'], code)
                self.assertIs(result['retryable'], False)
                for text in (m.VERSION, 'resolve_api', VID, str(status)):
                    self.assertIn(text, result['msg'])
                self.assertEqual(len(opener.requests), 1, 'provider denial must not be retried')
                rows = self.traces(stream)
                failed = next(row for row in rows if row['event'] == 'hgtv_play_failed')
                self.assertEqual(failed['status'], status)
                self.assertEqual(failed['failure_stage'], 'resolve_api')
                self.assertEqual(failed['error_code'], code)
                self.assertEqual(failed['episode_id'], VID)

    def test_media_error_keeps_media_stage_instead_of_provider_denial(self):
        transport = PlaybackHTTP(probe_error=m.SourceError('media range unavailable', 404))
        stream = io.StringIO()
        with redirect_stderr(stream):
            result = m.Spider(transport).playerContent('full', SID + '~' + VID)
        self.assert_identity(result)
        self.assertFalse(result['url'])
        self.assertEqual(result['status'], 404)
        self.assertEqual(result['failure_stage'], 'media_probe')
        self.assertNotEqual(result['error_code'], 'provider_http_not_found')
        self.assertIn('media_probe', result['msg'])
        self.assertEqual(transport.api_calls, 1)
        self.assertEqual(transport.probe_calls, 1)
        failed = next(row for row in self.traces(stream) if row['event'] == 'hgtv_play_failed')
        self.assertEqual(failed['failure_stage'], 'media_probe')
        self.assertEqual(failed['status'], 404)

    def test_success_returns_metadata_and_safe_init_start_success_events(self):
        transport, stream = PlaybackHTTP(), io.StringIO()
        with redirect_stderr(stream):
            spider = m.Spider(transport)
            spider.init('')
            result = spider.playerContent('full', SID + '~' + VID)
        self.assert_identity(result)
        self.assertEqual(result['url'], SECRET_URL)
        self.assertEqual(result['failure_stage'], '')
        self.assertEqual(result['error_code'], '')
        self.assertIs(result['retryable'], False)
        self.assertEqual(result['format'], 'video/mp4')
        self.assertTrue(result['initialization_complete'])
        rows = self.traces(stream)
        events = [row['event'] for row in rows]
        for event in ('hgtv_init', 'hgtv_play_start', 'hgtv_play_success'):
            self.assertIn(event, events)
        success = next(row for row in rows if row['event'] == 'hgtv_play_success')
        self.assertEqual(success['status'], 200)
        self.assertEqual(success['series_id'], SID)
        self.assertEqual(success['episode_id'], VID)
        self.assertEqual(success['failure_stage'], '')
        self.assertEqual(success['error_code'], '')
        self.assertIs(success['retryable'], False)
        self.assertNotIn('https://', stream.getvalue())
        self.assertNotIn('NEVER_LOG_', stream.getvalue())

    def test_error_trace_does_not_echo_message_url_headers_or_tokens(self):
        error = m.SourceError('upstream ' + SECRET_URL + ' Cookie: NEVER_LOG_COOKIE', 503,
                              stage='resolve_api', code='provider_unavailable', retryable=True)
        transport, stream = PlaybackHTTP(api_error=error), io.StringIO()
        with redirect_stderr(stream):
            result = m.Spider(transport).playerContent('full', SID + '~' + VID)
        self.assertEqual(result['failure_stage'], 'resolve_api')
        self.assertEqual(result['error_code'], 'provider_unavailable')
        self.assertIs(result['retryable'], True)
        rows = self.traces(stream)
        failed = next(row for row in rows if row['event'] == 'hgtv_play_failed')
        self.assertEqual(failed['status'], 503)
        self.assertEqual(failed['series_id'], SID)
        self.assertEqual(failed['episode_id'], VID)
        for text in ('https://', 'NEVER_LOG_', 'Cookie', 'User-Agent', 'Referer'):
            self.assertNotIn(text, stream.getvalue())
        for text in ('https://', 'NEVER_LOG_', 'Cookie'):
            self.assertNotIn(text, result['msg'])

    def test_invalid_identifier_is_not_echoed_into_safe_id_fields(self):
        transport, stream = PlaybackHTTP(), io.StringIO()
        with redirect_stderr(stream):
            result = m.Spider(transport).playerContent('full', SECRET_URL)
        self.assertFalse(result['url'])
        self.assertEqual(transport.api_calls, 0)
        self.assertEqual(transport.probe_calls, 0)
        self.traces(stream)
        self.assertNotIn('https://', stream.getvalue())
        self.assertNotIn('NEVER_LOG_', stream.getvalue())

    def test_cache_waiter_preserves_failure_metadata(self):
        cache, entered, release = m.BoundedCache(), threading.Event(), threading.Event()
        error = m.SourceError('provider unavailable', 503, stage='resolve_api',
                              code='provider_unavailable', retryable=True)

        def loader():
            entered.set()
            if not release.wait(2):
                raise AssertionError('test loader was not released')
            raise error

        with ThreadPoolExecutor(max_workers=2) as pool:
            owner = pool.submit(cache.load, 'same', loader)
            self.assertTrue(entered.wait(1))
            waiter = pool.submit(cache.load, 'same', loader)
            until = time.monotonic() + 1
            while cache.shared < 1 and time.monotonic() < until:
                time.sleep(.001)
            try:
                self.assertEqual(cache.shared, 1)
            finally:
                release.set()
            for future in (owner, waiter):
                with self.assertRaises(m.SourceError) as caught:
                    future.result(timeout=1)
                self.assertEqual(caught.exception.status, 503)
                self.assertEqual(caught.exception.stage, 'resolve_api')
                self.assertEqual(caught.exception.code, 'provider_unavailable')
                self.assertIs(caught.exception.retryable, True)

    def test_transient_media_probe_returns_api_url_without_claiming_or_caching_initialization(self):
        error = m.SourceError('CDN temporarily unavailable', 503,
                              stage='media_probe', code='http_error', retryable=True)
        transport, stream = PlaybackHTTP(probe_error=error), io.StringIO()
        with redirect_stderr(stream):
            spider = m.Spider(transport)
            first = spider.playerContent('full', SID + '~' + VID)
            second = spider.playerContent('full', SID + '~' + VID)
        for result in (first, second):
            self.assert_identity(result)
            self.assertEqual(result['url'], SECRET_URL)
            self.assertEqual(result['header']['Referer'], m.ORIGIN + '/player/' + SID + '/' + VID)
            self.assertEqual(result['header']['User-Agent'], m.UA_WEB)
            self.assertEqual(result['header']['Accept-Encoding'], 'identity')
            self.assertIs(result['initialization_complete'], False)
            self.assertIs(result['playback_verified'], False)
            self.assertFalse(result['preview'])
            self.assertEqual(result['verification'], 'compatibility-api-only')
            self.assertTrue(result['preflight_warning'])
            self.assertEqual(result['preflight_code'], 'http_error')
            self.assertEqual(result['preflight_status'], 503)
            self.assertEqual(result['preflight_failure_stage'], 'media_probe')
        self.assertEqual(transport.api_calls, 2, 'unverified API addresses must not be cached')
        self.assertEqual(transport.probe_calls, 2, 'the next call must attempt the media check again')
        self.traces(stream)
        self.assertNotIn('NEVER_LOG_', stream.getvalue())

    def test_media_denials_invalid_initialization_and_preview_stay_failures(self):
        cases = [
            ('full', m.SourceError('media forbidden', 403, code='http_error', retryable=True)),
            ('full', m.SourceError('media missing', 404, code='http_error', retryable=True)),
            ('full', m.SourceError('MP4 has no nonzero video dimensions; audio only')),
            ('full', m.SourceError('MP4 contains encrypted samples')),
            ('full', m.SourceError('MP4 initialization is incomplete or truncated')),
            ('full', m.SourceError('MP4 has invalid box structure')),
            ('full', m.SourceError('unclassified permanent probe failure', 503)),
            ('preview', m.SourceError('preview CDN unavailable', 503, code='http_error', retryable=True)),
        ]
        for flag, error in cases:
            with self.subTest(flag=flag, error=str(error), status=error.status):
                transport, stream = PlaybackHTTP(probe_error=error), io.StringIO()
                with redirect_stderr(stream):
                    result = m.Spider(transport).playerContent(flag, SID + '~' + VID)
                self.assertFalse(result['url'])
                self.assertEqual(result['failure_stage'], 'media_probe')
                self.assertNotEqual(result.get('verification'), 'compatibility-api-only')
                self.assertEqual(transport.api_calls, 0 if flag == 'preview' else 1)
                self.assertEqual(transport.probe_calls, 1)

    def test_transient_api_failure_never_returns_address_or_tries_preview(self):
        error = m.SourceError('compatibility API unavailable', 503,
                              code='http_error', retryable=True)
        transport, stream = PlaybackHTTP(api_error=error), io.StringIO()
        with redirect_stderr(stream):
            result = m.Spider(transport).playerContent('full', SID + '~' + VID)
        self.assert_identity(result)
        self.assertFalse(result['url'])
        self.assertFalse(result['preview'])
        self.assertEqual(result['failure_stage'], 'resolve_api')
        self.assertEqual(result['status'], 503)
        self.assertEqual(result['error_code'], 'http_error')
        self.assertNotEqual(result.get('verification'), 'compatibility-api-only')
        self.assertEqual(transport.api_calls, 1)
        self.assertEqual(transport.probe_calls, 0, 'API failure must not try a guessed preview URL')

    def test_selftest_requires_verified_initialization_even_when_api_returned_url(self):
        class FakeSpider:
            def __init__(self, complete):
                self.catalog, self.complete, self.calls = self, complete, []

            def detail(self, sid):
                return {'id': sid, 'episodes': [{'id': VID, 'number': 1}],
                        'episode_count': 1, 'catalog_complete': True}

            def playerContent(self, flag, episode):
                self.calls.append((flag, episode))
                return {'url': SECRET_URL, 'initialization_complete': self.complete,
                        'verification': 'mp4-video-initialization-only' if self.complete else 'compatibility-api-only',
                        'status': 200, 'msg': 'fixture'}

        for complete, expected_exit in ((False, 1), (True, 0)):
            with self.subTest(initialization_complete=complete):
                fake, output = FakeSpider(complete), io.StringIO()
                with patch.object(m, 'Spider', return_value=fake), patch('sys.stdout', new=output):
                    code = m._cli(['selftest', '--series', SID])
                self.assertEqual(code, expected_exit)
                self.assertEqual(fake.calls, [('full', SID + '~' + VID)])
                report = json.loads(output.getvalue())
                self.assertTrue(report['episodes'][0]['available'])
                self.assertEqual(report['episodes'][0]['initialization_complete'], complete)
                self.assertFalse(report['full_playback_verified'])


if __name__ == '__main__':
    unittest.main()
