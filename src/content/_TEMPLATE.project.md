---
title: "Project title"
description: "One or two sentences. Card text on /projects and lede on the project page. Say what it does and who it is for, not which technologies it stacks."
category: "Automation"
team: "Red Team"
tags: ["tag one", "tag two"]
featured: false
date: "2026-01-01"
timeline: "3 months (2026)"
githubUrl: ""
liveUrl: ""
---

> **How to use this file.** Copy to `src/content/projects/<slug>.md`. It has the same eight sections
> as the article template (`src/content/_TEMPLATE.md`) because it is the same discipline applied to
> the other direction: there, you find a bug in a system someone else designed; here, you build one
> and have to be able to justify every choice in it. The unit of analysis is the **decision**, not
> the tool. A project page that lists technologies has documented a shopping list.
>
> `team` is `Red Team` or `Blue Team` — it drives the filter on `/projects`. `githubUrl` and
> `liveUrl` are optional; leave them empty until they are real. Delete this blockquote before
> publishing.

Keep the eight `##` sections and their order. A reader who cannot see the code still has to be able
to follow *why it is built this way*, and a reader who can see the code should not be able to find a
decision in it that you cannot account for.

---

## The problem

The question this project exists to answer, in one or two sentences, in the reader's terms.

> *Guide:* a good one is a question with a real answer, not a task description. "How do I read this
> system's event stream without paying for a SIEM?" is a question. "A script that tails logs" is
> not. If you cannot name the question, you are not sure what you built.

State what the tool does **not** do. Scope written down after the fact is always wider than scope
actually delivered, and the difference is where the wasted work is.

## The context

Where it runs, on what, with what access, and who is on the other end of it. This is the section
that keeps the project honest, because a tool is only reasonable relative to its environment.

Cover, in prose or as a list:

- the machine, network, or pipeline it runs against
- the credentials and privileges it needs, and why each one is needed
- the operator: a person with a terminal, a CI job, a browser
- the thing that exists before this project, that this was supposed to replace or fix

> **Plain terms**
> A short paragraph on what the tool does in everyday language, no tool names, no jargon. The
> technical sections that follow need something to hang on.

## The constraints

The rubric. Not "requirements" as a wish list — the handful of conditions that actually decided the
shape of the thing. Everything in the design below should be traceable to one of these.

A constraint is one of:

| Kind | The question it answers |
| --- | --- |
| **Hard** | What does the environment forbid outright — no external deps, no cloud, no root? |
| **Budget** | What is the ceiling on time, memory, disk, or attention? |
| **Surface** | What is the input I do not control, and therefore must treat as hostile? |
| **Non-goal** | What am I deliberately not doing, and what am I accepting as a result? |

> *Guide:* **Non-goal** is the row that does the work. A tool without one has an invisible feature
> request from whoever asks for it next, and that request will shape the architecture more than
> anything you decided on purpose.

## The components

One row per moving part. Earn each row the same way the inventory in the article template earns
each row: by satisfying a criterion, not by existing.

| Component | Responsibility | Depends on | Fails into |
| --- | --- | --- | --- |

> *Guide on columns:* **Responsibility** in one line, and if it can be expressed as "and also", it
> is probably two components. **Fails into** is the operational consequence — what the operator
> sees when it breaks. You cannot build the error handling until you have answered this column, and
> it is always the answer people skip.

## From requirement to design

The pivotal decision. There is always one place where two constraints pulled against each other and
something had to give — write down what it was.

Then the **alternatives you rejected**, with the constraint that killed each:

> **Rejected**
> `alternative` — fails on *budget*: it needs a runtime dependency the host does not have, and the
> whole point was that it has to run somewhere bare.

That blockquote is the section. Everything above it is setup; the rejected list is what a reader is
actually looking for, because it is the part that proves you considered the option someone else will
suggest in the comments.

> **Plain terms**
> One short paragraph unpacking the tradeoff itself, before the alternatives. Explain what was gained
> and what was given up, in plain words.

## Implementation

What it actually does, with the parts that carry a decision. Code, config, or queries — whatever
would be needed to reproduce the behavior.

> *Guide:* show the code that a decision produced, not the code that is easy to show. If the
> interesting part is a parser edge case, show the edge case. If the interesting part is a
> performance trade-off, show the measurement. Keep it to what a reader would otherwise have to
> guess.

## In plain terms

The whole project retold as one narrative: the problem, the choice, the cost of the choice. No
jargon, no package names, no code. Someone who has never run a terminal should end up able to
explain to a colleague why the tool exists and what it gives up.

> *Guide:* write it as a story about a need and a compromise. If it needs more than a few paragraphs,
> the technical layer above is carrying explanation it should not be carrying.

## What I'd do differently

The reusable part, and the honest part. Both are required.

- **Carry-over:** the rule of thumb, the check, the question worth asking before starting anything
  similar. Something the reader can apply without having seen your environment.
- **Limits:** where this does not hold. A tool presented as complete gets trusted in a situation
  where it does not work. Name the case where you would reach for something else instead.

Close with what you would remove if you started again. That sentence is the one people remember.