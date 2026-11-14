# Devpost submission: Ripple

Copy each section into the matching Devpost field. Every number below matches the live site
(https://search.chaorders.com) and `web/src/data/venture-pitch.ts` as of `main` on Nov 14, 2026.

## Project name

Ripple

## Elevator pitch (200 characters max)

Type a market-moving headline. In under a minute: who's involved, which tickers it hits, and a sourced, minute-level timeline of news and X, Reddit and Chinese social posts, via Telem.

## Try it out

- Live site: https://search.chaorders.com
- Run your own research: https://search.chaorders.com/research
- Pricing and competitor comparison: https://search.chaorders.com/pricing

We submit the live site and the demo video only. No code link.

## Built with

telem, tavily, openai, gpt-5.4-mini, codex-cli, model-context-protocol, typescript, react, tanstack-start, tailwindcss, postgresql, neon, docker, cloudflare-containers, github-actions, python, yahoo-finance

## About the project

### Inspiration

When a market-moving headline breaks, a trading desk has minutes to answer three questions: is it real, who said it first, and which tickers does it hit? Terminals are good at wires and transcripts. But stories about Asian supply chains and Chinese-founded companies often surface first on Weibo, Xiaohongshu or Zhihu, and those posts never sit next to the price chart. We wanted one screen that answers all three questions in under a minute, with a source behind every line.

### What it does

Type an event, for example "Jensen Huang resigns as Nvidia CEO". Ripple returns:

- the people involved and the exposed tickers;
- a minute-level timeline that puts news and every timestamped social post on the same clock as 1-minute price bars;
- the chatter from X, Reddit and Chinese social platforms, grouped by stance;
- a real URL and a UTC time for every claim.

You choose how long it may search: 30 seconds, 1 minute (the default), 2 or 4 minutes.

**The home page replays a real week.** For the Jensen Huang story (Nov 8 to 14), Telem collected 180 relevant posts across 13 social platforms.

- The replay places the 84 posts that carry a publish time on lanes for X, Xiaohongshu, Douyin, TikTok, LinkedIn and Instagram, at the minute each was published.
- Those posts sit next to NVDA's 1-minute price and the day's reported events.
- NVDA started to fall at 13:49 UTC; the first resignation post landed at 13:52:29 UTC, about 3 minutes later.

**Two panels on every brief** are built only from recorded tool calls and timings, never from the model's text:

- **Telem trace** shows what the agent asked Telem and what came back:
  - search and fetch calls, queries and topics (X, Reddit);
  - pages read and sources found, by site and by search provider;
  - which social platforms the sources came from;
  - how many more sources Telem's merged results produced than the best single provider alone;
  - whether Tavily had to step in as a fallback.
- **Memory** is a head start, not a shortcut:
  - Before the agent searches, Ripple embeds the question and finds earlier finished runs about the same event, across languages. "黄仁勋辞职" finds "Jensen Huang resigns as Nvidia CEO".
  - The agent mines those runs for names, tickers, exact headline phrases and local-language terms. It turns them into four sharper Telem searches in parallel: an earlier first report, what changed since, X, Reddit, and local-language social.
  - It reuses verified sources instead of fetching them again. Prices are always fetched live.
  - The panel shows how many sources were reused and the search calls and time compared with a typical run. When nothing matches, it names the closest earlier run.

### How we built it

- **Telem is the backbone.** One API key gives us 37 platforms, 8 of them Chinese (Weibo, Xiaohongshu, Zhihu, WeChat articles, Douyin, Bilibili, Kuaishou, Toutiao), plus many web search engines and page readers. Without Telem, each of those would be its own scraper, login and parser.
  - A single `telem_search` fans out to several providers at once.
  - The agent's first round is parallel Telem searches: news in English and in the story's local language, X, and Reddit.
  - It then reads the key primary pages with `telem_fetch`.
- **Tavily is the fallback**, used when a Telem call errors or a publish time is missing.
- **A market-data MCP** supplies quotes and minute bars. Prices never come from model text.
- **Agent:** Codex CLI (gpt-5.4-mini, low reasoning effort) runs each query in a fresh, read-only, isolated container. Telem, Tavily and the market MCP are its only tools. It must return JSON that matches a strict schema. A time-budget tier caps searches and fetches, but every run still fetches prices.
- **Web app:** TanStack Start, React and Tailwind.
  - Runs stream over SSE and are stored in Postgres.
  - A repeat query returns the cached brief.
  - New runs are capped at 10 per rolling 24 hours and 3 at a time.
  - The `POST /api/research` + SSE API that our own app uses is the API we sell.
- **Hosting:** Cloudflare Containers for the site and the agent, Neon Postgres, deployed by GitHub Actions on every push to `main`.

### Challenges we ran into

- **Time alignment.** Posts, articles and candles come with different time zones and precision. We normalize everything to UTC minutes so a post and an NVDA bar can sit on one axis. Posts without a publish time, including some Weibo and Zhihu posts, stay as sources but are left off the replay rather than given a guessed time.
- **Grounding.** The model would happily invent a price or a quote. We fixed this with a strict output schema, prices taken only from tool data, and a rule that every line carries a URL.
- **Memory that doesn't make the agent lazy.** Our first version let a remembered event finish with almost no new searches and no fresh social posts. Now memory only sharpens the Telem queries; it never replaces them.
- **Cost.** Every run spends real money. So we measured the cost before setting prices (below), cache by query, and cap new runs.

### Accomplishments that we're proud of

- **Fast.** Across 89 finished runs, the median time from headline to brief is 41 seconds (p90: 83 s).
- **Measured unit cost: about $0.22 per fresh run.**
  - Model, about $0.11: one metered gpt-5.4-mini run used 341k input tokens (87% cached) plus 5.5k output, which is $0.08 with 5 searches. The average run does 7.2 searches.
  - Telem, about $0.09: provider calls that returned results across 43 runs, at list price, plus page fetches.
  - We add 10% for retries. Cached briefs cost almost nothing.
- **Chinese social on the price clock.** Xiaohongshu, Douyin, Weibo and Zhihu posts are collected and linked, and the timestamped ones sit on the same minute timeline as US prices. None of Bloomberg Terminal, Dataminr, AlphaSense or Benzinga Pro advertises this on its public pages.
- **Sourced pitch.** Every competitor number on our home page and pricing page links to a public source.

### What we learned

- One aggregation API changes what a small team can build. The hard part shifts from collecting data to ranking and grounding it.
- Cached input tokens and run memory make agentic research affordable.
- Investors and traders want the same thing: the earliest credible source, not the loudest one.

### What's next

**Business model.** Price = measured cost ÷ 0.4, a 60% gross margin after card fees (2.9% + $0.30). Every plan gets every capability, including the API. Plans differ only in how many fresh runs they include, and cached briefs are unlimited.

| Plan | Price | Fresh runs | Gross margin |
|---|---|---|---|
| Free | $0 | 5 a month | acquisition cost |
| Pro | $49 per seat per month | 80 a month, then $0.55 a run | 80 × $0.22 = $17.60 cost, ≈ 61% |
| Desk | $199 per seat per month | 330 a month | 330 × $0.22 = $72.60 cost, ≈ 60% |
| API | $0.55 per fresh run, no seat fee | pay as you go | $0.22 ÷ 0.4 = $0.55, 60% |

Pro costs 1/54 of a Bloomberg Terminal seat ($2,665 a month).

**Product.**

- Telem monitors that push an alert the moment a story starts spreading.
- Watchlists.
- Japanese and Korean platforms.
- A backtest that measures how far social posts lead the price.

## Sources

- Bloomberg Terminal price: https://connect.neugroup.com/public/blogs/bloomberg-terminals-how-much-more-youll-pay-next-year
- Bloomberg social sentiment (X/Twitter): https://www.bloomberg.com/company/press/trending-on-twitter-social-sentiment-analytics
- Dataminr: https://www.dataminr.com/press/announcement/dataminr-announces-100m-investment-from-fortress/
- AlphaSense contracts (Vendr): https://www.vendr.com/marketplace/alphasense
- Benzinga Pro prices: https://www.liberatedstocktrader.com/benzinga-discount-coupon-code/
- Telem pricing: https://docs.telem.ai/pricing
- Telem supported platforms: https://docs.telem.ai/resources/supported-platforms/
- GPT-5.4 mini pricing: https://openai.com/index/introducing-gpt-5-4-mini-and-nano/

## Gallery images (suggested screenshots, 3:2)

1. Home page: the Jensen Huang week replay with NVDA and the platform lanes (https://search.chaorders.com).
2. A research brief with the Telem trace and Memory panels (https://search.chaorders.com/research, open any showcase run).
3. /stock/nvda with news and posts pinned to the price.
4. /pricing: plan cards and the comparison table.

## Before submitting

- [ ] Demo video URL (the home page still shows "Demo video · coming soon").
- [ ] The live site shows the current prices ($49, $199, $0.55 on /pricing; 1/54 on the home page).
