# AmaySST Quiz — Beginner Step-by-Step Setup & Deployment Guide

Everything in your updated app is already built inside this project folder. Follow these simple steps in order — no coding experience required.

---

## Step 1: One-Time Supabase Setup (Database & Admin Permissions)
This enables **Every Tap tracking**, **Admin Rename / XP Editing**, and **Bulk Question Upload** across all student phones.

1. Open your Supabase project dashboard (`https://supabase.com/dashboard`).
2. In the left sidebar, click **SQL Editor**.
3. Click **+ New query**.
4. Open the file **`supabase-setup.sql`** from this project, select everything (`Ctrl+A` / `Cmd+A`), copy it, and paste it into the Supabase SQL box.
5. Click the green **Run** button (bottom right). You should see `Success. No rows returned`.
6. Also confirm your Admin Login account exists:
   - In Supabase left sidebar, go to **Authentication** → **Users**.
   - Make sure your admin email (e.g. `amaybikram7721@gmail.com`) is listed there with a password you know. If not, click **Add user → Create new user**.

---

## Step 2: Publish to Your Existing GitHub Website (`Amay-SST-Quiz`)
Because this project uses modern React + Vite, GitHub needs a 1-time workflow setting so it builds the website automatically whenever you upload files.

1. In **Google AI Studio** (this screen), click the **Download App** icon (top right) to download the project `.zip` file to your computer, and extract/unzip it into a folder.
2. Go to your repository on GitHub: `https://github.com/amaybikramsst/Amay-SST-Quiz`.
3. Click **Add file → Upload files**.
4. Drag **all files and folders** from inside the unzipped folder (including `.github`, `public`, `src`, `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`) onto the GitHub upload box.
   - *Important*: Make sure the hidden `.github` folder (containing `.github/workflows/deploy.yml`) is included! On Windows/Mac, press `Ctrl+Shift+.` (or `Cmd+Shift+.` on Mac) inside the folder if `.github` is hidden.
5. Scroll down, type `Update AmaySST Quiz`, and click **Commit changes**.
6. Turn on automatic building on GitHub (1-time setting):
   - On your GitHub repository, click **Settings** (top tab).
   - In the left menu, click **Pages**.
   - Under **Build and deployment → Source**, change the dropdown from *Deploy from a branch* to **GitHub Actions**.
7. Click the **Actions** tab at the top of your repository — within ~1–2 minutes you will see a green checkmark, and your live link `https://amaybikramsst.github.io/Amay-SST-Quiz/` will show the brand-new app!

*(Alternative: You can also click **Deploy** right inside AI Studio if you want an instant hosted URL without using GitHub.)*

---

## Step 3: How to Open Your Secret Admin Console
Students **cannot** see any Admin button anywhere in the app. Only you can open it using the secret URL:

- On GitHub Pages: `https://amaybikramsst.github.io/Amay-SST-Quiz/#admin` (or `?admin=1`)
- Sign in with your Supabase **Authentication** email & password.

### Inside Your Admin Console:
- **Everyone & XP → Registered Candidates**: Click **Rename** on any row to rename a student instantly, or **Edit / Inspect** to change XP, Today XP, Streak, Quizzes, or hide/unhide them.
- **Everyone & XP → Bot Roster**: Rename or edit XP for any of the 150 bots.
- **Every Result**: See every quiz submitted by every student (subject, level, score, XP).
- **Every Tap**: See every screen/tab/quiz tap made by students.
- **Questions & Bulk Upload**:
  - Add 1 question manually, OR
  - Upload a **`.pdf`**, **`.csv`**, **`.txt`**, or **`.json`** file in bulk, review/edit the parsed questions in the preview table, and click **Upload All to Live Bank**.

---

## Step 4: Bulk Question File Formats (Copy-Paste Examples)

### Option A: `.txt` or `.pdf` format
```text
1. Which planet is known as the Red Planet?
A) Venus
B) Mars
C) Jupiter
D) Saturn
Answer: B
Explanation: Mars appears red due to iron oxide on its surface.

2. Who was the first President of India?
A) Mahatma Gandhi
B) Jawaharlal Nehru
C) Dr. Rajendra Prasad
D) B.R. Ambedkar
Answer: C
Explanation: Dr. Rajendra Prasad served as India's first President from 1950 to 1962.
```

### Option B: `.csv` format (open in Excel / Google Sheets and save as `.csv`)
```csv
subject,level,question,option_a,option_b,option_c,option_d,answer,explanation
sst,0,"Who wrote the Indian National Anthem?","Bankim Chandra","Rabindranath Tagore","Sarojini Naidu","Subhas Chandra Bose",B,"Rabindranath Tagore composed Jana Gana Mana."
sci,1,"What is the chemical symbol for Gold?","Ag","Fe","Au","Cu",C,"Au comes from the Latin word Aurum."
```
*(Subject codes: `math`, `sci`, `sst`, `eng`, `hin`, `ca` · Level codes: `0` = Easy, `1` = Medium, `2` = Hard, `3` = Amay Special)*
