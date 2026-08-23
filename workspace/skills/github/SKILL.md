---
name: github
description: Connect a person's own GitHub account to Gorkie, or work out why GitHub is failing for them. Use when someone asks how to connect, sign in to, or link GitHub, when they ask why GitHub tools are missing, or when a GitHub call fails on authentication or permissions.
---

# GitHub setup

Connecting happens in Gorkie's **Home** tab. There is no token to create and nothing to paste, so never ask anyone for one.

## Sending someone to connect

Everyone installs on their own account, so both steps apply to each person.

1. Click **Gorkie** in the Slack sidebar, then open the **Home** tab.
2. Click **Sign in with GitHub**. Both steps below then appear in the modal that opens.
3. **Choose repositories** at <https://github.com/apps/gorkie-slack/installations/new>. This decides what Gorkie can reach. "Only select repositories" is the narrow choice.
4. **Prove who they are**: open <https://github.com/login/device>, enter the code shown, approve. The Home tab updates on its own.

The code lasts about 15 minutes. If it runs out, click **Sign in with GitHub** again for a new one.

Signing in on its own grants no access to any code. That is the confusing case, because Gorkie can still search public repositories, so it looks connected while every write fails. The Home tab says "Not installed on any repositories, so Gorkie cannot reach your code" when this has happened, next to a **Choose repositories** button. Anyone reporting that Gorkie cannot see their repo, or sees too many, is asking about step 3.

Once connected, **Manage repositories** links to <https://github.com/settings/installations>, where they add or remove repositories at any time.

## What they are granting

Gorkie signs in as a GitHub App, so the app fixes its own permissions and the person connecting cannot set them wrong. What they choose is which repositories, at step 3.

Their access is the narrowest of three things: the repos they picked, what the app is allowed to do, and what their own account can already do. Gorkie can never reach something they could not reach themselves.

Picking "All repositories" at step 3 hands over every repo on the account, which is almost never what someone means.

## After connecting

Gorkie acts as them. Their name is on every issue, comment, and pull request it opens. Different people in one thread can be connected as different accounts, so act on behalf of whoever made the current request, not whoever spoke first.

Whether a call waits for approval is that person's own setting, chosen per connection under **Configure** in the Home tab. GitHub has its own setting, and so does each MCP server they have added. The default asks before writing or deleting; the alternatives are asking for every call, or asking only before deleting. Someone who finds the prompts tiring should change that setting rather than be talked out of caring.

Whatever the setting, say what you are about to do before a call that changes anything, so an approval prompt is never the first they hear of it, and so that someone who has turned prompts down still knows what happened.

Approving is a prompt, not a limit. What Gorkie can reach at all comes from the repositories they installed it on, and from branch protection on GitHub. If someone asks to be stopped from touching a branch, that is a GitHub rule, not something an approval setting can guarantee.

## Getting work out of the sandbox and into a repo

Gorkie writes code in its sandbox, but the sandbox holds no GitHub credentials and cannot `git push`. The GitHub tools run on the host instead, so the file contents travel through a tool call rather than over git.

The sequence:

1. Build and test in the sandbox as normal.
2. `create_branch` off the default branch.
3. `read_file` each file that changed, then `push_files` with `{ path, content }` for all of them. One call is one commit, so push the whole change together rather than file by file.
4. `create_pull_request`, and report the URL it returns.

Every file's contents pass through the tool call, so this suits a handful of edited files. For anything larger, say what stands in the way rather than pushing a partial change: a hundred-file refactor is not something this path carries well.

Never claim a branch, commit, or pull request exists without a tool result showing it. `git push` from inside the sandbox will fail, and the failure will look like a network problem rather than a missing credential.

## When GitHub does not work

**No GitHub tools at all** means nobody has connected in this thread. Send them to the Home tab. Do not report GitHub as broken or unsupported.

**A 401** means their sign-in lapsed and could not be renewed. Gorkie refreshes sign-ins on its own, so a 401 usually means the account sat idle a long time or they revoked access. They reconnect the same way.

**A 404 on a repo that exists** usually means the repo was not in the list they picked. GitHub reports that as "not found" rather than "forbidden". Send them to <https://github.com/settings/installations> to add it.

**A 403 on a write** is a rule on GitHub's side rather than a missing permission: branch protection, required reviews on a merge, SAML enforcement, or an org that has not approved the app. Name the actual cause instead of telling them to reconnect.

Quote the real error rather than guessing between these.

## Never

- Ask for, repeat, or write down a token or a device code.
- Suggest adding GitHub as a custom MCP server. It has its own section, and the MCP form rejects it.
- Claim GitHub is connected, or that an action succeeded, without a tool result showing it.
