# AI Business Autopilot - Main Application
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.ai_service import generate_ai_reply
from services.db_service import get_all_leads, get_supabase_client
from routes.telegram import router as telegram_router


load_dotenv()

app = FastAPI(title="AI Business Autopilot")
app.include_router(telegram_router)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class ChatRequest(BaseModel):
	business_id: str
	message: str


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    services: Optional[str] = None
    timings: Optional[str] = None
    pricing: Optional[str] = None
    faqs: Optional[str] = None
    appointment_required: Optional[bool] = None
    walkins_welcome: Optional[bool] = None
    booking_instructions: Optional[str] = None
    special_notes: Optional[str] = None
    telegram_chat_id: Optional[str] = None


@app.get("/health")
def health() -> Dict[str, str]:
	return {
		"status": "ok",
		"message": "AI Business Autopilot is running",
	}


@app.post("/chat")
def chat(chat_request: ChatRequest) -> Dict[str, str]:
    from services.db_service import save_conversation, save_lead
    from services.ai_service import extract_lead_info

    ai_reply = generate_ai_reply(
        business_id=chat_request.business_id,
        message=chat_request.message,
    )

    # Try to extract name and phone from message
    lead_info = extract_lead_info(chat_request.message)
    customer_name = lead_info.get("name") or "Web Visitor"
    customer_phone = lead_info.get("phone") or ""

    # Save conversation
    save_conversation(
        business_id=chat_request.business_id,
        customer_id="web-widget",
        message=chat_request.message,
        reply=ai_reply,
    )

    # Save lead with extracted info
    save_lead(
        business_id=chat_request.business_id,
        customer_name=customer_name,
        phone=customer_phone,
        query=chat_request.message,
        source="web",
    )

    return {
        "business_id": chat_request.business_id,
        "reply": ai_reply,
    }


@app.get("/leads")
def leads() -> Dict[str, Any]:
	leads_data = get_all_leads()
	return {"leads": leads_data}


@app.get("/conversations")
def get_conversations() -> Dict[str, Any]:
	try:
		supabase = get_supabase_client()
		response = supabase.table("conversations").select("*").order("created_at", desc=True).execute()
		conversations_data = response.data or []
		return {"conversations": conversations_data}
	except Exception as exc:
		print(f"get_conversations error: {exc}")
		raise HTTPException(status_code=500, detail=str(exc))


@app.get("/business/{business_id}")
def get_business(business_id: str) -> Dict[str, Any]:
	try:
		supabase = get_supabase_client()
		response = supabase.table("businesses").select("*").eq("id", business_id).execute()
		businesses = response.data or []
		if not businesses:
			raise HTTPException(status_code=404, detail="Business not found")
		return {"business": businesses[0]}
	except HTTPException:
		raise
	except Exception as exc:
		print(f"get_business error: {exc}")
		raise HTTPException(status_code=500, detail=str(exc))


@app.put("/business/{business_id}")
def update_business(business_id: str, business_update: BusinessUpdate) -> Dict[str, Any]:
	try:
		supabase = get_supabase_client()
		
		# Build update payload with only non-None fields
		update_payload = {k: v for k, v in business_update.model_dump().items() if v is not None}
		
		if not update_payload:
			raise HTTPException(status_code=400, detail="No fields to update")
		
		# Update the business record
		response = supabase.table("businesses").update(update_payload).eq("id", business_id).execute()
		updated_businesses = response.data or []
		
		if not updated_businesses:
			raise HTTPException(status_code=404, detail="Business not found")
		
		return {"business": updated_businesses[0]}
	except HTTPException:
		raise
	except Exception as exc:
		print(f"update_business error: {exc}")
		raise HTTPException(status_code=500, detail=str(exc))


# Accessing env vars here confirms they are loaded and available to the app.
APP_ENV = os.getenv("APP_ENV", "development")
