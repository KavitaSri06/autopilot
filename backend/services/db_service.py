import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


def get_supabase_client() -> Client:
	if not SUPABASE_URL or not SUPABASE_KEY:
		raise ValueError("SUPABASE_URL or SUPABASE_KEY is not configured")
	return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_all_leads() -> List[Dict[str, Any]]:
	try:
		supabase = get_supabase_client()
		response = supabase.table("leads").select("*").order("created_at", desc=True).execute()
		return response.data or []
	except Exception as exc:
		print(f"get_all_leads error: {exc}")
		return []


def save_lead(
	business_id: str,
	customer_name: str,
	phone: str,
	query: str,
	source: str,
) -> Optional[Dict[str, Any]]:
	try:
		supabase = get_supabase_client()
		payload = {
			"business_id": business_id,
			"customer_name": customer_name,
			"phone": phone,
			"query": query,
			"source": source,
		}
		response = supabase.table("leads").insert(payload).execute()
		rows = response.data or []
		return rows[0] if rows else None
	except Exception as exc:
		print(f"save_lead error: {exc}")
		return None


def save_conversation(
	business_id: str,
	customer_id: str,
	message: str,
	reply: str,
) -> Optional[Dict[str, Any]]:
	try:
		supabase = get_supabase_client()
		payload = {
			"business_id": business_id,
			"customer_id": customer_id,
			"message": message,
			"reply": reply,
		}
		response = supabase.table("conversations").insert(payload).execute()
		rows = response.data or []
		return rows[0] if rows else None
	except Exception as exc:
		print(f"save_conversation error: {exc}")
		return None


def get_business(business_id: str) -> Optional[Dict[str, Any]]:
	try:
		supabase = get_supabase_client()
		response = supabase.table("businesses").select("*").eq("id", business_id).limit(1).execute()
		rows = response.data or []
		return rows[0] if rows else None
	except Exception as exc:
		print(f"get_business error: {exc}")
		return None
