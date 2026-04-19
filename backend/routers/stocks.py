import json
import os
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import StockWatchlist, StockAnalysisCache
from dependencies import require_auth

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

AV_KEY   = os.getenv("ALPHA_VANTAGE_API_KEY", "")
AV_BASE  = "https://www.alphavantage.co/query"
CACHE_TTL = 6  # hours


# ── Alpha Vantage helper ───────────────────────────────────────────────────────

def _av(params: dict) -> dict:
    if not AV_KEY:
        raise HTTPException(status_code=503, detail="ALPHA_VANTAGE_API_KEY nicht konfiguriert")
    params["apikey"] = AV_KEY
    url = AV_BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "life-os/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Alpha Vantage nicht erreichbar: {e}")
    if "Error Message" in data:
        raise HTTPException(status_code=404, detail=data["Error Message"])
    if "Note" in data or "Information" in data:
        raise HTTPException(status_code=429, detail="Alpha Vantage Rate Limit erreicht — bitte warte eine Minute")
    return data


# ── Regime calculation (pure pandas) ──────────────────────────────────────────

def _regime(symbol: str) -> tuple[str, str, float]:
    """Returns (regime_label, risk_tag, current_price)"""
    data = _av({"function": "TIME_SERIES_DAILY", "symbol": symbol, "outputsize": "compact"})
    ts = data.get("Time Series (Daily)", {})
    if not ts:
        raise HTTPException(status_code=404, detail=f"Keine Preisdaten für {symbol}")

    rows = [
        {
            "date":  pd.Timestamp(d),
            "close": float(v["4. close"]),
            "high":  float(v["2. high"]),
            "low":   float(v["3. low"]),
        }
        for d, v in ts.items()
    ]
    df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)

    close, high, low = df["close"], df["high"], df["low"]
    n = len(df)

    # Trend: SMA of daily returns (up to 60 bars, min 20)
    trend_window = min(60, n - 1)
    returns   = close.pct_change()
    trend_sma = returns.rolling(trend_window).mean()

    # NATR: ATR(14) / close * 100
    prev  = close.shift(1)
    tr    = pd.concat([high - low, (high - prev).abs(), (low - prev).abs()], axis=1).max(axis=1)
    atr   = tr.rolling(14).mean()
    natr  = atr / close * 100

    # Volatility threshold: 70th percentile over all available bars
    vol_thresh = natr.rolling(n).quantile(0.70)

    trend_bull = bool(trend_sma.iloc[-1] > 0) if not pd.isna(trend_sma.iloc[-1]) else True
    vol_low    = bool(natr.iloc[-1] <= vol_thresh.iloc[-1]) if not pd.isna(vol_thresh.iloc[-1]) else True

    if   trend_bull and     vol_low: regime, risk = "Bull_LowVol",  "LOW"
    elif trend_bull and not vol_low: regime, risk = "Bull_HighVol", "MEDIUM"
    elif not trend_bull and vol_low: regime, risk = "Bear_LowVol",  "HIGH"
    else:                            regime, risk = "Bear_HighVol", "VERY_HIGH"

    return regime, risk, round(float(close.iloc[-1]), 2)


# ── News sentiment ─────────────────────────────────────────────────────────────

def _news(symbol: str) -> tuple[str, list[dict]]:
    """Returns (news_signal, articles[:10])"""
    try:
        data = _av({"function": "NEWS_SENTIMENT", "tickers": symbol, "sort": "LATEST", "limit": "50"})
    except HTTPException:
        return "NEUTRAL", []
    feed = data.get("feed", [])

    scores = []
    articles = []
    for art in feed:
        for ts in art.get("ticker_sentiment", []):
            if ts.get("ticker") == symbol and float(ts.get("relevance_score", 0)) >= 0.5:
                scores.append(float(ts.get("ticker_sentiment_score", 0)))
        pub = art.get("time_published", "")
        articles.append({
            "title":           art.get("title", ""),
            "source":          art.get("source", ""),
            "url":             art.get("url", ""),
            "published":       f"{pub[0:4]}-{pub[4:6]}-{pub[6:8]}" if len(pub) >= 8 else "",
            "sentiment":       art.get("overall_sentiment_label", "Neutral"),
            "sentiment_score": round(float(art.get("overall_sentiment_score", 0)), 3),
        })

    avg = sum(scores) / len(scores) if scores else 0.0
    if   avg >= 0.15:  signal = "BULLISH"
    elif avg <= -0.15: signal = "BEARISH"
    else:              signal = "NEUTRAL"

    return signal, articles[:10]


# ── Recommendation matrix ──────────────────────────────────────────────────────

