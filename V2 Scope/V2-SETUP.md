# Table Order v2: setting up the exercise

How to switch on the v2 exercise on a team machine, keep everything from the
workshop, and open the dashboard. It takes about 10 minutes.

The workshop's work is called **v1** below, and the exercise **v2**.

---

## What is kept from the workshop

Nothing from v1 is deleted or overwritten:

| What | Where it stays |
|---|---|
| v1's documents, mockups, questions and audit trail | `table-order/aidlc/spaces/default/intents/<v1 folder>/`. v2 gets its own folder beside it. |
| v1's Bolts 1–4 and their figures (cycle times, lines, tests, issues, AI lines accepted, tokens) | The dashboard history, `tools/dashboard/.history/`. The dashboard shows them in a v1 view, and in v2's Bolt table. |
| v1's last test results and coverage | Kept by the dashboard for the v1 view, even after v2 runs its own tests. |
| v1's code and tests | In git, tagged `v1-workshop` (step 3). v2 only changes v1 code where the team chooses to. |
| The app's data (tables, menu, orders) | `table-order/data/table-order.db`. v2 only adds to it. Step 3 also keeps a copy. |

---

## 1. Put the new files in place

Skip this step on the facilitator's machine: the files are already there.

The kit holds only what a team machine needs to start v2. Every path inside it
starts from the team's `Workshop Day` folder (the one holding `table-order/`
and `tools/`), so unzipping it there puts each file in its place.

1. **Download the kit:**
   https://gitlab.dplit.com/waqas.f/ai-dlc-workshop-v2/-/raw/main/V2%20Scope/table-order-v2-kit.zip?inline=false
   Save it in the team's `Workshop Day` folder.
2. **Check the project rules first.** If the team changed
   `table-order/aidlc/spaces/default/memory/project.md` during the workshop,
   copy it aside now; the kit replaces it, and you merge the team's lines back
   in afterwards. If they never changed it, let it be replaced.
3. **Stop the dashboard** if it is running: press **Ctrl+C** in its terminal.
4. **Unzip the kit into the `Workshop Day` folder**, replacing existing files:
   - **macOS:**
     ```
     cd "path/to/Workshop Day"
     unzip -o table-order-v2-kit.zip
     ```
   - **Windows (PowerShell):**
     ```
     cd "path\to\Workshop Day"
     Expand-Archive table-order-v2-kit.zip -DestinationPath . -Force
     ```
5. **Check it landed:** `table-order/ideas/table-order-v2/IDEA.md` and
   `table-order/V2 Scope/V2-SETUP.md` should now exist.

Where each file in the kit goes. The kit holds 11 files: 7 replace files
already in the team's existing folders, and 4 are new files in 2 new folders.
Unzipping does all of this; to copy by hand instead, put each file where the
table says.

