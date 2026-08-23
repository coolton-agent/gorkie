---
name: github-setup
description: Connect a person's own GitHub account to Gorkie, or work out why GitHub is failing for them. Use when someone asks how to connect, sign in to, or link GitHub, when they ask why GitHub tools are missing, or when a GitHub call fails on authentication or permissions.
---

# GitHub Setup

Connecting happens in Gorkie's **App Home**. There is no token to create and nothing to paste, so never ask anyone for one.

## Sending someone to connect

Everyone installs on their own account, so both steps apply to each person.

1. Click **Gorkie** in the Slack sidebar, then open the **Home** tab.
2. Click **Sign in with GitHub**. Both steps then appear in the Home tab itself.
3. **Choose repositories** at <https://github.com/apps/gorkie-slack/installations/new>. This decides what Gorkie can reach. "Only select repositories" is the narrow choice.
4. **Prove who they are**: open <https://github.com/login/device>, enter the code shown, approve. The Home tab updates on its own.

The code lasts about 15 minutes. If it runs out, click **Start over**.

Signing in on its own grants **no access to any code**, which is the confusing case: Gorkie can still search public repositories, so it looks connected while every write fails. App Home says "not installed on any repositories yet" when this has happened, with a **Choose repositories** button. Anyone reporting that Gorkie cannot see their repo, or sees too many, is asking about step 3.

Once connected, **Manage repositories** in App Home links to <https://github.com/settings/installations>, where they can add or remove repositories at any time.

## What they are granting

Gorkie signs in as a GitHub App, so permissions are fixed by the app itself and cannot be set wrong by the person connecting. What they do choose is **which repositories**, at step 3.

Their access is the narrowest of three things: the repos they picked, what the app is allowed to do, and what their own account can already do. Gorkie can never reach something they could not reach themselves.

Picking "All repositories" is what makes Gorkie able to reach everything; "Only select repositories" is the narrow choice.

## After connecting

Gorkie acts **as them**. Their name is on every issue, comment, and pull request it opens. Different people in one thread can be connected as different accounts, so act on behalf of whoever made the current request, not whoever spoke first.

Whether a call waits for approval is that person's own setting, chosen per connection in App Home. GitHub has its own, and so does each MCP server they have added. The default asks before writing or deleting; the alternatives are asking for every call, or asking only before deleting. Someone who finds the prompts tiring should change that setting rather than be talked out of caring.

Whatever the setting, say what you are about to do before a call that changes anything, so an approval prompt is never the first they hear of it, and so that someone who has turned prompts down still knows what happened.

Approving is a prompt, not a limit. What Gorkie can reach at all comes from the repositories they installed it on, and from branch protection on GitHub. If someone asks to be stopped from touching a branch, that is a GitHub rule, not something an approval setting can guarantee.

## When GitHub does not work

**No GitHub tools at all** means nobody has connected in this thread. Send them to App Home. Do not report GitHub as broken or unsupported.

**A 401** means their sign-in has lapsed and could not be renewed. Sign-ins are refreshed automatically, so this usually means it has been idle a long time or they revoked access. They reconnect the same way.

**A 404 on a repo that exists** usually means it was not in the list they picked, which reads as "not found" rather than "forbidden". Send them to <https://github.com/settings/installations> to add it.

**A 403 on a write** is a rule on GitHub's side rather than a missing permission: branch protection, required reviews on a merge, SAML enforcement, or an org that has not approved the app. Name the actual cause instead of telling them to reconnect.

Quote the real error rather than guessing between these.

## Never

- Ask for, repeat, or write down a token or a device code.
- Suggest adding GitHub as a custom MCP server. It has its own section and is rejected there.
- Claim GitHub is connected, or that an action succeeded, without a tool result showing it.
