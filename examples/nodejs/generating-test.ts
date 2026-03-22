#!/usr/bin/env npx tsx
/**
 * GENERATING 状态测试 — 是否触发"对方正在输入"
 *
 * 测试3种场景:
 * 发 "1" → 只发 GENERATING（空文本），等 5s，再发 FINISH
 * 发 "2" → 只发 GENERATING（带文本），等 5s，再发 FINISH
 * 发 "3" → 用 sendtyping API 做对照
 */

import { WeixinBot, type IncomingMessage } from '@pinixai/weixin-bot'
import { randomBytes, randomUUID } from 'node:crypto'

const bot = new WeixinBot({ onError: (e) => console.error('[ERROR]', e) })
const creds = await bot.login()
console.log(`[INFO] 登录成功: ${creds.accountId}`)

function uin(): string {
  return Buffer.from(String(randomBytes(4).readUInt32BE(0)), 'utf8').toString('base64')
}

function headers() {
  return {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    Authorization: `Bearer ${creds.token}`,
    'X-WECHAT-UIN': uin(),
  }
}

const base = creds.baseUrl.replace(/\/+$/, '')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function sendMsg(to: string, text: string, ctx: string, state: number, cid: string) {
  const r = await fetch(`${base}/ilink/bot/sendmessage`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      msg: { from_user_id: '', to_user_id: to, client_id: cid,
        message_type: 2, message_state: state, context_token: ctx,
        item_list: text ? [{ type: 1, text_item: { text } }] : [],
      },
      base_info: { channel_version: '1.0.0' },
    }),
  })
  return { ok: r.ok, body: await r.text() }
}

async function doTyping(to: string, ctx: string) {
  // 先获取 typing_ticket
  const cfgRes = await fetch(`${base}/ilink/bot/getconfig`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      ilink_user_id: to, context_token: ctx,
      base_info: { channel_version: '1.0.0' },
    }),
  })
  const cfg = await cfgRes.json() as any
  const ticket = cfg.typing_ticket
  if (!ticket) {
    console.log('[TYPING] 没有获取到 typing_ticket:', JSON.stringify(cfg))
    return
  }
  console.log('[TYPING] 获取到 typing_ticket')

  // 发送 typing 状态
  const r = await fetch(`${base}/ilink/bot/sendtyping`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      ilink_user_id: to, typing_ticket: ticket, status: 1,
      base_info: { channel_version: '1.0.0' },
    }),
  })
  console.log(`[TYPING] sendtyping status=1 → ${r.status}`)
}

bot.onMessage(async (msg: IncomingMessage) => {
  const mode = msg.text.trim()
  console.log(`\n[RECV] "${mode}"`)

  const cid = randomUUID()

  if (mode === '1') {
    // 场景1: GENERATING 空文本 → 等5s → FINISH
    console.log('[TEST 1] 发送 GENERATING（空文本）...')
    const r1 = await sendMsg(msg.userId, '', msg._contextToken, 1, cid)
    console.log(`[TEST 1] → ${r1.ok} ${r1.body}`)
    console.log('[TEST 1] 等 5 秒...（看微信是否显示"正在输入"）')
    await sleep(5000)
    console.log('[TEST 1] 发送 FINISH')
    const r2 = await sendMsg(msg.userId, '场景1完成：GENERATING空文本 → FINISH', msg._contextToken, 2, cid)
    console.log(`[TEST 1] → ${r2.ok} ${r2.body}`)

  } else if (mode === '2') {
    // 场景2: GENERATING 带文本 → 等5s → FINISH
    console.log('[TEST 2] 发送 GENERATING（带文本 "思考中..."）...')
    const r1 = await sendMsg(msg.userId, '思考中...', msg._contextToken, 1, cid)
    console.log(`[TEST 2] → ${r1.ok} ${r1.body}`)
    console.log('[TEST 2] 等 5 秒...（看微信是否显示"正在输入"）')
    await sleep(5000)
    console.log('[TEST 2] 发送 FINISH')
    const r2 = await sendMsg(msg.userId, '场景2完成：GENERATING带文本 → FINISH', msg._contextToken, 2, cid)
    console.log(`[TEST 2] → ${r2.ok} ${r2.body}`)

  } else if (mode === '3') {
    // 场景3: sendtyping 对照
    console.log('[TEST 3] 调用 sendtyping...')
    await doTyping(msg.userId, msg._contextToken)
    console.log('[TEST 3] 等 5 秒...（看微信是否显示"正在输入"）')
    await sleep(5000)
    console.log('[TEST 3] 发送 FINISH')
    await bot.reply(msg, '场景3完成：sendtyping 对照')

  } else {
    await bot.reply(msg, '发 1/2/3 测试不同场景\n1=GENERATING空文本\n2=GENERATING带文本\n3=sendtyping对照')
  }
})

console.log('[INFO] 发 1/2/3 测试不同场景')
console.log('[INFO] ────────────────────────────────────')
await bot.run()
