# Working with AI-DLC after the workshop

How to start the v2 exercise, keep your v1 work safe, and change what AI-DLC
does. Read it with the brief, `ideas/table-order-v2/IDEA.md`. To set up the
machine and the dashboard for v2, follow `V2-SETUP.md` in this folder.

---

## 1. Before you start: make v1 a safe point

1. Check that v1 is finished: type `/aidlc --status`. Every v1 stage should
   be done. If Build and Test is still open, type `/aidlc` and finish it.
2. Commit v1 and mark it, so you can always get back to it:
   ```
   git add -A
   git commit -m "Table Order v1, signed off"
   git tag v1-workshop
   ```
3. Start the dashboard in a second terminal (`../tools/dashboard.sh`, or
   `..\tools\dashboard.cmd` on Windows) and leave it running.

## 2. Start v2 as a separate piece of work

In Claude Code, in the `table-order` folder, type:

```
/aidlc Build Table Order v2 from ideas/table-order-v2/IDEA.md
```

AI-DLC then asks two questions before the first stage starts:

1. **"Work is already in progress on: "build the Table Order app from
   ideas/table-order/IDEA.md". You said: "Build Table Order v2 from
   ideas/table-order-v2/IDEA.md". What should I do?"**

   | Option | Choose it? |
   |---|---|
   | Part of the active work | No: v2's documents would land in v1's record. |
   | **Separate new piece of work** | **Yes (Recommended).** v2 gets its own record beside v1, and v1 stays exactly where it is. |
   | Reshape the active work | No: that changes v1's plan. |

   If you pick "Part of the active work" by mistake, the AI checks once
   before going ahead: choose **Separate new piece of work** there.

2. **"I'd run the "dpl-workshop" plan for: "Build Table Order v2 from
   ideas/table-order-v2/IDEA.md" - 13 stages, 13 approval gates, 2 stages
   repeat per unit of work in Construction. Do you want me to go ahead with it,
   use a different plan, or tailor one to this task?"**

   | Option | Choose it? |
   |---|---|
   | **Go ahead with the "dpl-workshop" plan** | **Yes (Recommended).** The same stages you ran on the day. |
   | Use a different plan | No: other plans skip or add stages the exercise expects. |
   | Tailor a plan to this task | No: same reason. |

If v1 isn't finished when you start v2 (its Build and Test still open, say),
that's fine: v1 stays as it is, and `/aidlc intent` takes you back to it later.
- Because the folder now holds code, v2 has one stage the workshop day didn't:
  **Reverse Engineering** (2.1). It comes right after Scope Definition. The AI
  reads your v1 code and writes a code knowledge base in
  `aidlc/spaces/default/codekb/table-order/`, so the plans build on what you
  made. `V2-SETUP.md` says what to expect and what to check before approving.
- The dashboard switches to v2 by itself.

v1 and v2 are each kept in their own folder under
`aidlc/spaces/default/intents/`. To see them, type `/aidlc intent`. To go back
to one, type `/aidlc intent <name>`.

## 3. How v1 is protected

The project rules (section 5) tell the AI that, in v2:
- v1's screens, behaviour, API and tests stay as they are, unless you chose to
  change them;
- v1's documents and mockups are never edited: v2 writes its own;
- v1's tests run with every v2 build, so every Bolt proves v1 still works;
- the database only gains new tables and fields, and v1's data is kept.

## 4. Changing v1's design or behaviour, when you want to

You decide this in **Scope Definition**. The AI asks which v1 screens or
behaviours to change. Your answer becomes the "Changes to v1" list in the
scope document, and only those things change.

Changed your mind later? Say so in plain words at any approval point, for
example "we also want the new look on the Cart screen". The AI tells you which
stages need to run again. To go back to a stage yourself, type
`/aidlc --stage scope-definition` (or another stage's name, such as
`refined-mockups`).

## 5. Changing the rules AI-DLC follows

AI-DLC follows the rules in **`aidlc/spaces/default/memory/project.md`**.
Every stage reads them. They are plain English, so you change them by editing
the file:
- **Add a rule:** add a bullet to the section it belongs to, for example under
  "Screen design": `- Prices always show two decimal places.`
- **Make a rule apply to one version only:** end it with **(v1 only)** or
  **(v2 only)**. Rules without a marker apply to both.
- **Something the AI must always or never do:** add a line under `## Mandated`
  (`- ALWAYS …`) or `## Forbidden` (`- NEVER …`).
- **When it takes effect:** from the next stage AI-DLC starts.
- Edit only that file. `aidlc/active-memory/` is a copy AI-DLC replaces.
- Commit the change, so your whole team works to the same rules.

Rules you will probably want to touch in v2:

| What | Where in `project.md` |
|---|---|
| How many questions each stage asks | "Questions to the team", the v2 column of the table |
| How many Units and Bolts (v2's Bolts have no time limit) | "Construction … (v2 only)" |
| Look and feel | "Screen design", "In v2" |
| What v1 work may change | "Protecting v1 (v2 only)" |

Leave the rules under `## Forbidden` and
`## Mandated`: they keep the tests, the mockup match and the review honest.

## 6. Changing the plan while you work

Say it in plain words. The commands are there if you prefer typing them.

| You want to | Say | Or type |
|---|---|---|
| See where you are | "Where are we?" | `/aidlc --status` |
| Go back and redo a stage | "Let's redo the user stories" | `/aidlc --stage user-stories` |
| Skip or add a stage | "Skip contract design" | |
| Get tougher reviews | "Turn on full reviews" | `/aidlc --review adversarial` |
| Bring in the specialist agents | "Bring the specialists in" | `/aidlc --collaborators on` |
| Let AI-DLC learn your corrections | "Turn learnings on" | `/aidlc --learnings on` |
| Reshape the remaining plan | "What else could we cut?" | `/aidlc compose "<what you want>"` |

## 7. Giving the AI your own material

Brand guidelines, a competitor's menu, photos of a real restaurant floor: put
the files in `aidlc/spaces/default/knowledge/documents/` and type
`/aidlc-knowledge onboard`. The AI can then read and cite them in every stage.

## 8. Approval points

- **Approve** to move on.
- **Ask for changes** in plain words; the AI updates the document and asks
  again.
- Code Generation always asks you to approve the code plan on its own before
  it writes code.
- The AI never opens the app for you before the tests and the mockup match
  have passed. That is a project rule, not a delay.

## 9. If something goes wrong

- Every Bolt is committed, so `git log` shows what each one changed.
- v1 is always at the `v1-workshop` tag. To look at v1's code without losing
  v2, run `git switch -c look-at-v1 v1-workshop`, and `git switch -` to come
  back (commit or stash v2 changes first). Never reset your branch to the tag:
  that throws away v2 work.
- `/aidlc --doctor` checks your AI-DLC setup.