| # | File in the kit | Path in the kit | Put it in this folder | Existing or new | What it is |
|---|---|---|---|---|---|
| 1 | `dashboard.sh` | `tools/dashboard.sh` | `Workshop Day/tools/` | Existing folder; replaces the file | Dashboard launcher for macOS (unchanged) |
| 2 | `dashboard.cmd` | `tools/dashboard.cmd` | `Workshop Day/tools/` | Existing folder; replaces the file | Dashboard launcher for Windows (unchanged) |
| 3 | `server.py` | `tools/dashboard/server.py` | `Workshop Day/tools/dashboard/` | Existing folder; replaces the file | Updated dashboard: the v1 / v2 switch |
| 4 | `delivery.py` | `tools/dashboard/delivery.py` | `Workshop Day/tools/dashboard/` | Existing folder; replaces the file | Updated dashboard: keeps each version's figures |
| 5 | `session_tokens.py` | `tools/dashboard/session_tokens.py` | `Workshop Day/tools/dashboard/` | Existing folder; replaces the file | Dashboard token counting (unchanged) |
| 6 | `index.html` | `tools/dashboard/index.html` | `Workshop Day/tools/dashboard/` | Existing folder; replaces the file | Updated dashboard page |
| 7 | `project.md` | `table-order/aidlc/spaces/default/memory/project.md` | `Workshop Day/table-order/aidlc/spaces/default/memory/` | Existing folder; replaces the file (see item 2 above) | Project rules with the v2 rules added |
| 8 | `IDEA.md` | `table-order/ideas/table-order-v2/IDEA.md` | `Workshop Day/table-order/ideas/table-order-v2/` | New folder `table-order-v2` inside the existing `ideas/` folder; new file | The v2 brief, where AI-DLC reads it |
| 9 | `V2-SETUP.md` | `table-order/V2 Scope/V2-SETUP.md` | `Workshop Day/table-order/V2 Scope/` | New folder `V2 Scope` inside the existing `table-order/` folder; new file | This setup guide |
| 10 | `GUIDE.md` | `table-order/V2 Scope/GUIDE.md` | `Workshop Day/table-order/V2 Scope/` | Same new folder; new file | The team guide |
| 11 | `V2-BRIEF.md` | `table-order/V2 Scope/V2-BRIEF.md` | `Workshop Day/table-order/V2 Scope/` | Same new folder; new file | A copy of the brief to read |

## 2. Restart the dashboard

The new dashboard only takes effect once restarted. Start it **before** v2 runs
its first tests, so it files v1's last test results under v1.

1. If the dashboard is running, go to its terminal and press **Ctrl+C**.
2. Start it again from the `table-order` folder:
   - **macOS:**
     ```
     cd "path/to/Workshop Day/table-order"
     ../tools/dashboard.sh
     ```
   - **Windows:**
     ```
     cd "path\to\Workshop Day\table-order"
     ..\tools\dashboard.cmd
     ```
3. A Chrome window opens at **http://127.0.0.1:8787/**. If it doesn't, open
   that address yourself. Drag it to the second screen and make it full screen
   (**Cmd+Ctrl+F** on macOS, **F11** on Windows).
4. Leave that terminal open all day.

At this point the dashboard still shows v1, exactly as at the end of the
workshop.

## 3. Make v1 a safe point

