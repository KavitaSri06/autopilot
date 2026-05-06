import json
import os
import re
from typing import Any, Dict

import google.generativeai as genai
from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if GEMINI_API_KEY:
	genai.configure(api_key=GEMINI_API_KEY)


def _get_supabase_client() -> Client:
	if not SUPABASE_URL or not SUPABASE_KEY:
		raise ValueError("Supabase environment variables are not configured")
	return create_client(SUPABASE_URL, SUPABASE_KEY)


def _limit_to_three_sentences(text: str) -> str:
	parts = re.split(r"(?<=[.!?])\s+", text.strip())
	parts = [part.strip() for part in parts if part.strip()]
	if not parts:
		return ""
	return " ".join(parts[:3])


def _mentions_booking(message: str) -> bool:
	keywords = ["book", "booking", "appointment", "schedule", "reserve"]
	lower_message = message.lower()
	return any(keyword in lower_message for keyword in keywords)


def extract_lead_info(message: str) -> Dict[str, str]:
	"""Extract name and phone number from a customer message using Gemini."""
	try:
		if not GEMINI_API_KEY:
			return {"name": "", "phone": ""}

		prompt = (
			'Extract the person\'s name and phone number from this message. '
			'Return ONLY a JSON object like this exact format: '
			'{"name": "extracted name", "phone": "extracted phone"} '
			'If name not found return empty string. '
			'If phone not found return empty string. '
			f'Message: {message}'
		)

		model = genai.GenerativeModel("gemini-2.5-flash")
		result = model.generate_content(prompt)
		response_text = (result.text or "").strip()

		if not response_text:
			return {"name": "", "phone": ""}

		try:
			extracted = json.loads(response_text)
			return {
				"name": (extracted.get("name") or "").strip(),
				"phone": (extracted.get("phone") or "").strip(),
			}
		except json.JSONDecodeError:
			return {"name": "", "phone": ""}
	except Exception as exc:
		print(f"extract_lead_info error: {exc}")
		return {"name": "", "phone": ""}


def get_business_info(business_id: str) -> Dict[str, Any]:
	"""Fetch business profile details from Supabase businesses table."""
	default_profile: Dict[str, Any] = {
		"name": "Business",
		"services": "Not provided",
		"timings": "Not provided",
		"pricing": "Not provided",
		"faqs": "Not provided",
	}

	try:
		supabase = _get_supabase_client()
		response = (
			supabase.table("businesses")
			.select("name, services, timings, pricing, faqs")
			.eq("id", business_id)
			.limit(1)
			.execute()
		)

		rows = response.data or []
		if not rows:
			return default_profile

		row = rows[0]
		return {
			"name": row.get("name") or default_profile["name"],
			"services": row.get("services") or default_profile["services"],
			"timings": row.get("timings") or default_profile["timings"],
			"pricing": row.get("pricing") or default_profile["pricing"],
			"faqs": row.get("faqs") or default_profile["faqs"],
		}
	except Exception as exc:
		print(f"get_business_info error: {exc}")
		return default_profile


def generate_ai_reply(business_id: str, message: str) -> str:
	"""Generate an assistant reply grounded in business profile data."""
	try:
		if not GEMINI_API_KEY:
			raise ValueError("GEMINI_API_KEY is not configured")

		business_info = get_business_info(business_id)

		system_prompt = (
			"You are an AI business assistant helping customers for this business. "
			f"Business name: {business_info['name']}. "
			f"Services: {business_info['services']}. "
			f"Timings: {business_info['timings']}. "
			f"Pricing: {business_info['pricing']}. "
			f"FAQs: {business_info['faqs']}. "
			"Give a concise helpful reply in under 3 sentences. "
			"After answering the customer\'s first question, always end your reply by asking: "
			"\"May I know your name and phone number so we can follow up with you personally? 😊\" "
			"If the customer shares their name and phone number in any message, acknowledge it warmly with: "
			"\"Thank you [name]! We\'ve noted your details and will follow up with you shortly.\""
		)

		# Extract lead info to detect if customer shared name and phone
		extracted_info = extract_lead_info(message)
		customer_name = extracted_info.get("name", "").strip()
		customer_phone = extracted_info.get("phone", "").strip()

		model = genai.GenerativeModel("gemini-2.5-flash")
		result = model.generate_content(f"{system_prompt}\n\nCustomer message: {message}")
		reply_text = (result.text or "").strip()

		if not reply_text:
			reply_text = "I can help with that. Could you share a bit more detail about what you need?"

		reply_text = _limit_to_three_sentences(reply_text)

		# If customer provided name and phone, add acknowledgement
		if customer_name and customer_phone:
			acknowledge = f"Thank you {customer_name}! We\'ve noted your details and will follow up with you shortly."
			reply_text = _limit_to_three_sentences(f"{reply_text} {acknowledge}")

		return reply_text
	except Exception as exc:
		print(f"generate_ai_reply error: {exc}")
		return (
			"Sorry, something went wrong on our side. "
			"Please try again in a moment."
		)
