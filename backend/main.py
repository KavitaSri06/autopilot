# AI Business Autopilot - Main Application
import os
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.ai_service import generate_ai_reply
from services.db_service import get_all_leads
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


@app.get("/health")
def health() -> Dict[str, str]:
	return {
		"status": "ok",
		"message": "AI Business Autopilot is running",
	}


@app.post("/chat")
def chat(chat_request: ChatRequest) -> Dict[str, str]:
	ai_reply = generate_ai_reply(
		business_id=chat_request.business_id,
		message=chat_request.message,
	)
	return {
		"business_id": chat_request.business_id,
		"reply": ai_reply,
	}


@app.get("/leads")
def leads() -> Dict[str, Any]:
	leads_data = get_all_leads()
	return {"leads": leads_data}


# Accessing env vars here confirms they are loaded and available to the app.
APP_ENV = os.getenv("APP_ENV", "development")
