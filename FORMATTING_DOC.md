# Static Title Formatting Guide
The custom title field supports tokens and conditionals that get replaced with live Discord state whenever the title updates.

If the format string contains no tokens or conditionals, it's used as-is. If it's left blank, the title falls back to "Equibop".

---

## Tokens
Tokens are written as `{name}` and get replaced with the current value when the title updates. If a token has no value in the current context (e.g. `{channel}` while on the home screen), it's replaced with an empty string.

### Discord tokens
Pulled from live Discord state, and updated as that state changes.

| Token | Description |
|---|---|
| `{username}` | Your account username (e.g. `hello_im_a_username`) |
| `{display_name}` | Your display name, falls back to username if none is set |
| `{ping}` | The ping indicator from Discord's title. Either `(int)` for a count or `•` for an unread dot |
| `{channel}` | The current channel name. `#` is kept as-is, leading `@` is stripped for DMs. |
| `{server}` | The current server name |
| `{channel_desc}` | The topic of the current channel, if it has one |
| `{serv_member_count}` | Total member count of the current server |
| `{serv_online_count}` | Online member count of the current server. |

### Utility tokens
Not tied to Discord states, useful for those who want a mIRC-style setup.

| Token | Description |
|---|---|
| `{time}` | The current time in your system's local timezone |
| `{time-utc}` | The current time in UTC |
| `{time-utc+8}` / `{time-utc-8}` | The current time at a fixed UTC offset in whole hours |
| `{12h}` | The current AM/PM indicator (`am`/`pm`) |
| `{12h-caps}` | Same as `{12h}`, but capitalized (`AM`/`PM`) |

The `{time}` token and its derivatives all use 24-hour time unless `{12h}` / `{12h-caps}` is added, it'll then automatically switch to 12-hour time.

---

## Conditionals
Conditionals let you include or exclude parts of the title based on context.

```
if(condition){content}
```

If the condition is true, `content` is included. If false, it's dropped entirely. Tokens inside the content block work normally.

### Available conditions
| Condition | True when |
|---|---|
| `in_server` | You're in a server |
| `no_server` | You're not in a server (home screen, DMs) |
| `in_dm` | You're in a DM or group DM |
| `has_ping` | There's at least one unread ping |
| `no_ping` | There are no pings |
| `has_channel` | A channel is selected |
| `has_channel_desc` | The current channel has a topic set |

Conditionals can nest and you may also put an exclamation mark at the start of a conditional for false conditionals.