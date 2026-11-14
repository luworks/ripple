# /// script
# requires-python = ">=3.11"
# dependencies = ["yfinance>=0.2.50", "pandas", "pyarrow"]
# ///
"""Download every interval Yahoo Finance offers for a ticker into local Parquet files.

Usage: uv run scripts/fetch_stock.py [TICKER] [OUT_DIR]   (defaults: NVDA, data/market)

Yahoo's window per interval (as of 2026-11): 1m = last 30 days (7-day chunks),
2m-30m = last 60 days, 1h = last 730 days, 1d/1wk/1mo = full history. All intraday
bars include pre/post market. Re-running merges with existing files, so running it
regularly keeps extending the short 1m/5m windows beyond Yahoo's limit.
Timestamps are stored in UTC (column `ts`); prices are unadjusted plus `adj_close`.
"""

import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

# interval -> Yahoo period. 1m only accepts 7-day requests, so it is fetched in chunks.
# `period="730d"` reaches further back than an explicit start/end of 730 calendar days.
INTERVALS = {
    "1m": None,
    "2m": "60d",
    "5m": "60d",
    "15m": "60d",
    "30m": "60d",
    "1h": "730d",
    "1d": "max",
    "1wk": "max",
    "1mo": "max",
}


def fetch(ticker: yf.Ticker, interval: str, period: str | None) -> pd.DataFrame:
    kw = {"interval": interval, "prepost": True, "auto_adjust": False, "actions": True}
    if period:
        frames = [ticker.history(period=period, **kw)]
    else:  # 1m: 7-day chunks covering Yahoo's last-30-days window
        end = datetime.now(UTC) + timedelta(days=1)
        start = end - timedelta(days=30)
        frames = []
        while start < end:
            stop = min(start + timedelta(days=7), end)
            frames.append(ticker.history(start=start, end=stop, **kw))
            start = stop
    df = pd.concat([f for f in frames if not f.empty])
    df.index = pd.DatetimeIndex(df.index).tz_convert("UTC")
    df.index.name = "ts"
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    return df


def flag_bad_volume(volume: pd.Series) -> pd.Series:
    """Yahoo intraday bars sometimes carry the session's running total instead of the bar's own
    volume (e.g. 290M in one NVDA minute on 2026-11-12). Flag bars above 20x the day's median."""
    day = volume.index.tz_convert("America/New_York").date
    median = volume.where(volume > 0).groupby(day).transform("median")
    return volume > 20 * median


def main() -> None:
    symbol = sys.argv[1] if len(sys.argv) > 1 else "NVDA"
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "data/market") / symbol
    out.mkdir(parents=True, exist_ok=True)
    ticker = yf.Ticker(symbol)
    manifest = {
        "symbol": symbol,
        "source": "yahoo",
        "fetched_at": datetime.now(UTC).isoformat(),
        "files": {},
    }
    for interval, period in INTERVALS.items():
        path = out / f"{interval}.parquet"
        df = fetch(ticker, interval, period)
        if path.exists():
            df = pd.concat([pd.read_parquet(path), df])
        df = df[~df.index.duplicated(keep="last")].sort_index()
        if interval not in ("1d", "1wk", "1mo"):
            df["volume_suspect"] = flag_bad_volume(df.volume)
        df.to_parquet(path)
        manifest["files"][path.name] = {
            "rows": len(df),
            "start": str(df.index.min()),
            "end": str(df.index.max()),
        }
        print(f"{interval:>4} {len(df):>7} rows  {df.index.min()} -> {df.index.max()}")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
