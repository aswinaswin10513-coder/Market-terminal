#!/usr/bin/env python3
"""
INVICTA-REIGN Market Terminal - data robot v3.

- Funds: name only; robot finds the scheme code itself (mfapi.in).
- FX (USD/INR): European Central Bank feed via frankfurter.app - free, no key.
- News: Google News India RSS - free, no key.
- Track-and-alert only. Never logs into any broker. Never trades.
"""

import json
import os
import time
import datetime
import urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
      "Accept": "*/*"}


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


# ---- Find a fund's scheme code from its name (mfapi.in) ----
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
            print("fund loose match:", name, "->",
                  results[0].get("schemeCode"),
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


# ---- FX via frankfurter.app (European Central Bank data, free, no key) ----
def fetch_fx(cfg):
    out = []
    dp = default_pct(cfg)
    for m in cfg.get("fx", []):
        price, prev = None, None
        cur_to = m.get("to", "INR")
        try:
            start = (datetime.date.today()
                     - datetime.timedelta(days=10)).isoformat()
            r = requests.get(f"https://api.frankfurter.app/{start}..",
                             params={"from": m.get("from", "USD"),
                                     "to": cur_to},
                             headers=UA, timeout=25)
            rates = r.json().get("rates", {})
            days = sorted(rates.keys())
            vals = [rates[d].get(cur_to) for d in days
                    if rates[d].get(cur_to) is not None]
            if vals:
                price = vals[-1]
            if len(vals) > 1:
                prev = vals[-2]
        except Exception as e:
            print("fx error", m.get("name"), e)
        row = {"name": m.get("name", "FX"), "price": price,
               "change_pct": pct(price, prev), "alert": False}
        th = m.get("alert_pct", dp)
        if row["change_pct"] is not None and abs(row["change_pct"]) >= th:
            row["alert"] = True
        out.append(row)
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


# ---- News via Google News India RSS (free, no key) ----
def fetch_news(cfg):
    out = []
    for t in cfg.get("news_topics", []):
        try:
            url = ("https://news.google.com/rss/search?q="
                   + urllib.parse.quote(t["query"])
                   + "&hl=en-IN&gl=IN&ceid=IN:en")
            r = requests.get(url, headers=UA, timeout=30)
            if r.status_code != 200:
                print("news status", t.get("label"), r.status_code)
                continue
            root = ET.fromstring(r.content)
            count = 0
            for item in root.iter("item"):
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                pub = (item.findtext("pubDate") or "").strip()
                src = item.find("source")
                domain = (src.text.strip()
                          if src is not None and src.text else "news")
                try:
                    seen = parsedate_to_datetime(pub).strftime("%Y%m%dT%H%M%SZ")
                except Exception:
                    seen = ""
                if title and link:
                    out.append({"title": title, "url": link,
                                "domain": domain,
                                "topic": t.get("label", ""),
                                "seendate": seen})
                    count += 1
                if count >= 10:
                    break
            time.sleep(1)
        except Exception as e:
            print("news error", t.get("label"), e)
    seen_urls, dd = set(), []
    for a in out:
        if a["url"] in seen_urls:
            continue
        seen_urls.add(a["url"])
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
    market = fetch_fx(cfg)
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
