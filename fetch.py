#!/usr/bin/env python3
"""
INVICTA-REIGN Market Terminal - data robot v2.

- Mutual funds: give only the NAME in config.json; the robot finds the
  scheme code itself from mfapi.in and fetches the NAV.
- Track-and-alert only. Never logs into any broker. Never trades.
"""

import json
import os
import time
import datetime
import urllib.parse
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
      "Accept": "application/json,text/plain,*/*"}


def load_config():
    with open(os.path.join(HERE, "config.json"), "r", encoding="utf-8") as f:
        return json.load(f)


def default_pct(cfg):
    return cfg.get("settings", {}).get("default_alert_pct", 4)


def pct(new, old):
    try:
        if old in (0, None) or new is None:
            return None
        return round((new - old) / old * 100, 2)
    except Exception:
        return None


# ---- Find a fund's scheme code from its name (mfapi.in, free) ----
def resolve_scheme_code(name):
    if not name:
        return ""
    try:
        r = requests.get("https://api.mfapi.in/mf/search",
                         params={"q": name}, headers=UA, timeout=25)
        results = r.json()
        words = [w.lower() for w in name.split()]
        for item in results:
            sn = str(item.get("schemeName", "")).lower()
            if all(w in sn for w in words):
                print("fund match:", name, "->", item.get("schemeCode"),
                      "|", item.get("schemeName"))
                return str(item.get("schemeCode", ""))
        if results:
            print("fund loose match:", name, "->", results[0].get("schemeCode"),
                  "|", results[0].get("schemeName"))
            return str(results[0].get("schemeCode", ""))
        print("fund NOT found:", name)
    except Exception as e:
        print("fund search error", name, e)
    return ""


# ---- Mutual funds via mfapi.in ----
def fetch_funds(cfg):
    out = []
    dp = default_pct(cfg)
    for fnd in cfg.get("mutual_funds", []):
        code = str(fnd.get("scheme_code", "")).strip()
        if not code.isdigit():
            code = resolve_scheme_code(fnd.get("name", ""))
        row = {"name": fnd.get("name", "Fund"), "nav": None,
               "change_pct": None, "alert": False}
        if code.isdigit():
            try:
                r = requests.get(f"https://api.mfapi.in/mf/{code}",
                                 headers=UA, timeout=25)
                d = r.json().get("data", [])
                if d:
                    nav0 = float(d[0]["nav"])
                    row["nav"] = nav0
                    if len(d) > 1:
                        row["change_pct"] = pct(nav0, float(d[1]["nav"]))
            except Exception as e:
                print("fund nav error", code, e)
        th = fnd.get("alert_pct", dp)
        if row["change_pct"] is not None and abs(row["change_pct"]) >= th:
            row["alert"] = True
        out.append(row)
    return out


# ---- Market (index / gold / fx) via Yahoo chart endpoint ----
def yahoo_quote(ticker):
    for host in ("query1", "query2"):
        for attempt in (1, 2):
            try:
                url = (f"https://{host}.finance.yahoo.com/v8/finance/chart/"
                       f"{urllib.parse.quote(ticker)}?range=5d&interval=1d")
                r = requests.get(url, headers=UA, timeout=25)
                if r.status_code != 200:
                    print("yahoo status", ticker, host, r.status_code)
                    time.sleep(2)
                    continue
                meta = r.json()["chart"]["result"][0]["meta"]
                price = meta.get("regularMarketPrice")
                prev = meta.get("chartPreviousClose") or meta.get("previousClose")
                if price is not None:
                    return price, prev
            except Exception as e:
                print("yahoo error", ticker, host, e)
                time.sleep(2)
    return None, None


def fetch_market(cfg):
    out = []
    dp = default_pct(cfg)
    for m in cfg.get("yahoo", []):
        price, prev = yahoo_quote(m["ticker"])
        row = {"name": m.get("name", m["ticker"]), "price": price,
               "change_pct": pct(price, prev), "alert": False}
        th = m.get("alert_pct", dp)
        if row["change_pct"] is not None and abs(row["change_pct"]) >= th:
            row["alert"] = True
        out.append(row)
        time.sleep(1)
    return out


