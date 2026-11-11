from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterInput(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=160)


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProgressInput(BaseModel):
    item_type: Literal["lesson", "exercise"]
    item_id: str = Field(min_length=1, max_length=160)
    status: Literal["not_started", "in_progress", "completed"]


class ChatInput(BaseModel):
    exercise_id: str | None = Field(default=None, max_length=160)
    role: Literal["user", "assistant"]
    message: str = Field(min_length=1, max_length=20_000)
    code_snapshot: str | None = Field(default=None, max_length=100_000)


class PublicUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    username: str
    full_name: str
    created_at: str
