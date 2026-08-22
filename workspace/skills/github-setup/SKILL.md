---
name: github-setup
description: Connect a person's own GitHub account to Gorkie, or work out why GitHub is failing for them. Use when someone asks how to connect, sign in to, or link GitHub, when they ask why GitHub tools are missing, or when a GitHub call fails on authentication or permissions.
---

# GitHub Setup

Connecting happens in Gorkie's **App Home**, never in chat. A token pasted into Slack is readable by everyone in the channel and stays in history. If someone pastes one anyway, tell them to delete it at <https://github.com/settings/tokens> and start again in App Home.

## Sending someone to connect

1. Click **Gorkie** in the Slack sidebar, then open the **Home** tab.
2. In the **GitHub** section, click **Sign in with GitHub**.
3. Follow the steps in the modal. The token link opens GitHub with the name and scopes already filled in.

The modal is the source of truth. Summarise it, do not invent extra steps or extra permissions.

## The link and what it asks for

The button opens:

```
https://github.com/settings/tokens/new?description=Gorkie&scopes=repo,read:org,read:user
```

That is GitHub's own classic-token page. The query string only pre-fills the form, so the boxes arrive ticked and nobody has to work out which they need. Nothing is granted until they click **Generate token**, and they can untick anything before they do.

The three prefilled scopes:

| scope | what it lets Gorkie do | why |
| --- | --- | --- |
| `repo` | read code, create branches, open and comment on issues and pull requests | the only scope that covers private repos, and the one every write needs |
| `read:org` | see the orgs and teams they belong to | resolving `owner/repo` and org-level searches |
| `read:user` | read their own profile | attributing actions and looking up their account |

`repo` is broad: it is full control of every repository the account can reach, public and private, and classic tokens cannot be narrowed to specific repos. If someone is uneasy about that, say so plainly. Their options are to make a token on a machine account with access to fewer repos, or to skip GitHub. Do not pretend the scope is narrower than it is.

Optional extras they can tick on the same page: `workflow` for GitHub Actions, `gist`, `notifications`, `codespace`, `delete_repo`, `project`, `read:packages` or `write:packages`.

It has to be a **classic** token. Fine-grained tokens are rejected at connect time: the GitHub MCP server works in classic scopes, and `gist`, `notifications`, and `codespace` have no fine-grained equivalent.

## After connecting

Gorkie acts **as them**. It reaches exactly what their account reaches, and their name is on every issue, comment, and pull request it opens. Different people in one thread can be connected as different accounts, so act on behalf of whoever made the current request, not whoever spoke first.

Reads happen without asking. Anything that writes, opening a pull request, commenting, merging, pushing, editing a file, waits for that person to approve it. Say what you are about to do before making the call, so the approval prompt is not the first they hear of it.

## When GitHub does not work

**No GitHub tools at all** means nobody has connected in this thread. Send them to App Home. Do not report GitHub as broken or unsupported.

**A 401, or a token error** means the token has expired or been deleted. App Home may still show them as signed in, so trust the failure over the display. They reconnect the same way.

**A 403 on a write** usually means the token is missing the scope for it. Reconnecting with the prefilled link fixes the common cases; anything unusual (an org that blocks tokens, SAML enforcement, a protected branch) is worth naming so they can decide.

Never guess at which of these it is when the error says. Quote the actual failure.

## Never

- Ask for, repeat, or write down a token, in chat, a file, or the sandbox.
- Suggest adding GitHub as a custom MCP server. It has its own section and is rejected there.
- Claim GitHub is connected, or that an action succeeded, without a tool result showing it.
