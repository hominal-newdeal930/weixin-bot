# weixin-bot-sdk

Python SDK for the WeChat iLink Bot API.

## Install

```bash
cd python
pip install .
```

## Quick Start

```python
from weixin_bot import WeixinBot

bot = WeixinBot()
bot.login()


@bot.on_message
async def handle(msg):
    print(f"{msg.user_id}: {msg.text}")
    await bot.send_typing(msg.user_id)
    await bot.reply(msg, f"你说了: {msg.text}")


bot.run()
```

## API Reference

### `WeixinBot(base_url=None, token_path=None, on_error=None)`

Creates a bot client.

- `base_url`: Override the iLink API base URL.
- `token_path`: Override the credential file path. Default: `~/.weixin-bot/credentials.json`
- `on_error`: Receive polling or handler errors.

### `bot.login(force=False)`

Starts QR login if needed, stores credentials locally, and returns the active session.

### `@bot.on_message`

Registers an async or sync message handler. Each inbound user message is converted into:

```python
IncomingMessage(
    user_id: str,
    text: str,
    type: Literal["text", "image", "voice", "file", "video"],
    raw: dict,
    _context_token: str,
    timestamp: datetime,
)
```

### `await bot.reply(msg, text)`

Replies to an inbound message using that message's `context_token`. It also triggers `stop_typing()` in the background after the reply is sent.

### `await bot.send_typing(user_id)`

Shows the typing indicator in the WeChat chat. The SDK fetches the required `typing_ticket` through `getconfig`.

### `await bot.stop_typing(user_id)`

Cancels the typing indicator.

### `await bot.send(user_id, text)`

Sends a proactive text message using the latest cached `context_token` for that user. This only works after the SDK has seen at least one inbound message from that user.

### `bot.run()`

Starts the long-poll loop, dispatches incoming messages to registered handlers, reconnects on transient failures, and forces a fresh QR login if the session expires.

### `bot.stop()`

Stops the long-poll loop gracefully.

## How It Works

1. `login()` fetches a QR login URL, waits for WeChat confirmation, and saves the returned bot token.
2. `run()` performs long polling against `getupdates`.
3. Each inbound message is normalized into `IncomingMessage` and sent to your callbacks.
4. `reply()` and `send()` reuse the internally managed `context_token` required by the protocol.
5. On `errcode = -14`, the SDK clears saved credentials, requests a fresh QR login, and resumes polling with exponential backoff.

## Notes

- Credentials are stored at `~/.weixin-bot/credentials.json` with mode `0o600`.
- The package tries to render the QR code in the terminal if `qrcode` is installed, otherwise it prints the URL to stderr.
- Long-poll requests use a 40-second timeout and send operations use a 15-second timeout.
- Text messages are split into 2000-character chunks automatically.

## License

MIT
