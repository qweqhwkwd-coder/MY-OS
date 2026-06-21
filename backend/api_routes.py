"""REST API для Mini App. Всі ендпоїнти перевіряють initData від Telegram."""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from config import settings
from db import (
    DEFAULT_WATER_GOAL,
    RANKS,
    STATS,
    add_food,
    add_inbox,
    add_task,
    add_water,
    calculate_hp,
    complete_task,
    get_food_today,
    get_rank,
    get_rituals,
    get_rituals_done_today,
    get_ritual_streaks,
    get_streak,
    get_tasks,
    get_tasks_done_today,
    get_user_stats,
    get_water_today,
    get_week_digest,
    get_xp_today,
    ensure_user,
    toggle_ritual,
    add_xp,
)

router = APIRouter(prefix="/api")


def verify_init_data(init_data: str) -> dict:
    """Перевіряє підпис initData від Telegram WebApp. Повертає user dict."""
    if not init_data:
        raise HTTPException(status_code=401, detail="No init data")

    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
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

    auth_date = parsed.get("auth_date", "0")
    if not auth_date.isdigit() or (time.time() - int(auth_date)) > 3600:
        raise HTTPException(status_code=401, detail="Init data expired")

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
        "water_goal": user.get("water_goal") or DEFAULT_WATER_GOAL,
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
    return {"total": get_water_today(user["id"]), "goal": user.get("water_goal") or DEFAULT_WATER_GOAL}


class WaterIn(BaseModel):
    amount: int


@router.post("/water")
def api_add_water(body: WaterIn, user: dict = Depends(get_current_user)):
    if body.amount not in (250, 500, 1000):
        raise HTTPException(status_code=400, detail="amount must be 250, 500 or 1000")
    uid = user["id"]
    before = get_water_today(uid)
    total = add_water(uid, body.amount)
    if before < (user.get("water_goal") or DEFAULT_WATER_GOAL) <= total:
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
    now_done, xp_eligible = toggle_ritual(ritual_id, uid)
    if xp_eligible:
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


@router.get("/profile")
def api_profile(user: dict = Depends(get_current_user)):
    uid = user["id"]
    stats = get_user_stats(uid)
    avg_xp = sum(stats[s] for s in STATS) / 8
    rank_data = get_rank(avg_xp)
    hp = calculate_hp(uid)
    xp_today = get_xp_today(uid)
    streak = get_streak(uid)
    return {
        "name": user.get("name", ""),
        "level": stats["level"],
        "xp_total": int(sum(stats[s] for s in STATS)),
        "xp_today": xp_today,
        "streak": streak,
        "hp": hp,
        **rank_data,
        "stats": {s: stats[s] for s in STATS},
    }


class TaskIn(BaseModel):
    title: str


@router.post("/tasks")
def api_create_task(body: TaskIn, user: dict = Depends(get_current_user)):
    return add_task(user["id"], body.title)


class InboxIn(BaseModel):
    text: str


@router.post("/inbox")
def api_add_inbox(body: InboxIn, user: dict = Depends(get_current_user)):
    return add_inbox(user["id"], body.text)


class FoodIn(BaseModel):
    food_name: str
    kcal: int
    grams: int | None = None


@router.post("/food")
def api_add_food_entry(body: FoodIn, user: dict = Depends(get_current_user)):
    return add_food(user["id"], body.food_name, body.kcal, body.grams)