# ---- Commodity mandi prices via data.gov.in (needs free key; skipped if none) ----
def fetch_commodities(cfg):
    out = []
    key = (cfg.get("data_gov_key") or "").strip()
    if not key:
        return out
    res = "9ef84268-d588-465a-a308-a864a43d0070"
    for c in cfg.get("commodities_mandi", []):
        row = {"name": c.get("name", c.get("commodity", "")), "price": None,
               "market": "", "change_pct": None, "alert": False}
        try:
            params = {"api-key": key, "format": "json", "limit": 20,
                      "filters[commodity]": c["commodity"]}
            if c.get("state"):
                params["filters[state]"] = c["state"]
            r = requests.get(f"https://api.data.gov.in/resource/{res}",
                             params=params, headers=UA, timeout=25)
            recs = r.json().get("records", [])
            if recs:
                rec = recs[0]
                row["price"] = float(rec.get("modal_price") or 0) or None
                row["market"] = f'{rec.get("market", "")}, {rec.get("state", "")}'.strip(", ")
        except Exception as e:
            print("mandi error", c.get("commodity"), e)
        out.append(row)
    return out


# ---- News via GDELT (free, no key) ----
def fetch_news(cfg):
    out = []
    for t in cfg.get("news_topics", []):
        try:
            url = ("https://api.gdeltproject.org/api/v2/doc/doc?query="
                   + urllib.parse.quote(t["query"])
                   + "&mode=ArtList&format=json&maxrecords=10&timespan=4d&sort=DateDesc")
            r = requests.get(url, headers=UA, timeout=30)
            try:
                arts = r.json().get("articles", [])
            except Exception:
                print("news non-json for", t.get("label"), r.status_code)
                arts = []
            for a in arts:
                out.append({"title": a.get("title", ""), "url": a.get("url", ""),
                            "domain": (a.get("domain", "news") or "news").replace("www.", ""),
                            "topic": t.get("label", ""),
                            "seendate": a.get("seendate", "")})
            time.sleep(1)
        except Exception as e:
            print("news error", t.get("label"), e)
    seen, dd = set(), []
    for a in out:
        if a["url"] in seen:
            continue
        seen.add(a["url"])
        dd.append(a)
    dd.sort(key=lambda x: x.get("seendate", ""), reverse=True)
    return dd[:40]


def build_alerts(funds, market, commodities):
    alerts = []
    for r in funds:
        if r["alert"]:
            alerts.append(f'{r["name"]}: NAV {r["change_pct"]:+.1f}%')
    for r in market + commodities:
        if r["alert"]:
            alerts.append(f'{r["name"]}: {r["change_pct"]:+.1f}%')
    return alerts


def send_telegram(alerts, news):
    token = os.environ.get("TELEGRAM_TOKEN", "").strip()
    chat = os.environ.get("TELEGRAM_CHAT", "").strip()
    if not token or not chat:
        print("Telegram not configured - skipping push.")
        return
    lines = ["*INVICTA-REIGN Terminal*"]
    if alerts:
        lines.append("\n\u26a1 *Price alerts*")
        lines += [f"\u2022 {a}" for a in alerts]
    else:
        lines.append("\nNo price alerts crossed your limit today.")
    if news:
        lines.append("\n\U0001F4F0 *Top news*")
        for a in news[:3]:
            lines.append(f'\u2022 [{a["topic"]}] {a["title"]}')
    try:
        requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                      json={"chat_id": chat, "text": "\n".join(lines),
                            "parse_mode": "Markdown",
                            "disable_web_page_preview": True},
                      timeout=25)
        print("Telegram sent.")
    except Exception as e:
        print("telegram error", e)


def main():
    cfg = load_config()
    funds = fetch_funds(cfg)
    market = fetch_market(cfg)
    commodities = fetch_commodities(cfg)
    news = fetch_news(cfg)
    alerts = build_alerts(funds, market, commodities)
    data = {
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "funds": funds, "market": market, "commodities": commodities,
        "news": news, "alerts": alerts,
    }
    with open(os.path.join(HERE, "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Wrote data.json: {len(funds)} funds, {len(market)} market, "
          f"{len(commodities)} commodities, {len(news)} news, {len(alerts)} alerts")
    send_telegram(alerts, news)


if __name__ == "__main__":
    main()
