"""Market-data MCP server for the research agent: Yahoo Finance quotes, history, symbol search.

The agent uses these numbers to reason; the web UI re-fetches prices itself for charts.
"""

from __future__ import annotations

import datetime as dt

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

mcp = FastMCP("market")
UA = {"User-Agent": "Mozilla/5.0"}  # Yahoo 429s full browser UAs from this host; the bare token works.
CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{}"
# Yahoo keeps intraday bars only for limited lookbacks.
# Read-only + open-world tools are auto-approved by Codex under approval_policy="never".
READ_ONLY = ToolAnnotations(readOnlyHint=True, openWorldHint=True)
MAX_DAYS = {"1m": 7, "5m": 59, "15m": 59, "1h": 729, "1d": 100000}


def _ts(iso: str) -> int:
    t = dt.datetime.fromisoformat(iso)
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.UTC)
    return int(t.timestamp())


def _iso(ts: int) -> str:
    return dt.datetime.fromtimestamp(ts, dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _bars(symbol: str, start: int, end: int, interval: str) -> tuple[dict, list[tuple[int, float, int]]]:
    r = httpx.get(
        CHART.format(symbol),
        params={"interval": interval, "period1": start, "period2": end, "includePrePost": "true"},
        headers=UA,
        timeout=15,
    )
    r.raise_for_status()
    res = r.json()["chart"]["result"]
    if not res:
        return {}, []
    res = res[0]
    q = res["indicators"]["quote"][0]
    bars = [
        (t, c, v or 0)
        for t, c, v in zip(res.get("timestamp") or [], q.get("close") or [], q.get("volume") or [])
        # Yahoo appends the latest live bar even when period2 is in the past; keep only the window.
        if c is not None and start <= t <= end
    ]
    return res["meta"], bars


@mcp.tool(annotations=READ_ONLY)
def search_symbol(query: str) -> list[dict]:
    """Find Yahoo Finance ticker symbols for a company, ETF or index name (e.g. "TSMC", "semiconductor ETF")."""
    r = httpx.get(
        "https://query2.finance.yahoo.com/v1/finance/search",
        params={"q": query, "quotesCount": 8, "newsCount": 0},
        headers=UA,
        timeout=15,
    )
    r.raise_for_status()
    return [
        {k: q.get(k) for k in ("symbol", "longname", "shortname", "exchDisp", "quoteType", "sector", "industry")}
        for q in r.json().get("quotes", [])
    ]


@mcp.tool(annotations=READ_ONLY)
def price_history(symbol: str, start: str, end: str, interval: str = "1d", events: list[str] | None = None) -> dict:
    """Price summary for one Yahoo symbol between ISO-8601 UTC times start and end.

    interval: 1m (last 7 days only), 5m/15m (last 60 days), 1h, 1d.
    events: optional ISO-8601 UTC times (e.g. news publish times); for each, returns the last price
    before it and the change 30 min, 2 h and 1 day later, so you can attribute moves to news.
    Includes extended-hours bars. Returns at most ~40 sampled points to stay compact.
    """
    s, e = _ts(start), _ts(end)
    if interval not in MAX_DAYS:
        return {"error": f"interval must be one of {list(MAX_DAYS)}"}
    if (dt.datetime.now(dt.UTC).timestamp() - s) / 86400 > MAX_DAYS[interval]:
        return {"error": f"{interval} bars only exist for the last {MAX_DAYS[interval]} days; use a coarser interval"}
    meta, bars = _bars(symbol, s, e, interval)
    if not bars:
        return {"symbol": symbol, "error": "no bars in window (market closed or bad symbol?)"}
    closes = [c for _, c, _ in bars]
    first, last = bars[0], bars[-1]
    step = max(1, len(bars) // 40)
    out = {
        "symbol": symbol,
        "currency": meta.get("currency"),
        "exchange_tz": meta.get("exchangeTimezoneName"),
        "interval": interval,
        "first": {"t": _iso(first[0]), "close": round(first[1], 4)},
        "last": {"t": _iso(last[0]), "close": round(last[1], 4)},
        "change_pct": round((last[1] / first[1] - 1) * 100, 3),
        "high": round(max(closes), 4),
        "low": round(min(closes), 4),
        "total_volume": sum(v for _, _, v in bars),
        "points": [[_iso(t), round(c, 4)] for t, c, _ in bars[::step]],
    }
    if events:
        out["event_reactions"] = [_reaction(bars, _ts(x), x) for x in events[:20]]
    return out


def _price_at(bars, t: int) -> tuple[int, float] | None:
    before = [(bt, c) for bt, c, _ in bars if bt <= t]
    return before[-1] if before else None


def _reaction(bars, t: int, label: str) -> dict:
    base = _price_at(bars, t)
    if not base:
        return {"event": label, "error": "no price before event in window"}
    row = {"event": label, "price_before": round(base[1], 4), "price_before_t": _iso(base[0])}
    for name, d in (("after_30m_pct", 1800), ("after_2h_pct", 7200), ("after_1d_pct", 86400)):
        p = _price_at(bars, t + d)
        row[name] = round((p[1] / base[1] - 1) * 100, 3) if p and p[0] > base[0] else None
    return row


@mcp.tool(annotations=READ_ONLY)
def quotes(symbols: list[str]) -> list[dict]:
    """Latest regular-session price for up to 20 Yahoo symbols."""
    out = []
    for sym in symbols[:20]:
        try:
            meta, _ = _bars(sym, int(dt.datetime.now(dt.UTC).timestamp()) - 5 * 86400, int(dt.datetime.now(dt.UTC).timestamp()), "1d")
            price = meta.get("regularMarketPrice")
            out.append({
                "symbol": sym,
                "name": meta.get("longName") or meta.get("shortName"),
                "price": price,
                "currency": meta.get("currency"),
                "market_time": _iso(meta["regularMarketTime"]) if meta.get("regularMarketTime") else None,
            })
        except Exception as exc:  # noqa: BLE001 - report per-symbol failures to the agent
            out.append({"symbol": sym, "error": str(exc)[:200]})
    return out


if __name__ == "__main__":
    mcp.run()
