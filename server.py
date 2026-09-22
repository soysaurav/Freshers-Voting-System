#!/usr/bin/env python3
"""
Y26 Freshers Event Voting & Live Stage Reveal System
High-performance async server using Tornado.
Supports:
1. Category-based peer voting with dramatic stage reveal
2. Live on-stage performer rating (1 to 10 points) with average score winner reveal
3. Synchronized nominee photos across all categories
"""

import os
import sys
import csv
import json
import socket
import ssl
import io
from datetime import datetime
import tornado.ioloop
import tornado.web
import tornado.websocket
import tornado.httpserver

try:
    from PIL import Image, ImageOps
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

def optimize_and_save_image(raw_bytes, dest_path, max_dim=(1000, 1000), quality=85):
    """
    Optimizes uploaded image:
    1. Handles mobile EXIF rotation so phone camera photos aren't rotated/frozen
    2. Resizes huge phone camera photos (e.g. 48MP down to max_dim)
    3. Saves with efficient compression to keep memory usage lightweight on phones and laptops
    """
    if not HAS_PIL:
        with open(dest_path, "wb") as f:
            f.write(raw_bytes)
        return

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img = ImageOps.exif_transpose(img)
        fmt = (img.format or "JPEG").upper()
        if fmt in ("PNG", "WEBP") and img.mode in ("RGBA", "LA"):
            img.thumbnail(max_dim, Image.Resampling.LANCZOS)
            img.save(dest_path, format="PNG", optimize=True)
        else:
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.thumbnail(max_dim, Image.Resampling.LANCZOS)
            img.save(dest_path, format="JPEG", quality=quality, optimize=True)
    except Exception as e:
        print(f"[Warn] Image optimization fallback: {e}")
        with open(dest_path, "wb") as f:
            f.write(raw_bytes)


if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "store.json")
CSV_FILE = os.path.join(BASE_DIR, "data", "freshers_list.csv")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
PORT = 3000

AVATAR_COLORS = [
    "#6366F1", "#EC4899", "#8B5CF6", "#06B6D4", 
    "#10B981", "#F59E0B", "#3B82F6", "#F43F5E",
    "#14B8A6", "#D946EF", "#F97316", "#0EA5E9"
]

def get_color_for_name(name):
    h = sum(ord(c) for c in name)
    return AVATAR_COLORS[h % len(AVATAR_COLORS)]

