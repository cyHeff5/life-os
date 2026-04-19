"""fitness v2 — workouts + exercises, drop old tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    # Drop old fitness tables (order matters for FK constraints)
    op.drop_table('workout_sets')
    op.drop_table('workout_sessions')
    op.drop_table('plan_exercises')
    op.drop_table('training_days')
    op.drop_table('training_plans')
    op.drop_table('fitness_exercises')

    # New: workout library
    op.create_table(
        'workouts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(20), nullable=False, server_default="'strength'"),
        sa.Column('color', sa.String(7), nullable=False, server_default="'#00a0a0'"),
        sa.Column('duration_min', sa.Integer, nullable=False, server_default='60'),
        sa.Column('preferred_day', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
    )

    # New: exercises within a workout
    op.create_table(
        'workout_exercises',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('workout_id', UUID(as_uuid=True),
                  sa.ForeignKey('workouts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('sets', sa.Integer, nullable=True),
        sa.Column('reps', sa.String(50), nullable=True),
        sa.Column('weight_kg', sa.Float, nullable=True),
        sa.Column('duration_min', sa.Float, nullable=True),
        sa.Column('distance_km', sa.Float, nullable=True),
        sa.Column('notes', sa.String(255), nullable=True),
    )
    op.create_index('ix_workout_exercises_workout', 'workout_exercises', ['workout_id'])


def downgrade():
    op.drop_table('workout_exercises')
    op.drop_table('workouts')
