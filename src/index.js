#!/usr/bin/env node
// @three-ws/signals-mcp — MCP server entry point.
//
// Gives any AI agent the three.ws signal-marketplace surface over stdio:
//   • list_signal_feeds       — discover copy-trade feeds, ranked by proven edge
//   • get_mirror_leaderboard  — rank publishers by REAL on-chain performance
//   • get_subscriptions       — your subscriptions + delivery history & realized ROI
//   • subscribe_signal        — subscribe an agent to a feed (simulate or live)
//   • set_subscription_status — resume / pause / stop / instant-kill a subscription
//
// Discovery + the leaderboard are PUBLIC reads. The follower tools (the last
// three) are account-scoped: set THREE_WS_API_KEY to an sk_live_… / sk_test_…
// three.ws API key. subscribe_signal in live mode pays the publisher in USDC
// (x402) and auto-mirrors real trades at delivery time — read its description.
//
// Run standalone:
//   node packages/signals-mcp/src/index.js
//
// Or wire into Claude Code / Cursor — see README.md.

import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { def as listSignalFeeds } from './tools/list-signal-feeds.js';
import { def as getMirrorLeaderboard } from './tools/get-mirror-leaderboard.js';
import { def as getSubscriptions } from './tools/get-subscriptions.js';
import { def as subscribeSignal } from './tools/subscribe-signal.js';
import { def as setSubscriptionStatus } from './tools/set-subscription-status.js';

// Single source of truth for the advertised server version — package.json.
const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../package.json');

export const TOOLS = [
	listSignalFeeds,
	getMirrorLeaderboard,
	getSubscriptions,
	subscribeSignal,
	setSubscriptionStatus,
];

/**
 * Construct a fully-registered McpServer without connecting a transport.
 * Registration is env-free, so this is safe to import from tests.
 * @returns {McpServer}
 */
export function buildServer() {
	const server = new McpServer(
		{ name: 'signals-mcp', title: 'three.ws Signals', version: PKG_VERSION },
		{
			capabilities: { tools: {} },
			instructions:
				'three.ws Signals MCP — discover, subscribe to, and track copy-trade signal feeds. ' +
				'list_signal_feeds browses the public feed directory ranked by PROVEN realized edge (a thin feed ' +
				"with one lucky call can't top a deep, consistent one). get_mirror_leaderboard ranks publishers by " +
				'real on-chain performance — every number traces to a signature, losers included. get_subscriptions ' +
				'lists your subscriptions with delivery history and realized ROI. subscribe_signal subscribes one of ' +
				'your agents to a feed: simulate mode (default) pays/trades nothing; LIVE mode pays the publisher in ' +
				'USDC (x402) and auto-mirrors real trades at delivery time. set_subscription_status resumes, pauses, ' +
				'stops, or INSTANTLY KILLS a subscription (the kill halts all pay/trade before it fires). Discovery ' +
				'and the leaderboard are public; the follower tools need THREE_WS_API_KEY (an sk_live_… key). All ' +
				'data is live from the three.ws API — nothing is mocked.',
		},
	);

	for (const tool of TOOLS) {
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.inputSchema,
				annotations: tool.annotations,
			},
			async (args, extra) => {
				try {
					const result = await tool.handler(args, extra);
					const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
					return { content: [{ type: 'text', text }] };
				} catch (err) {
					const payload = {
						ok: false,
						error: err?.code || 'unhandled',
						message: err?.message || String(err),
						...(err?.status ? { status: err.status } : {}),
					};
					return {
						content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
						isError: true,
					};
				}
			},
		);
	}

	return server;
}

async function main() {
	const server = buildServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`[signals-mcp@${PKG_VERSION}] connected over stdio with ${TOOLS.length} tools`);
}

// Connect stdio ONLY when this file is the process entry point. Importing the
// module (tests, embedding) must not grab the transport. realpath both sides:
// npm bin shims are symlinks, so argv[1] may differ from import.meta.url.
function isProcessEntryPoint() {
	if (!process.argv[1]) return false;
	try {
		return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
	} catch {
		return false;
	}
}

if (isProcessEntryPoint()) {
	main().catch((err) => {
		console.error('[signals-mcp] fatal:', err);
		process.exit(1);
	});
}
