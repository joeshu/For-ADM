/**
 * 搜剧AI广告配置清理（Quantumult X）
 * 仅处理响应中 app_experience.app_experience_snapshot 的广告位配置，
 * 不改动播放源、集数、登录或其他接口响应。
 */
(() => {
  const original = $response.body;
  if (!original) {
    $done({});
    return;
  }

  try {
    const payload = JSON.parse(original);
    let changed = false;

    function clearPlacement(placement) {
      if (!placement || typeof placement !== "object") return;
      if (Array.isArray(placement.items)) placement.items = [];
    }

    function sanitizeSnapshot(snapshot) {
      if (
        !snapshot ||
        typeof snapshot !== "object" ||
        snapshot.object !== "app.experience_snapshot" ||
        !snapshot.placements ||
        typeof snapshot.placements !== "object"
      ) return false;

      const placements = snapshot.placements;
      clearPlacement(placements.splash_screen);
      clearPlacement(placements.showcase_grid);

      const player = placements.player_info;
      if (player && typeof player === "object") {
        player.enabled = false;
        player.default_ad_targeting = {
          ...(player.default_ad_targeting || {}),
          enabled: false
        };
        for (const key of ["items", "banner_items", "grid_items"]) {
          if (Array.isArray(player[key])) player[key] = [];
        }
      }
      return true;
    }

    function visit(node, depth) {
      if (!node || typeof node !== "object" || depth > 12) return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item, depth + 1);
        return;
      }

      if (node.object === "app.experience_snapshot") {
        changed = sanitizeSnapshot(node) || changed;
      }

      for (const [key, value] of Object.entries(node)) {
        if (key === "app_experience" && value && typeof value === "object") {
          if (value.object === "app.experience_snapshot") {
            changed = sanitizeSnapshot(value) || changed;
          } else {
            visit(value, depth + 1);
          }
        } else if (value && typeof value === "object") {
          visit(value, depth + 1);
        }
      }
    }

    visit(payload, 0);
    $done({ body: changed ? JSON.stringify(payload) : original });
  } catch (_) {
    // Preserve the original response on unexpected/non-JSON bodies.
    $done({ body: original });
  }
})();
