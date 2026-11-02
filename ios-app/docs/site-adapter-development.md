# Site adapter development

The source layer separates site configuration, protocol handling, normalized media data, and interface rendering. Keep a source-specific implementation behind the shared client contract so that adding a provider does not require another provider-name branch in the discovery UI.

## Current extension points

- `Web/sites.json` contains the source identity, origin, protocol version, and adapter-specific public configuration. `tools/build-web.mjs` validates it before generating the bundled module.
- `Web/source-clients.mjs` is the explicit provider registry. A descriptor with an unknown `provider` fails closed; it is never silently sent to the generic client.
- `Web/site-api.mjs` is the generic adapter for sites that actually share its signed API and response format. Dedicated protocols belong in their own `*-api.mjs` module.
- Every client implements the methods in `Web/source-contract.mjs` and normalizes catalog, detail, episode, and playback responses to the common app model.
- `discoveryProfile()` supplies tab IDs, labels, modes, timeline support, and an optional section tab. Both web discovery and native page snapshots consume this profile.
- `tools/validate-sites.mjs` checks descriptors without contacting any site. Tests should use saved response fixtures and deterministic fake transports; a live probe is a separate, opt-in integration check.

## Adding a source

1. Research the site’s documented or otherwise authorized public interface. Capture representative responses for initialization, categories, filters, home sections, search, detail, episodes, and playback. Record version/hash and pagination behavior. Do not infer endpoints from unrelated sites that only look similar.
2. Decide whether the existing generic client truly matches the request signing, session, pagination, response decoding, and playback behavior. If any of those differ, add a dedicated adapter instead of growing a collection of site-ID conditionals.
3. Add the source descriptor to `Web/sites.json`. Use an HTTPS origin where available. For a source that only offers HTTP, explicitly set `allowInsecureOrigin: true`; review the transport implications before doing so. Never put a user’s password, account token, or captured temporary playback ticket in the manifest.
4. Implement the shared client methods and a `discoveryProfile()` in its adapter. Normalize source-specific fields at the adapter boundary. Return only playback URLs and headers the source actually authorizes; preserve source-side account, subscription, and DRM restrictions.
5. Register the provider in `Web/source-clients.mjs`. Add fixture-based tests for pagination, malformed data, expired sessions, denied requests, and playback response validation. Update `tools/website-ui-check.mjs` for source switching, discovery tabs, cards, and load-more behavior.
6. Run `npm run validate:sites`, `npm test`, and `npm run build:web`. For interface changes, run `npm run preview` and the website UI check. A live probe should be reproducible and should not make normal CI depend on third-party uptime.
7. Update the app version/build only after the integration passes. Keep the source notes alongside the adapter so protocol changes have a clear place to be reviewed.

## Contract and failure behavior

Unknown providers, invalid source origins, duplicate IDs, malformed API-origin lists, and missing protocol fields fail during validation or client construction. Network and business errors should remain distinguishable: an unavailable API line may be retried, but an authentication, payment, or permission denial must be shown instead of being treated as a broken line. Temporary episode tokens, cookies, and signed media URLs should remain in memory unless the source has an explicit, reviewed persistence requirement.

The contract is intentionally small. Add a shared capability only when at least two real adapters need it, then cover the behavior with a test before moving provider-specific logic into the common layer.
