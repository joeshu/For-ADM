"""Offline catalogue contracts for the standalone public TVBox source.

Run: python -m unittest discover -s research/hongguo -p test_public_catalog.py -v
All pages are in-memory fixtures. Network access is blocked during these tests.
"""

import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch


_SOURCE_PATH = Path(__file__).with_name("hgtv_public_optimized.py")
_SPEC = importlib.util.spec_from_file_location("hgtv_catalog_under_test", _SOURCE_PATH)
SOURCE = importlib.util.module_from_spec(_SPEC)
with patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("network disabled")):
    _SPEC.loader.exec_module(SOURCE)


def router_html(loader, prefix="window._ROUTER_DATA = "):
    return "<html><script>" + prefix + json.dumps(
        {"loaderData": loader}, ensure_ascii=False
    ) + ";</script></html>"


class FakeHTTP:
    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    def page(self, path):
        self.calls.append(path)
        return self.pages[path]


class CatalogTests(unittest.TestCase):
    def setUp(self):
        for target in ("urllib.request.OpenerDirector.open", "socket.create_connection"):
            guard = patch(target, side_effect=AssertionError("network disabled"))
            guard.start()
            self.addCleanup(guard.stop)

    def test_parser_utf8_escaped_strings_and_exact_integer(self):
        video_id = 7598181059713414657
        text = '中文 quoted \\" bracket } ] <'
        page = router_html({"page": {"text": text, "id": video_id}})
        for html in (page, page.encode("utf-8")):
            with self.subTest(input_type=type(html).__name__):
                data = SOURCE.parse_router_data(html)["loaderData"]["page"]
                self.assertEqual(data["id"], video_id)
                self.assertEqual(data["text"], text)

    def test_parser_ignores_string_and_comment_decoys(self):
        script = (
            '<script>const a="_ROUTER_DATA = {bad}";'
            "/* _ROUTER_DATA = {bad} */\n"
            '// _ROUTER_DATA = {bad}\n'
            'globalThis._ROUTER_DATA={"loaderData":{}};</script>'
        )
        self.assertEqual(SOURCE.parse_router_data(script), {"loaderData": {}})

    def test_parser_rejects_nonliteral_nonfinite_duplicate_and_malformed_json(self):
        cases = (
            '<script>window._ROUTER_DATA=JSON.parse("{}");</script>',
            '<script>window._ROUTER_DATA={"loaderData":{},"a":NaN};</script>',
            '<script>window._ROUTER_DATA={"loaderData":{},"a":Infinity};</script>',
            '<script>window._ROUTER_DATA={"loaderData":{},"a":1e400};</script>',
            '<script>window._ROUTER_DATA={"loaderData":{},"loaderData":{}};</script>',
            '<script>window._ROUTER_DATA={"loaderData":{}}+code();</script>',
            '<script>window._ROUTER_DATA={"loaderData":[};</script>',
            '<script>window._ROUTER_DATA={"loaderData":[]};</script>',
            '<script>window._ROUTER_DATA={"loaderData":{}}',
            '<script>window._ROUTER_DATA=({"loaderData":{}});</script>',
        )
        for html in cases:
            with self.subTest(html=html), self.assertRaises(SOURCE.CatalogError):
                SOURCE.parse_router_data(html)
        for value in ("9" * 65, "0." + "1" * 129):
            with self.subTest(number_length=len(value)), self.assertRaises(SOURCE.CatalogError):
                SOURCE.parse_router_data(
                    '<script>window._ROUTER_DATA={"loaderData":{},"n":' + value + "};</script>"
                )

    def test_parser_limits_cover_strings_utf8_depth_and_invalid_utf8(self):
        with self.assertRaises(SOURCE.CatalogError):
            SOURCE.parse_router_data(
                '<script>window._ROUTER_DATA={"loaderData":{},"x":"'
                + "a" * (SOURCE.MAX_ROUTER_BYTES + 1) + '"};</script>'
            )
        with self.assertRaises(SOURCE.CatalogError):
            SOURCE.parse_router_data(
                '<script>window._ROUTER_DATA={"loaderData":{},"x":'
                + "[" * 130 + "0" + "]" * 130 + "};</script>"
            )
        with self.assertRaises(SOURCE.CatalogError):
            SOURCE.parse_router_data("文" * (SOURCE.MAX_HTML_BYTES // 3 + 1))
        with self.assertRaises(SOURCE.CatalogError):
            SOURCE.parse_router_data(b"\xff")

    def test_detail_preserves_all_large_ids_and_separates_unresolved_sources(self):
        series_id = "7598181059713414657"
        ids = [str(7598181059713414658 + index) for index in range(85)]
        row = {
            "series_id": int(series_id), "series_name": "完整目录测试",
            "episode_cnt": 85, "vid_list": [int(value) for value in ids],
        }
        http = FakeHTTP({
            "/detail?series_id=" + series_id: router_html({"detail_page": {"seriesDetail": row}})
        })
        result = SOURCE.Catalog(http).detail(series_id)
        self.assertEqual([episode["id"] for episode in result["episodes"]], ids)
        self.assertEqual(result["episode_count"], 85)
        self.assertTrue(result["catalog_complete"])
        self.assertFalse(result["playback_verified"])
        for kind, preview in (("full", False), ("preview", True)):
            with self.subTest(kind=kind):
                source = result["sources"][kind]
                self.assertEqual([episode["id"] for episode in source], ids)
                self.assertTrue(all(episode["preview"] is preview for episode in source))
                self.assertTrue(all(episode["availability"] == "unresolved" for episode in source))
                self.assertTrue(all("url" not in episode for episode in source))

    def test_detail_missing_count_is_unknown_and_wrong_series_id_is_rejected(self):
        row = {"series_id": "1", "series_title": "剧", "vid_list": ["11", "12"]}
        page = router_html({"detail_page": {"seriesDetail": row}})
        http = FakeHTTP({"/detail?series_id=1": page, "/detail?series_id=2": page})
        catalog = SOURCE.Catalog(http)
        self.assertEqual(http.calls, [])
        self.assertIsNone(catalog.detail("1")["catalog_complete"])
        with self.assertRaises(SOURCE.CatalogError):
            catalog.detail("2")

    def test_detail_invalid_and_duplicate_ids_prevent_completeness_claim(self):
        row = {
            "series_id": "1", "title": "剧", "episode_cnt": 2,
            "vid_list": ["11", 12, True, 12.0, "１２", "11"],
        }
        http = FakeHTTP({
            "/detail?series_id=1": router_html({"detail_page": {"seriesDetail": row}})
        })
        result = SOURCE.Catalog(http).detail("1")
        self.assertEqual([episode["id"] for episode in result["episodes"]], ["11", "12"])
        self.assertFalse(result["catalog_complete"])
        self.assertEqual(result["invalid_episode_entries"], 3)
        self.assertEqual(result["duplicate_episode_entries"], 1)

    def test_home_category_pagination_filters_and_bounded_local_search(self):
        def movie(number):
            return {"series_id": str(number), "series_title": "逆袭" + str(number), "episode_cnt": 50}

        http = FakeHTTP({
            "/": router_html({"page": {
                "mBannerList": [movie(1)],
                "homeSections": [{"tab_name": "精选", "video_list": [movie(1), movie(2)]}],
            }}),
            "/category/real-drama?page=2": router_html({"category_$": {
                "recommendList": [movie(3)], "pagination": {"total": 100, "page_size": 24},
                "selectorList": [{"items": [
                    {"selector_item_id": "urban", "show_name": "都市"},
                    {"selector_item_id": "../bad", "show_name": "坏"},
                ]}],
            }}),
            "/category/comic?page=1": router_html({"category_$": {"recommendList": []}}),
        })
        catalog = SOURCE.Catalog(http, max_catalog=2, search_page_size=1)
        self.assertEqual(http.calls, [])
        self.assertEqual(len(catalog.categories()), 4)
        self.assertEqual(http.calls, [])
        self.assertEqual([item["id"] for item in catalog.home()["items"]], ["1", "2"])
        category = catalog.category("real-drama", "2")
        self.assertEqual(category["pagecount"], 5)
        self.assertEqual(category["total"], 100)
        self.assertTrue(category["pagination_known"])
        self.assertEqual(category["selectors"][0]["items"], [
            {"id": "urban", "title": "都市", "path": "real-drama/urban"}
        ])
        unknown = catalog.category("comic")
        self.assertFalse(unknown["pagination_known"])
        self.assertEqual(unknown["pagecount"], 1)
        self.assertIsNone(unknown["total"])
        calls_before = list(http.calls)
        search = catalog.search("逆袭")
        self.assertEqual(search["scope"], "local_catalog")
        self.assertEqual(search["catalog_size"], 2)
        self.assertEqual(search["eviction_events"], 1)
        self.assertEqual(search["total"], 2)
        self.assertEqual(search["pagecount"], 2)
        self.assertEqual([item["id"] for item in search["items"]], ["2"])
        self.assertEqual([item["id"] for item in catalog.search("逆袭", 2)["items"]], ["3"])
        self.assertEqual(catalog.search("未抓到的片名")["items"], [])
        self.assertEqual(http.calls, calls_before)
        self.assertIn("非全站搜索", search["scope_description"])
        self.assertIn("/", search["recent_paths"])

    def test_invalid_category_paths_and_page_numbers_do_not_perform_http(self):
        http = FakeHTTP({})
        catalog = SOURCE.Catalog(http)
        for slug in ("https://example.com", "../real-drama", "real-drama/../x", "real-drama?x=y", "unknown"):
            with self.subTest(slug=slug), self.assertRaises(SOURCE.CatalogError):
                catalog.category(slug)
        for page in (True, 0, -1, "1.5", SOURCE.MAX_PAGES + 1):
            with self.subTest(page=page), self.assertRaises(SOURCE.CatalogError):
                catalog.category("real-drama", page)
        with self.assertRaises(SOURCE.CatalogError):
            catalog.category("real-drama", topic="https://example.com")
        self.assertEqual(http.calls, [])

    def test_catalog_prefers_http_router_without_reparsing_html(self):
        class ParsedHTTP:
            def __init__(self):
                self.calls = []

            def page(self, path):
                raise AssertionError("page should not be called when router is available")

            def router(self, path):
                self.calls.append(path)
                return {"loaderData": {"page": {"mBannerList": [], "homeSections": []}}}

        http = ParsedHTTP()
        catalog = SOURCE.Catalog(http)
        with patch.object(SOURCE, "parse_router_data", side_effect=AssertionError("duplicate JSON parse")):
            self.assertEqual(catalog.home(), {"items": [], "sections": []})
        self.assertEqual(http.calls, ["/"])


if __name__ == "__main__":
    unittest.main()
