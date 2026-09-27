"""Owner authentication for the dashboard-facing endpoints.

Deliberately NOT applied to /chat. The widget runs anonymously in a visitor's
browser on a third-party site, so any secret shipped there is public by
construction. /chat is authorized by business_id in the request body and bounded
by quota; these endpoints are authorized by a bearer token. Opposite
requirements, so they do not share one policy.
"""
import hashlib
import hmac
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException


load_dotenv()

# Only the digest is stored, so the server never holds the token itself. An env
# var rather than a table: there is one tenant, and putting it in the database
# would mean an unversioned ALTER TABLE for no gain. Revocation is an env edit.
OWNER_TOKEN_SHA256 = (os.getenv("OWNER_TOKEN_SHA256") or "").strip().lower()
DEFAULT_BUSINESS_ID = os.getenv("DEFAULT_BUSINESS_ID", "")

if not OWNER_TOKEN_SHA256:
	print(
		"WARNING: OWNER_TOKEN_SHA256 is unset — every owner endpoint will reject "
		"all requests. Generate a token and set its SHA-256 digest."
	)


def business_id_for_token(token: str) -> Optional[str]:
	"""Map a bearer token to the business it owns, or None if it does not match.

	The single place to change when tokens move into a per-tenant table.
	"""
	if not OWNER_TOKEN_SHA256 or not token:
		return None

	digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
	if hmac.compare_digest(digest, OWNER_TOKEN_SHA256):
		return DEFAULT_BUSINESS_ID or None
	return None


def require_owner(authorization: Optional[str] = Header(default=None)) -> str:
	"""FastAPI dependency: returns the authenticated business_id, or raises 401.

	The returned id is what handlers must scope their queries to. Never take the
	business id from the path or body on these endpoints — that was the original
	defect, where any caller could read any tenant's data.
	"""
	if not authorization or not authorization.lower().startswith("bearer "):
		raise HTTPException(
			status_code=401,
			detail="Missing bearer token",
			headers={"WWW-Authenticate": "Bearer"},
		)

	token = authorization.split(" ", 1)[1].strip()
	business_id = business_id_for_token(token)
	if not business_id:
		raise HTTPException(
			status_code=401,
			detail="Invalid token",
			headers={"WWW-Authenticate": "Bearer"},
		)
	return business_id
