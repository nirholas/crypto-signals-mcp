---
name: copy-trade-signals
description: Browse three.ws copy-trade signal feeds ranked by proven realized edge, rank publishers by on-chain performance, and subscribe, pause or kill an agent's subscription through the signals-mcp server.
---

# Copy-trade signals with signals-mcp

The plugin starts `@three-ws/signals-mcp` over stdio (`npx -y @three-ws/signals-mcp`). Tools appear as `mcp__signals-mcp__<tool>`.

## Environment

- `THREE_WS_API_KEY`: three.ws API key (`sk_live_...` or `sk_test_...`), sent as a Bearer token. Needed only for `get_subscriptions`, `subscribe_signal` and `set_subscription_status`. The browse tools work without it.
- `THREE_WS_BASE`: API host, default `https://three.ws`.
- `THREE_WS_TIMEOUT_MS`: request timeout, default `20000`.

## Tools

Public, read-only:

- `list_signal_feeds` (`network` mainnet|devnet, `sort` edge|roi|hitrate|subscribers|newest, `limit` 1-100): returns feeds with a numeric `id`, publisher stats, pricing and proven stats. Calls `GET /api/signals/marketplace`.
- `get_mirror_leaderboard` (`network`, `sort` score|pnl|followers|volume|winrate, `limit` 1-50): ranks publishers by realized, on-chain-derived performance. Calls `GET /api/mirror/leaderboard`.

Account-scoped (need `THREE_WS_API_KEY`):

- `get_subscriptions`: lists the account's subscriptions with their `id`.
- `subscribe_signal` (`agent_id`, `feed_id`, `mode` simulate|live, `billing` per_signal|per_epoch, `base_sol`, `size_scaling`, `max_per_trade_sol`, `slippage_bps`, `firewall_level` block|warn, `copy_exits`): subscribes one of your agents to a feed. Idempotent per agent and feed.
- `set_subscription_status` (`subscription_id`, `state` active|paused|stopped|killed): `killed` is an instant halt of all payments and trades.

## Safety

`mode: "simulate"` (the default) spends nothing and trades nothing. `mode: "live"` pays the publisher in USDC over x402 and mirrors real on-chain trades from the subscriber agent's custodial wallet. Money moves when the publisher emits a signal. Before any `live` subscription, show the user the feed, billing, `base_sol` and `max_per_trade_sol` and wait for an explicit yes. Start in simulate mode.

## Example

1. `list_signal_feeds` with `sort: "edge"`, `limit: 10`. Pick a feed `id`.
2. `get_mirror_leaderboard` to compare its publisher.
3. `subscribe_signal` with `agent_id`, `feed_id`, `mode: "simulate"`.
4. Later, `get_subscriptions` to read results, and `set_subscription_status` with `state: "killed"` to halt.
