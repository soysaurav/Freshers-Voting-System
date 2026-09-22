# Freshers Voting System 👑✨

An open-source, high-performance, real-time peer voting and live stage reveal platform designed for college and university freshers' nights, talent galas, and stage events.

Built with an asynchronous Python/Tornado backend, WebSockets, HTML5/CSS3 glassmorphic design, and instant audio/visual stage celebrations.

---

## 🌟 Key Features

1. **Category-Based Peer Voting:**
   - Audience members cast anonymous votes for candidates in customized award categories (Mr. Freshers', Ms. Freshers', Best Dressed, etc.).
   - Client fingerprinting and IP tracking prevent duplicate voting while maintaining anonymity.

2. **Live On-Stage Performer Rating (1 to 10):**
   - Host activates performers on stage in real time.
   - Audience rates live performances with an interactive slider (1 to 10 points).
   - Instant computation of average scores and live performer standings.

3. **Dramatic Big-Screen Stage Reveal:**
   - Dedicated projector console (`/stage`) with cinematic countdowns (3-2-1), audio FX, confetti explosions, and dramatic winner reveal overlays.
   - Stage intermission banner and impromptu task projection screen.

4. **Real-Time Host Admin Console:**
   - Full live control panel (`/admin`) to create categories, register freshers from CSV, upload nominee portraits, trigger stage countdowns, reveal winners, and manage intermission tasks.

5. **Built-in Security Gate:**
   - Stage, Admin, and Voting portals are protected by a host authorization gate.
   - Default password: **`y26freshers`**.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.8+** installed on your system.
- Ensure `pip` is available.

### 2. Installation

Clone or download the repository:
```bash
git clone https://github.com/soysaurav/Freshers-Voting-System.git
cd Freshers-Voting-System
```

Install the required Python dependencies:
```bash
pip install -r requirements.txt
```

*(Dependencies: `tornado>=6.0` for async WebSockets & HTTP server, and `Pillow>=9.0` for automatic mobile photo downscaling & EXIF orientation).*

---

## 🏃 How to Start the Server

### Windows (Quick Start)
Double-click `run.bat` or run in PowerShell / Command Prompt:
```cmd
run.bat
```

### Linux / macOS / Terminal
Run `server.py` directly with Python:
```bash
python server.py
```

Upon launching, the terminal will display the active network URLs:
```text
==============================================================
  👑 FRESHERS' NIGHT VOTING & BIG STAGE REVEAL SYSTEM
==============================================================
  📱 Default Mobile Vote:       http://<YOUR_LOCAL_IP>:3000
  📱 Clean URL (Port 80):       http://<YOUR_LOCAL_IP>
  🎬 Projector Stage (Secured): http://localhost:3000/stage
  🎛️ Host Admin (Secured):       http://localhost:3000/admin
  🔒 Stage/Vote Password:       y26freshers
==============================================================
```

---

## 🔑 Access Endpoints & Default Password

| Endpoint | Path | Purpose | Access Protection |
| :--- | :--- | :--- | :--- |
| **Mobile Voting Portal** | `/` or `/vote` | Audience voting and live performer rating | Password protected (`y26freshers`) |
| **Stage Projector Console** | `/stage` | Fullscreen projector display for stage reveals | Password protected (`y26freshers`) |
| **Host Admin Panel** | `/admin` | Host dashboard to manage votes, ratings & reveals | Password protected (`y26freshers`) |
| **Hub / Index** | `/hub` | Central launcher landing page | Public navigation |

> **Password Note:**
> The authentication password for the stage, admin, and voting portal is **`y26freshers`**.
> To modify this password, edit `public/js/auth-guard.js` and update:
> ```javascript
> const SECRET = 'your_new_password';
> ```

---

## 📁 Directory Structure

```text
├── data/
│   ├── freshers_list.csv   # Student roster (Name, Roll No, Program, Batch, Gender)
│   └── store.json          # Persistent state (categories, nominees, votes, settings)
├── public/
│   ├── css/                # Stylesheets (style.css, admin.css, stage.css, vote.css)
│   ├── js/                 # Client scripts (admin.js, stage.js, vote.js, auth-guard.js)
│   ├── images/             # Background assets and icons
│   ├── uploads/            # Nominee photos and custom stage banners
│   ├── admin.html          # Host Admin Console
│   ├── stage.html          # Big-Screen Projector Console
│   ├── vote.html           # Mobile Voting Portal
│   └── index.html          # Hub Landing Page
├── server.py               # Main asynchronous Tornado backend & WebSocket hub
├── run.bat                 # 1-Click Windows execution script
├── requirements.txt        # Python package requirements
├── LICENSE                 # MIT License
└── README.md               # Documentation
```

---

## ⚙️ Customization

1. **Student Roster (`data/freshers_list.csv`):**
   Add your cohort's students in standard CSV format:
   ```csv
   name,phone_number,email,roll_no,program,batch,invited,g
   John Doe,9876543210,johndoe@college.edu,26101,B.Tech,Y26,Y,M
   Jane Smith,9876543211,janesmith@college.edu,26102,M.Tech,Y26,Y,F
   ```

2. **Network Setup for Audience Access:**
   Connect the host laptop and audience devices (smartphones) to the same Wi-Fi network (or mobile hotspot). Audience members can navigate directly to `http://<HOST_IP>:3000` or scan the QR code generated on the stage console.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - feel free to use, modify, and distribute for your campus and community events!
