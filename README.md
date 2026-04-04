# Wine Cellar App — Setup Guide

This guide is written for non-developers. Follow each step in order.

---

## What you'll need

- A computer (Windows, Mac, or Linux)
- A free [Supabase](https://supabase.com) account (for the database)
- An internet connection

---

## Step 1 — Install Node.js

Node.js is the engine that runs the app locally.

1. Go to **https://nodejs.org**
2. Click the big green **"LTS"** download button (LTS = recommended stable version)
3. Run the installer and click through the defaults
4. When it's done, open a **Terminal** (on Windows: search for "Terminal" or "Command Prompt" in the Start menu)
5. Type `node --version` and press Enter — you should see something like `v20.x.x`

---

## Step 2 — Install the app's dependencies

1. Open a Terminal **inside the project folder**
   - On Windows: open File Explorer, navigate to the project folder, then type `cmd` in the address bar and press Enter
   - On Mac: right-click the folder and choose "New Terminal at Folder"
2. Run this command and wait for it to finish:
   ```
   npm install
   ```

---

## Step 3 — Set up Supabase (your database)

### 3a — Create a Supabase account and project

1. Go to **https://supabase.com** and click **Start for free**
2. Sign up (you can use GitHub or email)
3. Click **New project**, give it a name (e.g. "Wine Cellar"), choose a region close to you, and set a database password
4. Wait ~2 minutes for the project to be ready

### 3b — Create the wines table

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Paste the following SQL and click **Run**:

```sql
create table wines (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  name          text not null,
  producer      text,
  vintage       integer,
  region        text,
  country       text,
  grape_variety text,
  colour        text not null default 'red',
  quantity      integer not null default 1
);

-- Allow anyone with the anon key to read and write (suitable for personal use)
alter table wines enable row level security;

create policy "Allow all for anon" on wines
  for all
  using (true)
  with check (true);
```

### 3c — Get your credentials

1. In your Supabase project, click the **gear icon** (Settings) at the bottom of the left sidebar
2. Click **API**
3. You'll see two values you need:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Project API keys → anon public** — a long string of letters and numbers

### 3d — Add your credentials to the app

1. In the project folder, find the file called **`.env.example`**
2. Make a copy of it and rename the copy to **`.env`** (just `.env` — no "example")
3. Open `.env` in a text editor (Notepad is fine)
4. Replace the placeholder values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

   …with your real values from Step 3c. Example:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

5. Save the file

---

## Step 4 — Run the app

1. In the Terminal (from Step 2), run:
   ```
   npm run dev
   ```
2. You'll see a message like `Local: http://localhost:5173`
3. Open that address in your browser — your app is running!

To use it on your phone: make sure your phone is on the same Wi-Fi network, then open the `Network:` address shown in the terminal (something like `http://192.168.x.x:5173`).

---

## Stopping the app

Press **Ctrl + C** in the Terminal to stop the development server.

---

## Pages

| Page | What it does |
|------|-------------|
| **Dashboard** | Shows all wines as cards with full details and total bottle count |
| **Add Wine** | Form to add a new wine to your cellar |
| **Inventory** | List view with search, filter by colour, "Drink one" button, and delete |

---

## Troubleshooting

**"command not found: npm"** — Node.js isn't installed yet. Redo Step 1.

**Wines aren't saving / "Could not load wines"** — Your Supabase credentials in `.env` may be wrong, or you haven't run the SQL in Step 3b. Double-check both.

**The `.env` file doesn't show up in File Explorer** — On Windows, enable "Show hidden files" in File Explorer's View settings. Files starting with `.` are hidden by default.

**I accidentally deleted `.env`** — Just redo Step 3d using `.env.example` as your template.