Open a second terminal (leave the dashboard's running) and go to the
`table-order` folder, then run:

```
git add -A
git commit -m "Table Order v1, signed off"
git tag v1-workshop
```

Then keep a copy of the app's data:
- **macOS:** `cp data/table-order.db data/table-order-v1.db`
- **Windows:** `copy data\table-order.db data\table-order-v1.db`

## 4. Switch on v2

1. In the same terminal, still in the `table-order` folder, start Claude Code
   as on the workshop day: type `claude`. If Claude Code was already open, type
   `/exit` and start it again, so it reads the new project rules.
2. Type:
   ```
   /aidlc Build Table Order v2 from ideas/table-order-v2/IDEA.md
   ```
3. AI-DLC asks these questions before the first stage. Give these answers:

   | AI-DLC asks | Answer (Recommended) |
   |---|---|
   | "Work is already in progress on: … What should I do?" (Part of the active work / Separate new piece of work / Reshape the active work) | **Separate new piece of work** |
   | "I'd run the "dpl-workshop" plan for: … Do you want me to go ahead with it, use a different plan, or tailor one to this task?" | **Go ahead with the "dpl-workshop" plan** |
   | "I've created [N] questions at … How would you like to answer them?" (Guide me / I'll edit the file / Chat) | **Guide me**, as on the workshop day |

   - If your v1 run was already finished, AI-DLC may not ask the first
     question. Go straight to the next one.
   - If "Part of the active work" is picked by mistake, the AI checks once
     before going ahead: choose **Separate new piece of work** there.
   - `GUIDE.md` in `table-order/V2 Scope/` shows the first two questions in
     full.
4. From here, answer each stage's questions and approve each stage, as on the
   workshop day. The brief (`V2-BRIEF.md`) says what to pick, and `GUIDE.md`
   says how to change the plan, the rules or v1's design along the way.

Within a few seconds the dashboard switches to v2. At the top, next to
"AI-DLC Workshop", it now shows **v1** and **v2 ● live**.

### The stages v2 runs through

v2 runs the same 13 stages as the workshop day, with one new one:
**Reverse Engineering**, where the AI reads your v1 code before planning
anything.

| # | Stage | What happens |
|---|---|---|
| 1.1 | Intent Capture | Pick your features (at least 2 from each list) and set what success means. |
| 1.4 | Scope Definition | Confirm the features, choose which v1 screens get the new look and which v1 behaviours may change, and set the build order. |
| **2.1** | **Reverse Engineering (new in v2)** | The AI reads your v1 code and writes a code knowledge base (see below). |
| 2.3 | Requirements Analysis | Requirements for the new features, built on what the v1 code already does. |
| 2.4 to 2.9 | User Stories, Refined Mockups, Domain Design, Units Generation, Contract Design, Delivery Planning | As on the day, numbering v2's Units and Bolts from 5. |
| 3.1, 3.5, 3.6 | Functional Design, Code Generation, Build and Test | Bolt 5 on its own, then Bolts 6 and 7 in parallel, with no time limit. |

### Reverse Engineering: what to expect

- **When:** straight after you approve Scope Definition. On the dashboard it
  is stage **2.1**.
- **What it does:** a developer agent reads the v1 app's own code (`server/`,
  `client/`, `tests/` and `e2e/`) and skips libraries, build output, test
  results, the database file and AI-DLC's own files. It runs no tests and
  changes no code.
- **How long:** about 5 to 10 minutes. It asks you nothing on a first scan.
- **What it writes:** nine documents in
  `table-order/aidlc/spaces/default/codekb/table-order/`: a business overview,
  the architecture (with diagrams), the code structure, the API, the
  components, the technology stack, the dependencies, a code quality
  assessment, and a record of when the scan ran. Every later stage reads them.
- **What to check before you approve:**
  - where v2 will have to change v1 code, listed in `architecture.md`;
  - the risks in `code-quality-assessment.md`. Typical ones for Table Order:
    - database rules that only an extra migration can widen;
    - v1 allowing one line per dish in an order, which dish options need to
      change;
    - order status changes that aren't timed;
    - v1 browser tests that will need updating after the new look.
- **If the AI asks about an existing knowledge base** (for example when you
  run the stage again), choose **Reuse existing knowledge base** when the v1
  code hasn't changed since, and **Full rescan** otherwise.
- **Then:** approve it, and Requirements Analysis plans the new features on
  top of what the scan found.

## 5. Using the dashboard with v1 and v2

- **v2 ● live** is the work under way. Its clocks run and its panels update
  live.
- **v1** opens the workshop run as it ended: every stage, its times, Bolts 1–4
  with all their figures, v1's last test results, its tokens and its files.
  Nothing moves on this view. Click **v2** to go back.
- In the v2 view, the Bolt table lists v1's **Bolts 1–4 first, dimmed and
  tagged v1**, then v2's Bolts 5 onwards. The figures above the table are v2's
  own. The line above them shows both, for example
  "v2: 1 of 3 Bolts done · v1: 4 of 4 done".
- **Browse files** shows the brief and documents of the version on screen. For
  v2 that is `IDEA.md`.
- To open v1 directly, use
  `http://127.0.0.1:8787/?intent=<v1 folder name>`, for example
  `http://127.0.0.1:8787/?intent=261105-table-order`. The v1 folder name is
  the date of the workshop day followed by `-table-order`; type `/aidlc intent`
  in Claude Code to list both folder names.

If the team later goes back to v1 with `/aidlc intent <v1 folder name>`, v1
becomes **live** again and v2 is shown as it stood.

What it looks like (from the facilitator's rehearsal run):

![Dashboard: v2 live, with v1's Bolts in the Bolt table](screenshots/dashboard-v2-live.png)

![Dashboard: v1 as it ended](screenshots/dashboard-v1-as-it-ended.png)

## 6. Hand in your work

**Due: Tuesday 10 November 2026, end of day.** Send one zip file by email to
**waqas.f@dplit.com**.

The zip must hold your **full code** (the whole `table-order` project) as well
as the screenshots. Screenshots alone are not enough: a zip without the code is
not a complete hand-in. The commands under "Make the zip" put both in.

### Take the screenshots

Take each screenshot with its window full screen: on macOS press
**Cmd+Shift+3**, on Windows press **Win+Shift+S** and choose full screen. Save
them all in a new folder, `table-order/v2-screenshots/`.

| Screenshot | How | Name it |
|---|---|---|
| The app (the system) | Every new or changed screen, including your X-factors, with the app running at http://localhost:3000 | `app-<screen>.png`, for example `app-menu.png` |
| Dashboard, v1 view | Click **v1** at the top of the dashboard | `dashboard-v1.png` |
| Dashboard, v2 view | At the final sign-off, with the delivery strip, tests and coverage showing | `dashboard-v2.png` |

If you also took screenshots along the way (at the Delivery Planning gate, or
while Bolts 6 and 7 built in parallel), add them too.

### Make the zip

In a terminal in the `table-order` folder (put your team's name in place of
`<team name>`):

```
git add -A
git commit -m "Workshop V2 - <team name>"
git archive --format=zip -o "../Workshop V2 - <team name>.zip" HEAD
```

This makes `Workshop V2 - <team name>.zip` in the `Workshop Day` folder. It
holds your code, your AI-DLC documents and the `v2-screenshots` folder, and
leaves out installed libraries, build output and the database. The same
commands work on macOS and Windows.

### Send it

| | |
|---|---|
| **To** | waqas.f@dplit.com |
| **Subject** | `Workshop V2 - <team name>` |
| **Email text** | Your team name and the names of everyone in the team |
| **Attachment** | `Workshop V2 - <team name>.zip` |

### Demo

After the hand-in, a **5-minute demo** will be scheduled with each team by the
end of next week (Friday 13 November 2026). Be ready to show your new features
and your X-factors running in the app, and both dashboard views.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| The browser doesn't open | Open http://127.0.0.1:8787/ in Chrome yourself. |
| "Port 8787 is in use" | The old dashboard is still running. Close its terminal, or press Ctrl+C in it, then start it again. |
| No v1 / v2 links at the top | v2 hasn't started yet (step 4), or the old dashboard is still running (step 2). |
| The v1 view says "No test run yet" | The new dashboard first ran after v2's tests had replaced v1's results. v1's other figures are still there. |
| "Workspace not found" | Start the dashboard from inside `table-order`, or pass the path: `../tools/dashboard.sh path/to/table-order`. |
| `git commit` says "Please tell me who you are" | Run `git config user.name "Team <name>"` and `git config user.email "<your email>"`, then run the commit again. |
| `git commit` says "nothing to commit" | v1 was already committed. Run `git tag v1-workshop` on its own. |
| You need the old dashboard back | Unzip `tools/dashboard/` from the workshop starter zip you were given before the workshop over `Workshop Day/tools/dashboard/`. The `.history` folder keeps all your figures either way. |
| You want to look at v1's code without losing v2 | `git switch -c look-at-v1 v1-workshop` shows v1; `git switch -` brings you back to v2. Commit or stash v2 changes first. |
| You need v1's data back | Stop the app, then copy `data/table-order-v1.db` over `data/table-order.db`. This throws away every order, menu change and rating made in v2. |
| Anything else in AI-DLC | Type `/aidlc --doctor` in Claude Code: it checks the setup and says what to fix. |
