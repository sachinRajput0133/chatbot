from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
import uuid
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.tenant import Tenant
from app.models.user import User
from app.models.goal import GoalConfig, GoalCompletion, GoalType
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/goals", tags=["goals"])

class GoalCreate(BaseModel):
    name: str
    description: str | None = None
    goal_type: GoalType
    target_value: str

class GoalResponse(GoalCreate):
    id: uuid.UUID
    created_at: datetime
    completion_count: int = 0

async def get_tenant(user: User, db: AsyncSession) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.owner_id == user.id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.get("", response_model=List[GoalResponse])
async def list_goals(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    tenant = await get_tenant(user, db)
    
    # Fetch goals and their completion counts
    query = select(GoalConfig).where(GoalConfig.tenant_id == tenant.id).order_by(GoalConfig.created_at.desc())
    result = await db.execute(query)
    goals = result.scalars().all()
    
    response = []
    for goal in goals:
        count_query = select(func.count(GoalCompletion.id)).where(GoalCompletion.goal_id == goal.id)
        count_result = await db.execute(count_query)
        count = count_result.scalar() or 0
        
        response.append(GoalResponse(
            id=goal.id,
            name=goal.name,
            description=goal.description,
            goal_type=goal.goal_type,
            target_value=goal.target_value,
            created_at=goal.created_at,
            completion_count=count
        ))
        
    return response

@router.post("", response_model=GoalResponse)
async def create_goal(
    goal_in: GoalCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    tenant = await get_tenant(user, db)
    
    goal = GoalConfig(
        tenant_id=tenant.id,
        name=goal_in.name,
        description=goal_in.description,
        goal_type=goal_in.goal_type,
        target_value=goal_in.target_value
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    
    return GoalResponse(
        id=goal.id,
        name=goal.name,
        description=goal.description,
        goal_type=goal.goal_type,
        target_value=goal.target_value,
        created_at=goal.created_at,
        completion_count=0
    )

@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    tenant = await get_tenant(user, db)
    
    result = await db.execute(
        select(GoalConfig).where(GoalConfig.id == goal_id, GoalConfig.tenant_id == tenant.id)
    )
    goal = result.scalar_one_or_none()
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
        
    await db.delete(goal)
    await db.commit()
    return {"status": "deleted"}
