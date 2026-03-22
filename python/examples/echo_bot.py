from __future__ import annotations

import logging

from weixin_bot import WeixinBot


logging.basicConfig(level=logging.INFO, format="%(message)s")

bot = WeixinBot()
bot.login()


@bot.on_message
async def handle(msg):
    logging.info("[%s] %s: %s", msg.timestamp.strftime("%X"), msg.user_id, msg.text)
    await bot.send_typing(msg.user_id)
    await bot.reply(msg, f"你说了: {msg.text}")


logging.info("Bot is running. Press Ctrl+C to stop.")

try:
    bot.run()
except KeyboardInterrupt:
    bot.stop()