# -------------------------------------------------------------
# Freshers CSV Roster Loader
# -------------------------------------------------------------
def load_freshers_roster():
    roster = []
    if os.path.exists(CSV_FILE):
        try:
            with open(CSV_FILE, mode="r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader):
                    name = (row.get("name") or "").strip()
                    if not name:
                        continue
                    roster.append({
                        "id": f"fresher-{idx+1}",
                        "name": name,
                        "roll_no": (row.get("roll_no") or "").strip(),
                        "program": (row.get("program") or "").strip(),
                        "batch": (row.get("batch") or "").strip(),
                        "email": (row.get("email") or "").strip(),
                        "phone": (row.get("phone_number") or "").strip(),
                        "gender": (row.get("gender") or row.get("g") or row.get("Gender") or row.get("G") or "").strip().upper()
                    })
        except Exception as e:
            print(f"[ERROR] Could not parse freshers_list.csv: {e}")
    return roster

freshers_roster = load_freshers_roster()

# -------------------------------------------------------------
# Data Store Management
# -------------------------------------------------------------
class Store:
    def __init__(self, filepath):
        self.filepath = filepath
        self.data = {}
        self.load()

    def load(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
            except Exception as e:
                print(f"[ERROR] Could not load data store: {e}")
                self.data = self.default_data()
        else:
            self.data = self.default_data()
            self.save()

        # Ensure required keys exist
        self.data.setdefault("settings", {})
        self.data["settings"].setdefault("eventName", "Freshers' Night")
        self.data["settings"].setdefault("activeCategoryId", None)
        self.data["settings"].setdefault("votingOpen", True)
        self.data["settings"].setdefault("stageMode", "category") # "category" or "live_rating"
        self.data["settings"].setdefault("revealState", {
            "categoryId": None,
            "isRevealed": False,
            "countdownActive": False,
            "countdownSeconds": 3
        })
        self.data["settings"].setdefault("liveRating", {
            "activePerformerRoll": None,
            "isOpen": False,
            "revealState": {
                "isRevealed": False,
                "winner": None
            }
        })
        self.data.setdefault("categories", [])
        self.data.setdefault("candidates", [])
        self.data.setdefault("votes", [])
        self.data.setdefault("personPhotos", {})
        self.data.setdefault("performerRatings", [])
        self.data.setdefault("tasks", [])
        self.data["settings"].setdefault("activeTaskId", None)
        self.data["settings"].setdefault("activeTaskTitle", None)
        self.data["settings"].setdefault("stageCustomImage", None)
        self.data["settings"].setdefault("latentTitle", {"line1": "FRESHERS'", "line2": "GOT LATENT"})

        # Sync existing candidate photos into personPhotos map
        for c in self.data.get("candidates", []):
            roll = c.get("roll_no")
            photo = c.get("photo")
            if roll and photo and not self.data["personPhotos"].get(roll):
                self.data["personPhotos"][roll] = photo

        # Propagate personPhotos to all candidates
        for c in self.data.get("candidates", []):
            roll = c.get("roll_no")
            if roll and self.data["personPhotos"].get(roll):
                c["photo"] = self.data["personPhotos"][roll]

    def default_data(self):
        return {
            "settings": {
                "eventName": "Freshers' Night",
                "activeCategoryId": None,
                "votingOpen": True,
                "stageMode": "category",
                "revealState": {
                    "categoryId": None,
                    "isRevealed": False,
                    "countdownActive": False,
                    "countdownSeconds": 3
                },
                "liveRating": {
                    "activePerformerRoll": None,
                    "isOpen": False,
                    "revealState": {
                        "isRevealed": False,
                        "winner": None
                    }
                },
                "activeTaskId": None,
                "activeTaskTitle": None,
                "stageCustomImage": None,
                "latentTitle": {
                    "line1": "FRESHERS'",
                    "line2": "GOT LATENT"
                }
            },
            "categories": [],
            "candidates": [],
            "votes": [],
            "personPhotos": {},
            "performerRatings": [],
            "tasks": []
        }

    def save(self):
        try:
            os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
            temp_path = self.filepath + ".tmp"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            if os.path.exists(self.filepath):
                os.replace(temp_path, self.filepath)
            else:
                os.rename(temp_path, self.filepath)
        except Exception as e:
            print(f"[ERROR] Could not save data store: {e}")

store = Store(DATA_FILE)

# -------------------------------------------------------------
# WebSocket Hub & Broadcasting
# -------------------------------------------------------------
connected_clients = set()
connected_voters = set()

def broadcast(message_dict):
    msg_str = json.dumps(message_dict)
    dead_clients = []
    for client in connected_clients:
        try:
            client.write_message(msg_str)
        except Exception:
            dead_clients.append(client)
    for dc in dead_clients:
        connected_clients.discard(dc)
        connected_voters.discard(dc)

def get_broadcast_payload():
    # Enrich roster with photos from personPhotos
    enriched_roster = []
    photos = store.data.get("personPhotos", {})
    for p in freshers_roster:
        photo = photos.get(p["roll_no"], "")
        enriched_roster.append({
            **p,
            "photo": photo,
            "avatarColor": get_color_for_name(p["name"])
        })

    return {
        "type": "state",
        "data": {
            **store.data,
            "roster": enriched_roster,
            "onlineCount": len(connected_voters)
        }
    }

def broadcast_state():
    broadcast(get_broadcast_payload())

# -------------------------------------------------------------
# WebSocket Handler
# -------------------------------------------------------------
class VoteWebSocketHandler(tornado.websocket.WebSocketHandler):
    def check_origin(self, origin):
        return True

    def get_client_ip(self):
        xff = self.request.headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip()
        x_real_ip = self.request.headers.get("X-Real-IP")
        if x_real_ip:
            return x_real_ip.strip()
        return self.request.remote_ip or "127.0.0.1"

    def open(self):
        role = self.get_query_argument("role", "other")
        self.client_role = role
        self.client_ip = self.get_client_ip()
        connected_clients.add(self)
        if role == "voter":
            connected_voters.add(self)

        # Inform client of their IP address
        self.write_message(json.dumps({
            "type": "client_info",
            "data": {"ip": self.client_ip}
        }))

        # Send state with myIp included for this specific client
        payload = get_broadcast_payload()
        payload["data"]["myIp"] = self.client_ip
        self.write_message(json.dumps(payload))
        broadcast({"type": "online_count", "data": {"count": len(connected_voters)}})

    def on_close(self):
        connected_clients.discard(self)
        connected_voters.discard(self)
        broadcast({"type": "online_count", "data": {"count": len(connected_voters)}})

    def on_message(self, message):
        try:
            payload = json.loads(message)
            msg_type = payload.get("type")
            data = payload.get("data", {})

            if msg_type == "ping":
                self.write_message(json.dumps({"type": "pong"}))

            elif msg_type == "register_voter":
                self.client_role = "voter"
                connected_voters.add(self)
                broadcast({"type": "online_count", "data": {"count": len(connected_voters)}})

            # --- MODE 1: CATEGORY VOTING ---
            elif msg_type == "cast_vote":
                self.handle_cast_vote(data)

            elif msg_type == "add_category":
                self.handle_add_category(data)

            elif msg_type == "update_category":
                self.handle_update_category(data)

            elif msg_type == "delete_category":
                cat_id = data.get("categoryId")
                if cat_id:
                    store.data["categories"] = [c for c in store.data.get("categories", []) if c.get("id") != cat_id]
                    store.data["candidates"] = [c for c in store.data.get("candidates", []) if c.get("categoryId") != cat_id]
                    store.data["votes"] = [v for v in store.data.get("votes", []) if v.get("categoryId") != cat_id]
                    if store.data["settings"].get("activeCategoryId") == cat_id:
                        store.data["settings"]["activeCategoryId"] = store.data["categories"][0]["id"] if store.data["categories"] else None
                        store.data["settings"]["revealState"]["isRevealed"] = False
                        store.data["settings"]["revealState"]["categoryId"] = None
                    store.save()
                    broadcast_state()

            elif msg_type == "set_active_category":
                cat_id = data.get("categoryId")
                store.data["settings"]["activeCategoryId"] = cat_id
                store.data["settings"]["revealState"]["isRevealed"] = False
                store.data["settings"]["revealState"]["categoryId"] = None
                store.save()
                broadcast_state()

            elif msg_type == "set_voting_open":
                is_open = bool(data.get("votingOpen", True))
                store.data["settings"]["votingOpen"] = is_open
                store.save()
                broadcast_state()

            elif msg_type == "trigger_reveal":
                cat_id = data.get("categoryId") or store.data["settings"].get("activeCategoryId")
                self.handle_trigger_reveal(cat_id)

            elif msg_type == "reset_reveal":
                store.data["settings"]["revealState"]["isRevealed"] = False
                store.data["settings"]["revealState"]["categoryId"] = None
                store.data["settings"]["revealState"]["countdownActive"] = False
                store.save()
                broadcast_state()

            elif msg_type == "clear_category_votes":
                cat_id = data.get("categoryId")
                if cat_id:
                    store.data["votes"] = [v for v in store.data.get("votes", []) if v.get("categoryId") != cat_id]
                    store.data["settings"]["revealState"]["isRevealed"] = False
                    store.save()
                    broadcast_state()

            # --- STAGE DISPLAY MODES (Category, Live Rating, Latent Title, Task) ---
            elif msg_type == "set_stage_mode":
                mode = data.get("mode", "category")
                store.data["settings"]["stageMode"] = mode
                if "taskId" in data and data.get("taskId"):
                    task_id = data.get("taskId")
                    store.data["settings"]["activeTaskId"] = task_id
                    matching = next((t for t in store.data.get("tasks", []) if str(t.get("id")) == str(task_id)), None)
                    if matching:
                        store.data["settings"]["activeTaskTitle"] = matching.get("title")
                store.save()
                broadcast_state()

            elif msg_type == "add_task":
                title = (data.get("title") or "").strip()
                if title:
                    tasks = store.data.setdefault("tasks", [])
                    new_task = {
                        "id": f"task-{int(datetime.now().timestamp()*1000)}",
                        "title": title
                    }
                    tasks.append(new_task)
                    store.data["settings"]["activeTaskId"] = new_task["id"]
                    store.data["settings"]["activeTaskTitle"] = new_task["title"]
                    store.save()
                    broadcast_state()

            elif msg_type == "delete_task":
                task_id = data.get("taskId")
                if task_id:
                    tasks = [t for t in store.data.get("tasks", []) if str(t.get("id")) != str(task_id)]
                    store.data["tasks"] = tasks
                    if str(store.data["settings"].get("activeTaskId")) == str(task_id):
                        store.data["settings"]["activeTaskId"] = tasks[0]["id"] if tasks else None
                        store.data["settings"]["activeTaskTitle"] = tasks[0]["title"] if tasks else None
                    store.save()
                    broadcast_state()

            elif msg_type == "set_active_task":
                task_id = data.get("taskId")
                store.data["settings"]["activeTaskId"] = task_id
                matching = next((t for t in store.data.get("tasks", []) if str(t.get("id")) == str(task_id)), None)
                if matching:
                    store.data["settings"]["activeTaskTitle"] = matching.get("title")
                store.save()
                broadcast_state()

            elif msg_type == "update_latent_title":
                l1 = (data.get("line1") or "FRESHERS'").strip()
                l2 = (data.get("line2") or "GOT LATENT").strip()
                store.data["settings"]["latentTitle"] = {"line1": l1, "line2": l2}
                store.save()
                broadcast_state()

            elif msg_type == "set_active_performer":
                roll_no = data.get("rollNo")
                store.data["settings"]["liveRating"]["activePerformerRoll"] = roll_no
                store.data["settings"]["liveRating"]["revealState"]["isRevealed"] = False
                store.data["settings"]["liveRating"]["revealState"]["winner"] = None
                if roll_no:
                    store.data["settings"]["stageMode"] = "live_rating"
                store.save()
                broadcast_state()

            elif msg_type == "set_rating_line_open":
                is_open = bool(data.get("isOpen", False))
                store.data["settings"]["liveRating"]["isOpen"] = is_open
                store.save()
                broadcast_state()

            elif msg_type == "submit_performer_rating":
                self.handle_submit_performer_rating(data)

            elif msg_type == "trigger_performer_reveal":
                self.handle_trigger_performer_reveal(data)

            elif msg_type == "reset_performer_reveal":
                store.data["settings"]["liveRating"]["revealState"]["isRevealed"] = False
                store.data["settings"]["liveRating"]["revealState"]["winner"] = None
                store.save()
                broadcast_state()

            elif msg_type == "clear_performer_ratings":
                clear_all = data.get("clearAll", False)
                roll_no = data.get("rollNo") or data.get("roll_no")
                if roll_no and not clear_all:
                    store.data["performerRatings"] = [
                        r for r in store.data.get("performerRatings", [])
                        if r.get("rollNo") != roll_no and r.get("roll_no") != roll_no
                    ]
                else:
                    store.data["performerRatings"] = []
                store.save()
                broadcast_state()

        except Exception as e:
            print(f"[WS Error]: {e}")

    # --- Mode 1 Helpers ---
    def handle_add_category(self, data):
        title = data.get("title", "").strip()
        if not title:
            return

        cat_id = f"cat-{int(datetime.now().timestamp()*1000)}"
        new_cat = {
            "id": cat_id,
            "title": title,
            "description": data.get("description", "").strip(),
            "badge": data.get("badge", "👑 Award").strip() or "👑 Award"
        }
        store.data["categories"].append(new_cat)

        selected_roll_nos = data.get("selectedRollNos", [])
        select_all = data.get("selectAll", False)
        person_photos = store.data.get("personPhotos", {})

        for person in freshers_roster:
            if select_all or person["roll_no"] in selected_roll_nos:
                cand = {
                    "id": f"cand-{cat_id}-{person['roll_no'] or person['id']}",
                    "categoryId": cat_id,
                    "name": person["name"],
                    "roll_no": person["roll_no"],
                    "branch": person.get("program", ""),
                    "program": person.get("program", ""),
                    "bio": "",
                    "avatarColor": get_color_for_name(person["name"]),
                    "photo": person_photos.get(person["roll_no"], "")
                }
                store.data["candidates"].append(cand)

        if not store.data["settings"].get("activeCategoryId"):
            store.data["settings"]["activeCategoryId"] = cat_id

        store.save()
        broadcast_state()

    def handle_update_category(self, data):
        cat_id = data.get("categoryId")
        if not cat_id:
            return

        cat = next((c for c in store.data.get("categories", []) if c.get("id") == cat_id), None)
        if not cat:
            return

        # Update metadata
        if "title" in data and data["title"].strip():
            cat["title"] = data["title"].strip()
        if "badge" in data:
            cat["badge"] = data["badge"].strip() or "👑 Award"
        if "description" in data:
            cat["description"] = data["description"].strip()

        # Update nominees
        selected_roll_nos = data.get("selectedRollNos", [])
        select_all = data.get("selectAll", False)
        person_photos = store.data.get("personPhotos", {})

        store.data["candidates"] = [c for c in store.data.get("candidates", []) if c.get("categoryId") != cat_id]

        for person in freshers_roster:
            if select_all or person["roll_no"] in selected_roll_nos:
                cand = {
                    "id": f"cand-{cat_id}-{person['roll_no'] or person['id']}",
                    "categoryId": cat_id,
                    "name": person["name"],
                    "roll_no": person["roll_no"],
                    "branch": person.get("program", ""),
                    "program": person.get("program", ""),
                    "bio": "",
                    "avatarColor": get_color_for_name(person["name"]),
                    "photo": person_photos.get(person["roll_no"], "")
                }
                store.data["candidates"].append(cand)

        store.save()
        broadcast_state()

    def handle_cast_vote(self, data):
        if not store.data["settings"].get("votingOpen", True):
            self.write_message(json.dumps({
                "type": "toast",
                "data": {"message": "Voting is currently locked by the host!", "type": "error"}
            }))
            return

        client_ip = self.get_client_ip()
        voter_id = (data.get("voterId") or "").strip()
        cat_id = data.get("categoryId")
        cand_id = data.get("candidateId")

        if not cat_id or not cand_id:
            return

        # Track vote primarily by IP address with voterId fallback
        existing_index = None
        for i, v in enumerate(store.data.get("votes", [])):
            if v.get("categoryId") == cat_id:
                if (v.get("ipAddress") and v.get("ipAddress") == client_ip) or (voter_id and v.get("voterId") == voter_id):
                    existing_index = i
                    break

        new_vote = {
            "voterId": voter_id or f"ip-{client_ip}",
            "ipAddress": client_ip,
            "categoryId": cat_id,
            "candidateId": cand_id,
            "timestamp": datetime.now().isoformat()
        }

        if existing_index is not None:
            store.data["votes"][existing_index] = new_vote
        else:
            store.data["votes"].append(new_vote)

        store.save()
        broadcast_state()

    def handle_trigger_reveal(self, cat_id):
        if not cat_id:
            cat_id = store.data["settings"].get("activeCategoryId")
            if not cat_id and store.data.get("categories"):
                cat_id = store.data["categories"][0]["id"]

        candidates = [c for c in store.data.get("candidates", []) if c.get("categoryId") == cat_id]
        votes = [v for v in store.data.get("votes", []) if v.get("categoryId") == cat_id]
        total_votes = len(votes)

        # Ensure stageMode is category so the stage display switches to awards
        store.data["settings"]["stageMode"] = "category"
        store.data["settings"]["activeCategoryId"] = cat_id

        photos = store.data.get("personPhotos", {})
        tally = []
        for cand in candidates:
            c_votes = len([v for v in votes if v.get("candidateId") == cand.get("id")])
            pct = round((c_votes / total_votes) * 100) if total_votes > 0 else 0
            photo = photos.get(cand.get("roll_no"), cand.get("photo", ""))
            tally.append({**cand, "photo": photo, "votes": c_votes, "percentage": pct})

        tally.sort(key=lambda x: x["votes"], reverse=True)
        winner = tally[0] if tally else None

        if not winner:
            self.write_message(json.dumps({
                "type": "toast",
                "data": {
                    "message": "Cannot reveal winner: No votes or candidates recorded for this category!",
                    "type": "error"
                }
            }))
            return

        # Clear previous reveals
        store.data["settings"]["revealState"]["isRevealed"] = False
        store.data["settings"]["revealState"]["categoryId"] = cat_id
        store.save()
        broadcast_state()

        loop = tornado.ioloop.IOLoop.current()

        broadcast({"type": "countdown", "data": {"seconds": 3, "mode": "category", "categoryId": cat_id}})
        loop.call_later(1.0, lambda: broadcast({"type": "countdown", "data": {"seconds": 2, "mode": "category", "categoryId": cat_id}}))
        loop.call_later(2.0, lambda: broadcast({"type": "countdown", "data": {"seconds": 1, "mode": "category", "categoryId": cat_id}}))

        def do_reveal():
            store.data["settings"]["revealState"]["isRevealed"] = True
            store.data["settings"]["revealState"]["categoryId"] = cat_id
            store.save()
            broadcast({
                "type": "reveal",
                "data": {
                    "categoryId": cat_id,
                    "winner": winner,
                    "totalVotes": total_votes
                }
            })
            broadcast_state()

        loop.call_later(3.0, do_reveal)

    # --- Mode 2 Helpers: Live Performer Rating ---
    def handle_submit_performer_rating(self, data):
        if not store.data["settings"]["liveRating"].get("isOpen", False):
            self.write_message(json.dumps({
                "type": "toast",
                "data": {"message": "Rating line for this performance is closed!", "type": "error"}
            }))
            return

        client_ip = self.get_client_ip()
        voter_id = (data.get("voterId") or "").strip()
        roll_no = (data.get("rollNo") or data.get("roll_no") or "").strip()
        try:
            score = int(data.get("score", 0))
        except (ValueError, TypeError):
            return

        if not roll_no or score < 1 or score > 10:
            return

        ratings = store.data.get("performerRatings", [])
        existing_index = None
        for i, r in enumerate(ratings):
            if r.get("rollNo") == roll_no or r.get("roll_no") == roll_no:
                if (r.get("ipAddress") and r.get("ipAddress") == client_ip) or (voter_id and r.get("voterId") == voter_id):
                    existing_index = i
                    break

        entry = {
            "voterId": voter_id or f"ip-{client_ip}",
            "ipAddress": client_ip,
            "rollNo": roll_no,
            "roll_no": roll_no,
            "score": score,
            "timestamp": datetime.now().isoformat()
        }

        if existing_index is not None:
            ratings[existing_index] = entry
        else:
            ratings.append(entry)

        store.data["performerRatings"] = ratings
        store.save()
        broadcast_state()

    def handle_trigger_performer_reveal(self, data=None):
        data = data or {}
        gender_filter = (data.get("gender") or "").strip().upper()  # 'M' or 'F'
        award_title = (data.get("title") or "").strip()
        if not award_title:
            if gender_filter == "M":
                award_title = "Mr. Freshers'"
            elif gender_filter == "F":
                award_title = "Ms. Freshers'"
            else:
                award_title = "Stage Performance Champion"

        ratings = store.data.get("performerRatings", [])
        photos = store.data.get("personPhotos", {})

        # Ensure stageMode is live_rating so the stage display switches to performer arena
        store.data["settings"]["stageMode"] = "live_rating"

        # Calculate average for each performer with valid scores
        performers_scores = {}
        for r in ratings:
            roll = str(r.get("rollNo") or r.get("roll_no") or "").strip()
            score = float(r.get("score") or 0)
            if roll and score > 0:
                performers_scores.setdefault(roll, []).append(score)

        summary = []
        target_roster = [p for p in freshers_roster if not gender_filter or (p.get("gender") or "").upper() == gender_filter]

        for person in target_roster:
            roll = str(person["roll_no"]).strip()
            scores = performers_scores.get(roll, [])
            if scores:
                avg = round(sum(scores) / len(scores), 1)
                summary.append({
                    "name": person["name"],
                    "roll_no": roll,
                    "gender": person.get("gender", ""),
                    "branch": person.get("program", ""),
                    "program": person.get("program", ""),
                    "awardTitle": award_title,
                    "photo": photos.get(roll, ""),
                    "avatarColor": get_color_for_name(person["name"]),
                    "avgScore": avg,
                    "ratingsCount": len(scores)
                })

        # Sort strictly by average score descending, then ratings count descending
        summary.sort(key=lambda x: (x["avgScore"], x["ratingsCount"]), reverse=True)
        winner = summary[0] if summary else None

        # If all candidates of that gender have 0 ratings, do not reveal a fake winner
        if not winner:
            gender_label = "male" if gender_filter == "M" else "female" if gender_filter == "F" else "any"
            self.write_message(json.dumps({
                "type": "toast",
                "data": {
                    "message": f"Cannot reveal {award_title}: All {gender_label} freshers have 0 ratings!",
                    "type": "error"
                }
            }))
            return

        winner["awardTitle"] = award_title

        # Clear previous reveals
        store.data["settings"]["liveRating"]["revealState"]["isRevealed"] = False
        store.data["settings"]["liveRating"]["revealState"]["winner"] = None
        store.data["settings"]["liveRating"]["revealState"]["awardTitle"] = award_title
        store.save()
        broadcast_state()

        loop = tornado.ioloop.IOLoop.current()
        broadcast({"type": "countdown", "data": {"seconds": 3, "mode": "live_rating", "awardTitle": award_title}})
        loop.call_later(1.0, lambda: broadcast({"type": "countdown", "data": {"seconds": 2, "mode": "live_rating", "awardTitle": award_title}}))
        loop.call_later(2.0, lambda: broadcast({"type": "countdown", "data": {"seconds": 1, "mode": "live_rating", "awardTitle": award_title}}))

        def do_performer_reveal():
            store.data["settings"]["liveRating"]["revealState"]["isRevealed"] = True
            store.data["settings"]["liveRating"]["revealState"]["winner"] = winner
            store.data["settings"]["liveRating"]["revealState"]["awardTitle"] = award_title
            store.save()
            broadcast({
                "type": "performer_reveal",
                "data": {
                    "winner": winner,
                    "awardTitle": award_title,
                    "topPerformers": summary[:5]
                }
            })
            broadcast_state()

        loop.call_later(3.0, do_performer_reveal)

# -------------------------------------------------------------
# Static Pages & API Handlers
# -------------------------------------------------------------
class PageHandler(tornado.web.RequestHandler):
    def initialize(self, filename):
        self.filename = filename

    def get(self):
        filepath = os.path.join(PUBLIC_DIR, self.filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                self.set_header("Content-Type", "text/html; charset=utf-8")
                self.write(f.read())
        else:
            self.set_status(404)
            self.write("Page not found")

class StateApiHandler(tornado.web.RequestHandler):
    def get_client_ip(self):
        xff = self.request.headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip()
        x_real_ip = self.request.headers.get("X-Real-IP")
        if x_real_ip:
            return x_real_ip.strip()
        return self.request.remote_ip or "127.0.0.1"

    def get(self):
        self.set_header("Content-Type", "application/json; charset=utf-8")
        data = dict(get_broadcast_payload()["data"])
        data["myIp"] = self.get_client_ip()
        self.write(json.dumps(data))

class FreshersApiHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/json; charset=utf-8")
        self.write(json.dumps(freshers_roster))

class NomineePhotoUploadHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            roll_no = self.get_argument("rollNo", "").strip()
            cand_id = self.get_argument("candidateId", "").strip()

            if not roll_no and cand_id:
                cand = next((c for c in store.data.get("candidates", []) if c.get("id") == cand_id), None)
                if cand:
                    roll_no = cand.get("roll_no", "")

            if not roll_no or "photo" not in self.request.files:
                self.set_status(400)
                self.write(json.dumps({"error": "Missing rollNo or photo file"}))
                return

            file_info = self.request.files["photo"][0]
            filename = file_info["filename"]
            body = file_info["body"]
            ext = os.path.splitext(filename)[1].lower() or ".jpg"
            save_name = f"person_{roll_no}_{int(datetime.now().timestamp())}{ext}"
            uploads_dir = os.path.join(PUBLIC_DIR, "uploads")
            os.makedirs(uploads_dir, exist_ok=True)
            save_path = os.path.join(uploads_dir, save_name)
            
            optimize_and_save_image(body, save_path, max_dim=(800, 800), quality=85)

            photo_url = f"/uploads/{save_name}"
            
            # 1. Update master personPhotos map
            store.data.setdefault("personPhotos", {})[roll_no] = photo_url

            # 2. Update all candidates across ALL categories sharing this roll_no
            for cand in store.data.get("candidates", []):
                if cand.get("roll_no") == roll_no:
                    cand["photo"] = photo_url
            
            store.save()
            broadcast_state()

            self.write(json.dumps({"success": True, "photo": photo_url, "rollNo": roll_no}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class NomineePhotoRemoveHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            roll_no = self.get_argument("rollNo", "").strip()
            cand_id = self.get_argument("candidateId", "").strip()

            if not roll_no and cand_id:
                cand = next((c for c in store.data.get("candidates", []) if c.get("id") == cand_id), None)
                if cand:
                    roll_no = cand.get("roll_no", "")

            if not roll_no:
                self.set_status(400)
                self.write(json.dumps({"error": "Missing rollNo"}))
                return

            # Delete physical file on disk if exists
            old_photo = store.data.get("personPhotos", {}).get(roll_no)
            if old_photo and old_photo.startswith("/uploads/"):
                disk_file = os.path.join(PUBLIC_DIR, old_photo.lstrip("/"))
                if os.path.exists(disk_file):
                    try:
                        os.remove(disk_file)
                    except Exception as ex:
                        print(f"[Warn] Could not remove photo file: {ex}")

            # Clear from master map
            if "personPhotos" in store.data:
                store.data["personPhotos"].pop(roll_no, None)

            # Clear from all candidates across all categories
            for cand in store.data.get("candidates", []):
                if cand.get("roll_no") == roll_no:
                    cand["photo"] = ""

            store.save()
            broadcast_state()

            self.write(json.dumps({"success": True, "rollNo": roll_no}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class QrUploadHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            if "qr" not in self.request.files:
                self.set_status(400)
                self.write(json.dumps({"error": "Missing qr file"}))
                return

            file_info = self.request.files["qr"][0]
            filename = file_info["filename"]
            body = file_info["body"]
            ext = os.path.splitext(filename)[1].lower() or ".png"
            timestamp = int(datetime.now().timestamp())
            save_name = f"qr_{timestamp}{ext}"

            uploads_dir = os.path.join(PUBLIC_DIR, "uploads")
            images_dir = os.path.join(PUBLIC_DIR, "images")
            os.makedirs(uploads_dir, exist_ok=True)
            os.makedirs(images_dir, exist_ok=True)

            upload_path = os.path.join(uploads_dir, save_name)
            optimize_and_save_image(body, upload_path, max_dim=(800, 800), quality=90)

            legacy_path = os.path.join(images_dir, "qr.png")
            optimize_and_save_image(body, legacy_path, max_dim=(800, 800), quality=90)

            qr_url = f"/uploads/{save_name}"
            store.data.setdefault("settings", {})["hasCustomQr"] = True
            store.data["settings"]["customQrUrl"] = qr_url
            store.save()
            broadcast_state()
            broadcast({
                "type": "qr_updated",
                "data": {
                    "hasCustomQr": True,
                    "customQrUrl": qr_url,
                    "timestamp": timestamp
                }
            })
            self.write(json.dumps({"success": True, "customQrUrl": qr_url}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class QrRemoveHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            store.data.setdefault("settings", {})["hasCustomQr"] = False
            store.data.setdefault("settings", {})["customQrUrl"] = None
            legacy_path = os.path.join(PUBLIC_DIR, "images", "qr.png")
            if os.path.exists(legacy_path):
                try:
                    os.remove(legacy_path)
                except Exception:
                    pass
            store.save()
            broadcast_state()
            broadcast({
                "type": "qr_updated",
                "data": {
                    "hasCustomQr": False,
                    "customQrUrl": None,
                    "timestamp": int(datetime.now().timestamp())
                }
            })
            self.write(json.dumps({"success": True}))
        except Exception as e:
            self.set_status(500)
class StageImageUploadHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            if "image" not in self.request.files:
                self.set_status(400)
                self.write(json.dumps({"error": "Missing image file"}))
                return

            file_info = self.request.files["image"][0]
            filename = file_info["filename"]
            body = file_info["body"]
            ext = os.path.splitext(filename)[1].lower() or ".jpg"
            save_name = f"stage_image_{int(datetime.now().timestamp())}{ext}"
            save_path = os.path.join(PUBLIC_DIR, "uploads", save_name)
            os.makedirs(os.path.join(PUBLIC_DIR, "uploads"), exist_ok=True)

            optimize_and_save_image(body, save_path, max_dim=(1920, 1080), quality=85)

            img_url = f"/uploads/{save_name}"
            store.data["settings"]["stageCustomImage"] = img_url
            store.save()
            broadcast_state()

            self.write(json.dumps({"success": True, "imageUrl": img_url}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

class StageImageRemoveHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            old_img = store.data["settings"].get("stageCustomImage")
            if old_img and old_img.startswith("/uploads/"):
                disk_file = os.path.join(PUBLIC_DIR, old_img.lstrip("/"))
                if os.path.exists(disk_file):
                    try:
                        os.remove(disk_file)
                    except Exception:
                        pass
            store.data["settings"]["stageCustomImage"] = None
            store.save()
            broadcast_state()
            self.write(json.dumps({"success": True}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"error": str(e)}))

# -------------------------------------------------------------
# Network Discovery & Main (Pure Clean HTTP)
# -------------------------------------------------------------
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def make_app():
    return tornado.web.Application([
        # Default / route directly serves the anonymous voting portal
        (r"/", PageHandler, dict(filename="vote.html")),
        (r"/vote", PageHandler, dict(filename="vote.html")),
        (r"/stage", PageHandler, dict(filename="stage.html")),
        (r"/admin", PageHandler, dict(filename="admin.html")),
        (r"/hub", PageHandler, dict(filename="index.html")),
        (r"/ws", VoteWebSocketHandler),
        (r"/api/state", StateApiHandler),
        (r"/api/freshers", FreshersApiHandler),
        (r"/api/upload-nominee-photo", NomineePhotoUploadHandler),
        (r"/api/remove-nominee-photo", NomineePhotoRemoveHandler),
        (r"/api/upload-qr", QrUploadHandler),
        (r"/api/remove-qr", QrRemoveHandler),
        (r"/api/upload-stage-image", StageImageUploadHandler),
        (r"/api/remove-stage-image", StageImageRemoveHandler),
        (r"/(.*)", tornado.web.StaticFileHandler, {"path": PUBLIC_DIR}),
    ])

def main():
    local_ip = get_local_ip()
    app = make_app()

    # Primary Clean HTTP Server on Port 3000 (No HTTPS, No SSL errors)
    server = tornado.httpserver.HTTPServer(app)
    server.listen(PORT, address="0.0.0.0")

    # Clean HTTP Server on Port 80 (Instant direct access on mobile without typing port)
    http_80_active = False
    try:
        http_server_80 = tornado.httpserver.HTTPServer(app)
        http_server_80.listen(80, address="0.0.0.0")
        http_80_active = True
    except Exception:
        pass

    print("\n" + "=" * 62)
    print("  👑 FRESHERS' NIGHT VOTING & BIG STAGE REVEAL SYSTEM")
    print("=" * 62)
    print(f"  📱 Default Mobile Vote:     http://{local_ip}:{PORT}")
    if http_80_active:
        print(f"  📱 Clean URL (Port 80):     http://{local_ip}")
    print(f"  🎬 Projector Stage (Secured): http://localhost:{PORT}/stage")
    print(f"  🎛️ Host Admin (Secured):     http://localhost:{PORT}/admin")
    print(f"  🔒 Stage/Vote Password:     y26freshers")
    print("=" * 62)
    print(f"  Loaded {len(freshers_roster)} freshers from CSV\n")

    tornado.ioloop.IOLoop.current().start()

if __name__ == "__main__":
    main()