_RECO = {
    ("BULLISH", "Bull_LowVol"):  "STRONG_BUY",
    ("BULLISH", "Bull_HighVol"): "BUY",
    ("BULLISH", "Bear_LowVol"):  "HOLD",
    ("BULLISH", "Bear_HighVol"): "HOLD",
    ("NEUTRAL", "Bull_LowVol"):  "HOLD",
    ("NEUTRAL", "Bull_HighVol"): "HOLD",
    ("NEUTRAL", "Bear_LowVol"):  "SELL",
    ("NEUTRAL", "Bear_HighVol"): "SELL",
    ("BEARISH", "Bull_LowVol"):  "SELL",
    ("BEARISH", "Bull_HighVol"): "SELL",
    ("BEARISH", "Bear_LowVol"):  "SELL",
    ("BEARISH", "Bear_HighVol"): "STRONG_SELL",
}


def _analyse(symbol: str) -> dict:
    regime, risk, price = _regime(symbol)
    time.sleep(1.5)  # free tier: 1 req/sec
    news_signal, articles = _news(symbol)
    return {
        "regime":         regime,
        "risk_tag":       risk,
        "news_signal":    news_signal,
        "recommendation": _RECO.get((news_signal, regime), "HOLD"),
        "price":          price,
        "news":           articles,
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/search")
def search_symbols(q: str, _=Depends(require_auth)):
    url = f"https://query1.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(q)}&quotesCount=8&newsCount=0"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Yahoo Finance nicht erreichbar: {e}")
    return [
        {
            "symbol": q["symbol"],
            "name":   q.get("shortname") or q.get("longname") or q["symbol"],
            "region": q.get("exchDisp", ""),
        }
        for q in data.get("quotes", [])
        if q.get("quoteType") == "EQUITY"
    ][:6]


class StockAdd(BaseModel):
    symbol: str
    name:   str = ""


def _cache_to_dict(s: StockWatchlist, c: Optional[StockAnalysisCache]) -> dict:
    entry: dict = {"symbol": s.symbol, "name": s.name, "cached": False, "stale": True}
    if c:
        age = (datetime.utcnow() - c.updated_at).total_seconds() / 3600
        entry.update({
            "cached":         True,
            "stale":          age > CACHE_TTL,
            "regime":         c.regime,
            "risk_tag":       c.risk_tag,
            "news_signal":    c.news_signal,
            "recommendation": c.recommendation,
            "price":          c.price,
            "updated_at":     c.updated_at.isoformat() + "Z",
            "news":           json.loads(c.news_json) if c.news_json else [],
        })
    return entry


@router.get("/")
def list_stocks(db: Session = Depends(get_db), _=Depends(require_auth)):
    stocks = db.query(StockWatchlist).order_by(StockWatchlist.added_at).all()
    symbols = [s.symbol for s in stocks]
    caches = {
        c.symbol: c
        for c in db.query(StockAnalysisCache).filter(StockAnalysisCache.symbol.in_(symbols)).all()
    }
    return [_cache_to_dict(s, caches.get(s.symbol)) for s in stocks]


@router.post("/")
def add_stock(body: StockAdd, db: Session = Depends(get_db), _=Depends(require_auth)):
    symbol = body.symbol.upper().strip()
    if db.query(StockWatchlist).filter(StockWatchlist.symbol == symbol).first():
        raise HTTPException(status_code=409, detail="Aktie bereits in der Watchlist")

    db.add(StockWatchlist(symbol=symbol, name=body.name or symbol))
    db.commit()
    return {"symbol": symbol, "name": body.name or symbol}


@router.delete("/{symbol}", status_code=204)
def remove_stock(symbol: str, db: Session = Depends(get_db), _=Depends(require_auth)):
    symbol = symbol.upper()
    stock = db.query(StockWatchlist).filter(StockWatchlist.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404)
    db.query(StockAnalysisCache).filter(StockAnalysisCache.symbol == symbol).delete()
    db.delete(stock)
    db.commit()


@router.post("/{symbol}/refresh")
def refresh_stock(symbol: str, db: Session = Depends(get_db), _=Depends(require_auth)):
    symbol = symbol.upper()
    if not db.query(StockWatchlist).filter(StockWatchlist.symbol == symbol).first():
        raise HTTPException(status_code=404)

    result = _analyse(symbol)

    cache = db.query(StockAnalysisCache).filter(StockAnalysisCache.symbol == symbol).first()
    if not cache:
        cache = StockAnalysisCache(symbol=symbol)
        db.add(cache)

    cache.regime         = result["regime"]
    cache.risk_tag       = result["risk_tag"]
    cache.news_signal    = result["news_signal"]
    cache.recommendation = result["recommendation"]
    cache.price          = result["price"]
    cache.news_json      = json.dumps(result["news"], ensure_ascii=False)
    cache.updated_at     = datetime.utcnow()
    db.commit()

    return {
        "symbol":         symbol,
        "cached":         True,
        "stale":          False,
        "regime":         cache.regime,
        "risk_tag":       cache.risk_tag,
        "news_signal":    cache.news_signal,
        "recommendation": cache.recommendation,
        "price":          cache.price,
        "updated_at":     cache.updated_at.isoformat() + "Z",
        "news":           result["news"],
    }
