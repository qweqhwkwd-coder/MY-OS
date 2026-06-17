"""REST API для Mini App. Всі ендпоїнти перевіряють initData від Telegram."""

import hashlib
import hmac
import json
from urllib.parse import parse_qsl, unquote

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from config import settings
from db import (
    add_water,
    complete_task,
    get_food_today,
    get_rituals,
    get_rituals_done_today,
    get_ritual_streaks,
    get_tasks,
    get_tasks_done_today,
    get_user_stats,
    get_water_today,
    get_week_digest,
    ensure_user,
    toggle_ritual,
    add_xp,
)

router = APIRouter(prefix="/api")


def verify_init_data(init_data: str) -> dict:
    """Перевіряє підпис initData від Telegram WebApp. Повертає user dict."""
    if not init_data:
        raise HTTPException(status_code=401, detail="No init data")

    parsed = dict(parse_qsl(unquote(init_data), keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="No hash in init data")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )

    secret_key = hmac.new(
        key=b"WebAppData", msg=settings.bot_token.encode(), digestmod=hashlib.sha256
    ).digest()
    computed_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256
    ).hexdigest()


    if not hmac.compare_digest(computed_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid init data signature")

    user_json = parsed.get("user", "{}")
    try:
        tg_user = json.loads(user_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=401, detail="Invalid user in init data")

    if not tg_user.get("id"):
        raise HTTPException(status_code=401, detail="No user id")

    return tg_user


def get_current_user(
    x_telegram_init_data: str = Header(default=""),
) -> dict:
    tg_user = verify_init_data(x_telegram_init_data)
    full_name = f"{tg_user.get('first_name', '')} {tg_user.get('last_name', '')}".strip()
    return ensure_user(tg_user["id"], full_name or "User")


# --- Ендпоїнти ----------------------------------------------------------------

@router.get("/today")
def api_today(user: dict = Depends(get_current_user)):
    uid = user["id"]
    water = get_water_today(uid)
    rituals = get_rituals(uid)
    done_set = get_rituals_done_today(uid)
    tasks_done = get_tasks_done_today(uid)
    food = get_food_today(uid)
    kcal = sum(e["kcal"] for e in food if e.get("kcal") is not None)
    stats = get_user_stats(uid)
    return {
        "level": stats["level"],
        "water": water,
        "water_goal": user["water_goal"],
        "rituals_done": sum(1 for r in rituals if r["id"] in done_set),
        "rituals_total": len(rituals),
        "tasks_done": tasks_done,
        "kcal": kcal,
    }


@router.get("/stats")
def api_stats(user: dict = Depends(get_current_user)):
    return get_user_stats(user["id"])


@router.get("/water")
def api_water(user: dict = Depends(get_current_user)):
    return {"total": get_water_today(user["id"]), "goal": user["water_goal"]}


class WaterIn(BaseModel):
    amount: int


@router.post("/water")
def api_add_water(body: WaterIn, user: dict = Depends(get_current_user)):
    if body.amount not in (250, 500, 1000):
        raise HTTPException(status_code=400, detail="amount must be 250, 500 or 1000")
    uid = user["id"]
    before = get_water_today(uid)
    total = add_water(uid, body.amount)
    if before < user["water_goal"] <= total:
        add_xp(uid, "health", 2, "water")
    return {"total": total}


@router.get("/rituals")
def api_rituals(user: dict = Depends(get_current_user)):
    uid = user["id"]
    rituals = get_rituals(uid)
    done_set = get_rituals_done_today(uid)
    streaks = get_ritual_streaks(uid)
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "icon": r.get("icon"),
            "done": r["id"] in done_set,
            "streak": streaks.get(r["id"], 0),
        }
        for r in rituals
    ]


@router.post("/rituals/{ritual_id}/toggle")
def api_toggle_ritual(ritual_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    now_done = toggle_ritual(ritual_id, uid)
    if now_done:
        add_xp(uid, "discipline", 2, "rituals")
    return {"done": now_done}


@router.get("/tasks")
def api_tasks(user: dict = Depends(get_current_user)):
    return get_tasks(user["id"])


@router.post("/tasks/{task_id}/complete")
def api_complete_task(task_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    done = complete_task(task_id, uid)
    if done:
        add_xp(uid, "discipline", 3, "tasks")
    return {"done": done}


@router.get("/food")
def api_food(user: dict = Depends(get_current_user)):
    return get_food_today(user["id"])


@router.get("/digest")
def api_digest(user: dict = Depends(get_current_user)):
    return get_week_digest(user["id"])
