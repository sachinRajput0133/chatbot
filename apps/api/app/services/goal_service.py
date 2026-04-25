import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.goal import GoalConfig, GoalCompletion, GoalType

async def evaluate_goals(
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    message: str,
    page_url: str | None,
    db: AsyncSession
):
    # Fetch all goals for this tenant
    result = await db.execute(select(GoalConfig).where(GoalConfig.tenant_id == tenant_id))
    goals = result.scalars().all()
    
    if not goals:
        return

    # Fetch already completed goals for this conversation
    completed_result = await db.execute(
        select(GoalCompletion.goal_id).where(GoalCompletion.conversation_id == conversation_id)
    )
    completed_goal_ids = {row for row in completed_result.scalars().all()}
    
    new_completions = []
    
    for goal in goals:
        if goal.id in completed_goal_ids:
            continue
            
        is_completed = False
        target = goal.target_value.lower()
        
        if goal.goal_type == GoalType.keyword:
            if target in message.lower():
                is_completed = True
        elif goal.goal_type == GoalType.url_match:
            if page_url and target in page_url.lower():
                is_completed = True
                
        if is_completed:
            completion = GoalCompletion(
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                goal_id=goal.id
            )
            db.add(completion)
            new_completions.append(completion)
            
    if new_completions:
        await db.commit()
