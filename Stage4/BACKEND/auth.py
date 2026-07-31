from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not configured")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})

    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_token(token: str) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    user_id = payload.get("user_id")
    email = payload.get("email")
    user_type = payload.get("user_type")

    if user_id is None or email is None or user_type is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token."
        )

    return {
        "user_id": user_id,
        "email": email,
        "user_type": user_type
    }


def get_current_user(token: str = Depends(oauth2_scheme)):
    """The single authentication dependency for the whole API.

    Returns the token payload as {user_id, email, user_type}. Raises 401 if the
    Authorization header is missing or malformed (handled by oauth2_scheme), or
    if the token is forged, expired, or missing required claims.
    """
    try:
        return verify_token(token)
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token."
        )


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Authentication plus an admin role check, for the /api/admin routes.

    Builds on get_current_user so there is only one place that verifies a token:
    401 for a missing or invalid token, 403 for a valid token that is not an admin.
    """
    if current_user["user_type"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user

