import os
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv
from fastapi import APIRouter

from services.ai_service import generate_ai_reply
from services.db_service import save_conversation, save_lead


load_dotenv()

router = APIRouter()

DEFAULT_BUSINESS_ID = os.getenv("DEFAULT_BUSINESS_ID", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


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


def _extract_message_payload(update: Dict[str, Any]) -> tuple[Optional[int], Optional[str]]:
	message = update.get("message") or {}
	chat = message.get("chat") or {}
	chat_id = chat.get("id")
	text = message.get("text")
	return chat_id, text


@router.post("/webhook/telegram", status_code=200)
def telegram_webhook(update: Dict[str, Any]) -> Dict[str, str]:
	try:
		chat_id, text = _extract_message_payload(update)
		if not chat_id or not text:
			return {"status": "ignored"}

		business_id = DEFAULT_BUSINESS_ID
		reply = generate_ai_reply(business_id, text)
		send_telegram_message(chat_id, reply)

		customer_name = ""
		phone = ""
		source = "telegram"
		save_lead(business_id, customer_name, phone, text, source)
		save_conversation(business_id, str(chat_id), text, reply)

		return {"status": "ok"}
	except Exception as exc:
		print(f"telegram_webhook error: {exc}")
		return {"status": "ok"}
