import json
import urllib.request
import urllib.parse
from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import FoodLog
from dependencies import require_auth

router = APIRouter(prefix="/api/calories", tags=["calories"])


def _fetch_off(url: str) -> dict:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "life-os/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Open Food Facts nicht erreichbar: {e}")


def _parse_product(p: dict) -> dict:
    n = p.get("nutriments", {})
    kcal = n.get("energy-kcal_100g") or (n.get("energy_100g", 0) / 4.184)
    return {
        "name":             p.get("product_name") or p.get("product_name_de") or "",
        "brand":            ", ".join(p["brands"]) if isinstance(p.get("brands"), list) else p.get("brands", ""),
        "kcal_per_100g":    round(float(kcal or 0), 1),
        "protein_per_100g": round(float(n.get("proteins_100g") or 0), 1),
        "fat_per_100g":     round(float(n.get("fat_100g") or 0), 1),
        "carbs_per_100g":   round(float(n.get("carbohydrates_100g") or 0), 1),
    }


class FoodLogCreate(BaseModel):
    date:             Optional[str] = None
    name:             str
    brand:            Optional[str] = ""
    grams:            float
    kcal_per_100g:    float
    protein_per_100g: Optional[float] = 0
    fat_per_100g:     Optional[float] = 0
    carbs_per_100g:   Optional[float] = 0


class FoodLogOut(BaseModel):
    id:         UUID
    date:       date_type
    name:       str
    brand:      Optional[str]
    grams:      float
    kcal:       float
    protein:    Optional[float]
    fat:        Optional[float]
    carbs:      Optional[float]

    class Config:
        from_attributes = True


@router.get("/logs", response_model=list[FoodLogOut])
def get_logs(date: str = Query(...), db: Session = Depends(get_db), _=Depends(require_auth)):
    d = date_type.fromisoformat(date)
    return db.query(FoodLog).filter(FoodLog.date == d).order_by(FoodLog.created_at).all()


@router.post("/logs", response_model=FoodLogOut)
def create_log(data: FoodLogCreate, db: Session = Depends(get_db), _=Depends(require_auth)):
    d = date_type.fromisoformat(data.date) if data.date else date_type.today()
    g = data.grams
    entry = FoodLog(
        date=d,
        name=data.name,
        brand=data.brand or "",
        grams=g,
        kcal=round(data.kcal_per_100g * g / 100, 1),
        protein=round((data.protein_per_100g or 0) * g / 100, 1),
        fat=round((data.fat_per_100g or 0) * g / 100, 1),
        carbs=round((data.carbs_per_100g or 0) * g / 100, 1),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/logs/{log_id}", status_code=204)
def delete_log(log_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    entry = db.query(FoodLog).filter(FoodLog.id == log_id).first()
    if not entry:
        raise HTTPException(status_code=404)
    db.delete(entry)
    db.commit()


@router.get("/scan/{barcode}")
def scan_barcode(barcode: str, _=Depends(require_auth)):
    data = _fetch_off(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json")
    if data.get("status") != 1 or not data.get("product"):
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    return _parse_product(data["product"])


@router.get("/search")
def search_food(q: str = Query(...), _=Depends(require_auth)):
    params = urllib.parse.urlencode({
        "q":         q,
        "fields":    "product_name,brands,nutriments,lang",
        "page_size": "20",
    })
    data = _fetch_off(f"https://search.openfoodfacts.org/search?{params}")
    de_results, other_results = [], []
    for p in data.get("hits", []):
        parsed = _parse_product(p)
        if parsed["kcal_per_100g"] > 0 and parsed["name"]:
            (de_results if p.get("lang") == "de" else other_results).append(parsed)
    return (de_results + other_results)[:6]
