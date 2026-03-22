#!/usr/bin/env python3
"""
WeChat Echo Bot — 完整示例

功能：
  1. 首次运行扫码登录（终端渲染二维码），凭证自动保存
  2. 后续运行自动加载已保存凭证，跳过扫码
  3. 收到消息后显示"正在输入"，然后回复 "Echo: ..."
  4. Session 过期时自动重新扫码

用法：
  uv run examples/python/echo_bot.py
  uv run examples/python/echo_bot.py --force-login

依赖（example 自带，不影响 SDK）：
  qrcode — 终端二维码渲染
"""
from __future__ import annotations

import logging
import sys
import time

from weixin_bot import WeixinBot

# ── 二维码渲染：拦截 SDK 输出的 URL ──────────────────────────────────────

_orig_stderr_write = sys.stderr.write

def _stderr_hook(s: str) -> int:
    if s.startswith("https://") and "qrcode=" in s:
        url = s.strip()
        try:
            import qrcode
            qr = qrcode.QRCode(border=2)
            qr.add_data(url)
            qr.make(fit=True)
            matrix = qr.get_matrix()
            rows = len(matrix)
            for y in range(0, rows, 2):
                line = []
                for x in range(len(matrix[0])):
                    top = matrix[y][x]
                    bot = matrix[y + 1][x] if y + 1 < rows else False
                    if top and bot:
                        line.append("█")
                    elif top and not bot:
                        line.append("▀")
                    elif not top and bot:
                        line.append("▄")
                    else:
                        line.append(" ")
                _orig_stderr_write("".join(line) + "\n")
        except ImportError:
            pass
    return _orig_stderr_write(s)

sys.stderr.write = _stderr_hook  # type: ignore[assignment]

# ── 日志 ──────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(message)s")

def log(level: str, msg: str) -> None:
    ts = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
    logging.info("%s [%s] %s", ts, level, msg)

# ── 启动 ──────────────────────────────────────────────────────────────────

force_login = "--force-login" in sys.argv

bot = WeixinBot(on_error=lambda err: log("ERROR", str(err)))

log("INFO", "强制重新扫码登录..." if force_login else "正在登录（已有凭证则自动跳过扫码）...")
creds = bot.login(force=force_login)
log("INFO", f"登录成功 — Bot ID: {creds.account_id}")
log("INFO", f"关联用户: {creds.user_id}")
log("INFO", f"API 地址: {creds.base_url}")

message_count = 0
start_time = time.time()


@bot.on_message
async def handle(msg):
    global message_count
    message_count += 1
    elapsed = int(time.time() - start_time)

    log("RECV", f"#{message_count} | 类型: {msg.type} | 用户: {msg.user_id}")
    log("RECV", f"内容: {msg.text}")

    try:
        await bot.send_typing(msg.user_id)
    except Exception:
        pass

    reply = f"Echo: {msg.text}"

    try:
        await bot.reply(msg, reply)
        log("SEND", f"回复成功 ({len(reply)} 字符) | 运行 {elapsed}s | 累计 {message_count} 条")
    except Exception as err:
        log("ERROR", f"回复失败: {err}")


log("INFO", "开始接收微信消息 (Ctrl+C 停止)")
log("INFO", "────────────────────────────────────")

try:
    bot.run()
except KeyboardInterrupt:
    log("INFO", f"Bot 已停止，共处理 {message_count} 条消息")
