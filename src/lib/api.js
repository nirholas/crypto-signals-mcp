// Real HTTP access to the three.ws API. No mocks, no fixtures — every call is
// a live request to THREE_WS_BASE. Errors are normalized into a single shape so
// tool handlers can surface a clean message + status to the MCP client.

import { THREE_WS_BASE, HTTP_TIMEOUT_MS, USER_AGENT, THREE_WS_API_KEY } from '../config.js';

/**
 * Guard for the account-scoped tools. Throws a clean `auth_required` error
 * (surfaced to the MCP client) when no API key is configured, so the agent gets
 * an actionable message instead of an upstream 401.
 */
export function requireApiKey() {
	if (!THREE_WS_API_KEY) {
		throw Object.assign(
			new Error(
				'This tool is account-scoped and needs a three.ws API key. Set THREE_WS_API_KEY ' +
					'(an sk_live_… / sk_test_… key from three.ws) in the server environment.',
			),
			{ code: 'auth_required', status: 401 },
		);
	}
}

/**
 * Call a three.ws HTTP endpoint and return its parsed JSON body.
 *
 * When THREE_WS_API_KEY is set it is sent as `Authorization: Bearer <key>`, which
 * authenticates the account-scoped follower endpoints (api-key bearer auth needs
 * no CSRF). Public endpoints ignore the header.
 *
 * @param {string} path  Endpoint path beginning with `/` (e.g. `/api/signals/marketplace`).
 * @param {{ method?: string, query?: Record<string, unknown>, body?: unknown }} [opts]
 * @returns {Promise<any>} Parsed JSON response.
 * @throws {Error} with `.code` ('timeout' | 'network_error' | 'upstream_error'),
 *   and on upstream errors `.status` + `.body`.
 */
export async function apiRequest(path, { method = 'GET', query, body } = {}) {
	const url = new URL(`${THREE_WS_BASE}${path}`);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined || value === null || value === '') continue;
			url.searchParams.set(key, String(value));
		}
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

	let res;
	try {
		res = await fetch(url, {
			method,
			headers: {
				accept: 'application/json',
				'user-agent': USER_AGENT,
				...(THREE_WS_API_KEY ? { authorization: `Bearer ${THREE_WS_API_KEY}` } : {}),
				...(body !== undefined ? { 'content-type': 'application/json' } : {}),
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		});
	} catch (err) {
		clearTimeout(timer);
		if (err?.name === 'AbortError') {
			throw Object.assign(new Error(`three.ws ${path} timed out after ${HTTP_TIMEOUT_MS}ms`), {
				code: 'timeout',
			});
		}
		throw Object.assign(new Error(`three.ws ${path} request failed: ${err?.message || err}`), {
			code: 'network_error',
		});
	}
	clearTimeout(timer);

	const text = await res.text();
	let data;
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		data = { raw: text };
	}

	if (!res.ok) {
		const message = data?.message || data?.error || `three.ws ${path} returned HTTP ${res.status}`;
		throw Object.assign(new Error(message), { code: 'upstream_error', status: res.status, body: data });
	}
	return data;
}
