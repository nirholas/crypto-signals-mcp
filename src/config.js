// Centralized env + HTTP config for the signals MCP.
//
// This server is the signal-marketplace surface of three.ws. The discovery and
// publisher-leaderboard reads are PUBLIC (no credential). The follower tools —
// listing your subscriptions, subscribing, and the kill/pause controls — are
// account-scoped writes that authenticate with a three.ws API key, so the only
// secret this server ever holds is THREE_WS_API_KEY (supplied by the operator,
// never baked in). Every feed, delivery stat, and ranking comes live from the
// endpoints; nothing is computed or cached here.

export function env(key, fallback) {
	const v = process.env[key];
	return v !== undefined && String(v).trim() !== '' ? String(v).trim() : fallback;
}

// Base URL of the three.ws API. Override only when self-hosting or pointing at a
// preview deployment.
export const THREE_WS_BASE = env('THREE_WS_BASE', 'https://three.ws').replace(/\/+$/, '');

// Per-request timeout (ms). These are live reads/writes (marketplace ranking,
// subscription upserts) — generous enough to ride out a cold edge, fast in
// practice.
export const HTTP_TIMEOUT_MS = (() => {
	const raw = env('THREE_WS_TIMEOUT_MS');
	if (raw === undefined) return 20000;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) {
		throw Object.assign(new Error(`THREE_WS_TIMEOUT_MS must be a positive number (got "${raw}")`), {
			code: 'bad_config',
		});
	}
	return n;
})();

// three.ws API key (sk_live_… / sk_test_…) for the account-scoped follower tools.
// Optional: the public discovery + leaderboard tools work without it. Required
// only for subscribe_signal, set_subscription_status, and get_subscriptions —
// each throws a clear `auth_required` error when it is missing. Treat like cash.
export const THREE_WS_API_KEY = env('THREE_WS_API_KEY', '');

// Identifies this client to the API in request logs.
export const USER_AGENT = '@three-ws/signals-mcp';
