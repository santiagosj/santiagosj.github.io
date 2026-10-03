---
title: "Article title, sentence case"
description: "One or two sentences. Used as the card text on /posts and as the lede on the article. Say what judgment the reader gets, not what tools were used."
category: "Method"
tags: ["tag one", "tag two"]
featured: false
date: "2026-01-01"
---

> **How to use this file.** Copy it to `src/content/posts/<slug>.md` and fill it in. Keep the eight
> `##` sections and their order — the whole point is that a reader who knows nothing about security
> can follow the same reasoning as a reader who does. `##` headings build the table of contents
> automatically, so every section must be worth linking to. Delete this blockquote before publishing.
>
> Articles live in `src/content/posts/`. Frontmatter fields are typed in `src/content/types.ts`;
> `tags` accepts either a YAML list or a comma-separated string.

Every article in this section answers **one question about judgment**, not "how did I root a box".
A machine-specific writeup is a record of one outcome. The reasoning that produced the outcome is
what survives the machine, and it is what is worth publishing. So the target is always a **scenario
specification**, never a box name.

---

## The question

State the question this article answers, in one or two sentences, in the reader's terms.

> *Guide:* a good one is answerable with a yes/no and forces a tradeoff. "Do I enumerate before or
> after fingerprinting?" is a question. "How to enumerate a web server" is not — that is a manual.

Say explicitly what a reader will be able to do differently after reading. If you cannot fill in
that sentence, the article is not ready.

## The target model

Describe the target as an abstract specification: what it *is for*, what it *does*, and what it was
*built out of*. Declare it fictional. Give it a neutral name (`the appliance`, `the storefront`)
rather than a hostname, so the reasoning transfers instead of depending on details nobody else has.

Cover, in prose or as a list:

- the job the system exists to do
- the components it is made of, and why each one is there
- the actors: anonymous visitor, authenticated user, service account, administrator
- the assets that matter, and which actor legitimately owns each

> **Plain terms**
> A short paragraph naming the system in everyday language, so the technical sections that follow
> have something to hang on. No jargon, no CVE numbers, no commands.

## The surface criteria

The rule used to decide what belongs in the inventory below. State it as a rubric, not a vibe.

An element is part of the attack surface if **any** of these is true:

| Criterion | Question it answers |
| --- | --- |
| **Reachable** | Can an actor I control send bytes to it? |
| **Translates** | Does it take input and turn it into something else — a query, a command, a path, a render? |
| **Brokers trust** | Does something upstream trust its output without checking? |
| **Holds authority** | Does it hold credentials, keys, or a privilege that others assume it has? |

Then give the **prioritisation** rule, because a rubric that ranks nothing is just a list:

> *Guide:* something like reachability × capability × blast radius, divided by cost of proving.
> Writing the formula down matters more than the formula itself — it forces the tradeoff to be
> explicit and it is what stops you from spending an hour on a debug port.

## The inventory

One row per element. Keep it to what is *relevant* — the rubric in the previous section is what
earns a row.

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| | | | | |

> *Guide on columns:* **Purpose** is why it exists, in the owner's words, not its protocol name.
> **Trust boundary** is the interesting column: mark where an assumption lives that nobody is
> verifying. **Fails into** is the consequence of misbehaving, which tells you what the owner will
> have hardened and what they will have ignored.

## From element to vector

A vector is not "port 8080 is open". A vector answers five questions:

1. **Actor** — who am I at this point in the engagement?
2. **Precondition** — what must already be true for this to work?
3. **Primitive** — what single capability does it hand me?
4. **Consequence** — what does that capability unlock next?
5. **Objective** — does it move toward the goal, or just sideways?

If any answer is *unknown* rather than *yes*, it is a lead, not a vector.

Then, for each surviving candidate, the reasoning chain in prose. And — this is the part that makes
the article credible — the candidates you **killed**, with the criterion that killed them:

> **Rejected**
> `element` — fails on *primitive*: it gives information, not access. Three more hours here would
> buy a version string.

> **Plain terms**
> One short paragraph unpacking the filter itself, before the candidates. This is the single most
> important explanation in the article: it is the difference between "here is a trick" and "here is
> how I decide".

## Execution

The technical proof. Commands with real output, but only the output that carried a decision.

> *Guide:* if a command produced nothing that changed your mind, cut it. Every screenshot and every
> line of output should be evidence for a claim made above. Show the request and the response for
> web work, the query and the row count for data work, the process tree for host work.

Keep it minimal. The article is about the reasoning; execution is what makes the reasoning checkable.

## In plain terms

The whole article retold as one narrative, no jargon, no commands, no product names. Someone who has
never opened a terminal should be able to follow it and end up with the right mental model.

> *Guide:* this is the "apples" layer. Write it as a story about people and intent, not about
> protocols. Length is not the goal — if it needs more than a few paragraphs, the technical layer
> above is doing too much explaining on its own.

## Carry-over

The reusable part: the checklist, the two or three questions, the rule of thumb. Something the
reader can apply to a target neither of you has ever seen.

Close with what the approach does **not** cover. A method with stated limits is usable; a method
presented as complete is not.