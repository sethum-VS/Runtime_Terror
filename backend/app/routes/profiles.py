from fastapi import APIRouter, Depends

from app.dependencies import get_supabase, get_required_user
from app.models.schemas import UserProfileResponse, UserProfileUpdate

router = APIRouter()


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(user: dict = Depends(get_required_user)):
    """Return the authenticated user's profile, creating a default if needed."""
    supabase = get_supabase()
    user_id = user["user_id"]

    result = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()

    if not result.data:
        supabase.table("user_profiles").insert({"user_id": user_id}).execute()
        result = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()

    profile = result.data[0]
    return UserProfileResponse(
        user_id=profile["user_id"],
        full_name=profile.get("full_name"),
        bio=profile.get("bio"),
        avatar_url=profile.get("avatar_url"),
        preferred_narrator_voice=profile.get("preferred_narrator_voice"),
        preferred_reading_theme=profile.get("preferred_reading_theme"),
        role=profile.get("role", "user"),
    )


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    data: UserProfileUpdate,
    user: dict = Depends(get_required_user),
):
    """Update the authenticated user's profile."""
    supabase = get_supabase()
    user_id = user["user_id"]

    update_fields = data.model_dump(exclude_none=True)
    if not update_fields:
        result = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
        if not result.data:
            supabase.table("user_profiles").insert({"user_id": user_id}).execute()
            result = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
    else:
        update_fields["updated_at"] = "now()"
        supabase.table("user_profiles").upsert(
            {"user_id": user_id, **update_fields},
            on_conflict="user_id",
        ).execute()
        result = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()

    profile = result.data[0]
    return UserProfileResponse(
        user_id=profile["user_id"],
        full_name=profile.get("full_name"),
        bio=profile.get("bio"),
        avatar_url=profile.get("avatar_url"),
        preferred_narrator_voice=profile.get("preferred_narrator_voice"),
        preferred_reading_theme=profile.get("preferred_reading_theme"),
        role=profile.get("role", "user"),
    )
