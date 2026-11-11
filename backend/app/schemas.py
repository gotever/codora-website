from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterInput(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=160)
    level: Literal["beginner", "intermediate", "advanced"] = "beginner"


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProgressInput(BaseModel):
    item_type: Literal["lesson", "exercise"]
    item_id: int = Field(gt=0)
    status: Literal["not_started", "in_progress", "completed"]
    score: float | None = Field(default=None, ge=0, le=10)


class UserAbilitySchema(BaseModel):
    level: Literal["beginner", "intermediate", "advanced"]
    mastered_topics: list[str] = Field(default_factory=list)
    recent_quiz_avg: float = Field(ge=0.0, le=10.0)
    consecutive_errors: int = Field(default=0, ge=0)


class PersonalizeLessonInput(BaseModel):
    consecutive_errors: int = Field(default=0, ge=0, le=1000)


class UserLevelInput(BaseModel):
    level: Literal["beginner", "intermediate", "advanced"]


class SubmitInput(BaseModel):
    code: str = Field(min_length=1, max_length=100_000)


class ChatInput(BaseModel):
    exercise_id: int | None = Field(default=None, gt=0)
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
