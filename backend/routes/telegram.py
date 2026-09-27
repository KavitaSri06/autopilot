import hmac
import os
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException

from services.ai_service import generate_ai_reply
from services.db_service import save_conversation, save_lead


load_dotenv()

router = APIRouter()

DEFAULT_BUSINESS_ID = os.getenv("DEFAULT_BUSINESS_ID", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Telegram echoes this back in X-Telegram-Bot-Api-Secret-Token on every update,
# but only if it was registered via setWebhook. Until it is, the endpoint stays
# open to anyone who knows the URL — hence the startup warning.
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

if not TELEGRAM_WEBHOOK_SECRET:
	print(
		"WARNING: TELEGRAM_WEBHOOK_SECRET is unset — /webhook/telegram accepts "
		"unverified requests. Set it and re-register the webhook with setWebhook."
	)


def send_telegram_message(chat_id: int, text: str) -> bool:
	try:
		if not TELEGRAM_BOT_TOKEN:
			raise ValueError("TELEGRAM_BOT_TOKEN is not configured")

		url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
		response = requests.post(
			url,
			json={"chat_id": chat_id, "text": text},
			timeout=10,
		)
		response.raise_for_status()
		return True
	except Exception as exc:
		print(f"send_telegram_message error: {exc}")
		return False


def _extract_message_payload(update: Dict[str, Any]) -> tuple[Optional[int], Optional[str], str]:
	message = update.get("message") or {}
	sender = message.get("from") or {}
	chat = message.get("chat") or {}
	chat_id = chat.get("id")
	text = message.get("text")
	first_name = (sender.get("first_name") or "").strip()
	last_name = (sender.get("last_name") or "").strip()
	username = (sender.get("username") or "").strip()

	customer_name = f"{first_name} {last_name}".strip()
	if not customer_name:
		customer_name = username or "Customer"

	return chat_id, text, customer_name


@router.post("/webhook/telegram", status_code=200)
def telegram_webhook(
	update: Dict[str, Any],
	x_telegram_bot_api_secret_token: Optional[str] = Header(default=None),
) -> Dict[str, str]:
	# Deliberately outside the try below: that block swallows everything and
	# returns 200, which would turn a rejected forgery into a success.
	if TELEGRAM_WEBHOOK_SECRET:
		if not x_telegram_bot_api_secret_token or not hmac.compare_digest(
			x_telegram_bot_api_secret_token, TELEGRAM_WEBHOOK_SECRET
		):
			raise HTTPException(status_code=403, detail="Invalid webhook secret token")

	try:
		chat_id, text, customer_name = _extract_message_payload(update)
		if not chat_id or not text:
			return {"status": "ignored"}

		business_id = DEFAULT_BUSINESS_ID
		reply, lead_info = generate_ai_reply(business_id, text)
		send_telegram_message(chat_id, reply)

		# Previously hardcoded to "" — Telegram leads could never capture a phone
		# number on the one channel that is actually live.
		phone = lead_info.get("phone") or ""
		source = "telegram"
		save_lead(business_id, customer_name, phone, text, source)
		save_conversation(business_id, str(chat_id), text, reply)

		return {"status": "ok"}
	except Exception as exc:
		print(f"telegram_webhook error: {exc}")
		return {"status": "ok"}
