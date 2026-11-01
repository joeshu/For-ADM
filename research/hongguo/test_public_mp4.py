"""Bounded MP4 initialization checks. All transport responses are fixtures."""
import struct
import io
import unittest
from unittest.mock import patch

from test_public_runtime import m, media, box, Response


def parts(data):
    result, at = [], 0
    while at < len(data):
        size, kind = struct.unpack_from('>I4s', data, at)
        result.append((kind, data[at:at + size]))
        at += size
    return dict(result)


class RangeOpener:
    def __init__(self, data, changed_total=False):
        self.data, self.changed_total = data, changed_total
        self.requests, self.transferred = [], 0

    def open(self, request, timeout=None):
        self.requests.append(request)
        requested = request.get_header('Range')
        start, end = map(int, requested[6:].split('-'))
        end = min(end, len(self.data) - 1)
        data = self.data[start:end + 1]
        total = len(self.data) + int(self.changed_total and len(self.requests) > 1)
        self.transferred += len(data)
        return Response(data, {'Content-Type': 'video/mp4', 'Content-Range': 'bytes %d-%d/%d' % (start, end, total)}, 206, request.full_url)


class MP4Tests(unittest.TestCase):
    def setUp(self):
        for target in ('urllib.request.OpenerDirector.open', 'socket.create_connection'):
            guard = patch(target, side_effect=AssertionError('network disabled'))
            guard.start()
            self.addCleanup(guard.stop)

    def probe(self, data, changed_total=False):
        transport, opener = m.PublicHTTP(), RangeOpener(data, changed_total)
        transport._opener = lambda: opener
        return transport, opener

    def test_valid_video_reports_complete_metadata_and_codec(self):
        transport, opener = self.probe(media())
        info = transport.probe('https://v3-hgweb.qznovelvod.com/video/')
        self.assertTrue(info['initialization_complete'])
        self.assertTrue(info['has_video'])
        self.assertIn('avc1', info['video_codecs'])
        self.assertEqual(len(opener.requests), 1)

    def test_audio_only_is_not_accepted_as_visible_video(self):
        transport, _ = self.probe(media(video=False))
        with self.assertRaises(m.SourceError):
            transport.probe('https://v3-hgweb.qznovelvod.com/video/')

    def test_ftyp_only_and_truncated_metadata_are_not_accepted(self):
        p = parts(media())
        for data in (p[b'ftyp'], p[b'ftyp'] + p[b'moov'][:-7]):
            with self.subTest(length=len(data)):
                transport, _ = self.probe(data)
                with self.assertRaises(m.SourceError):
                    transport.probe('https://v3-hgweb.qznovelvod.com/video/')

    def test_zero_video_dimensions_are_rejected(self):
        for width, height in ((0, 640), (360, 0)):
            transport, _ = self.probe(media(width=width, height=height))
            with self.assertRaises(m.SourceError):
                transport.probe('https://v3-hgweb.qznovelvod.com/video/')

    def test_audio_sample_mislabeled_as_video_is_rejected(self):
        transport, _ = self.probe(media().replace(b'avc1', b'mp4a', 1))
        with self.assertRaises(m.SourceError):
            transport.probe('https://v3-hgweb.qznovelvod.com/video/')

    def test_range_read_closes_at_byte_budget_without_extra_read(self):
        response = Response(b'x' * 11, status=206)
        class Opener:
            def open(self, request, timeout=None):
                response.url = request.full_url
                return response
        transport = m.PublicHTTP()
        transport._opener = Opener
        result = transport.request('https://v3-hgweb.qznovelvod.com/video/', limit=10, require_range=True)
        self.assertEqual(result[2], b'x' * 10)
        self.assertEqual(response.pos, 10)
        self.assertTrue(response.closed)

    def test_probe_redirect_is_closed_without_downloading_its_body(self):
        from urllib.request import Request
        request = Request('https://v3-hgweb.qznovelvod.com/video/')
        request._bounded_probe = True
        body = io.BytesIO(b'unbounded redirect body')
        handler = m._CheckedRedirect(m.PublicHTTP()._check)
        with self.assertRaises(m.SourceError):
            handler.redirect_request(request, body, 302, '', {}, 'https://v6-hgweb.qznovelvod.com/video/')
        self.assertTrue(body.closed)

    def test_mdat_before_moov_inside_initial_range(self):
        p = parts(media())
        transport, opener = self.probe(p[b'ftyp'] + p[b'mdat'] + p[b'moov'])
        self.assertTrue(transport.probe('https://v3-hgweb.qznovelvod.com/video/')['has_video'])
        self.assertEqual(len(opener.requests), 1)

    def test_large_moov_is_read_with_bounded_additional_range(self):
        p = parts(media())
        data = p[b'ftyp'] + box('moov', box('free', b'\0' * 70000) + p[b'moov'][8:]) + p[b'mdat']
        transport, opener = self.probe(data)
        self.assertTrue(transport.probe('https://v3-hgweb.qznovelvod.com/video/')['has_video'])
        self.assertGreater(len(opener.requests), 1)
        self.assertLessEqual(len(opener.requests), 4)
        self.assertLessEqual(opener.transferred, 1024 * 1024)

    def test_tail_moov_skips_large_mdat_without_downloading_it(self):
        p = parts(media())
        data = p[b'ftyp'] + box('mdat', b'\0' * (2 * 1024 * 1024)) + p[b'moov']
        transport, opener = self.probe(data)
        self.assertTrue(transport.probe('https://v3-hgweb.qznovelvod.com/video/')['has_video'])
        self.assertLessEqual(len(opener.requests), 4)
        self.assertLessEqual(opener.transferred, 1024 * 1024)

    def test_changed_total_during_multiple_ranges_is_rejected(self):
        p = parts(media())
        data = p[b'ftyp'] + box('mdat', b'\0' * 100000) + p[b'moov']
        transport, _ = self.probe(data, changed_total=True)
        with self.assertRaises(m.SourceError):
            transport.probe('https://v3-hgweb.qznovelvod.com/video/')

    def test_oversize_metadata_fails_instead_of_downloading_whole_video(self):
        p = parts(media())
        data = p[b'ftyp'] + box('moov', box('free', b'\0' * (1024 * 1024)) + p[b'moov'][8:])
        transport, opener = self.probe(data)
        with self.assertRaises(m.SourceError):
            transport.probe('https://v3-hgweb.qznovelvod.com/video/')
        self.assertLessEqual(opener.transferred, 1024 * 1024)

    def test_probe_refuses_requests_after_deadline(self):
        transport, opener = self.probe(media())
        with patch.object(m.time, 'monotonic', side_effect=[0.0, 30.0] + [30.0] * 50):
            with self.assertRaises(m.SourceError):
                transport.probe('https://v3-hgweb.qznovelvod.com/video/')
        self.assertEqual(len(opener.requests), 0)


if __name__ == '__main__':
    unittest.main()
