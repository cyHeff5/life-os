"""fitness tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'fitness_exercises',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(50), nullable=False, server_default="'strength'"),
        sa.Column('muscle_group', sa.String(100), nullable=True),
    )

    op.create_table(
        'training_plans',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
    )

    op.create_table(
        'training_days',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('plan_id', UUID(as_uuid=True),
                  sa.ForeignKey('training_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_index', sa.Integer, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), nullable=False, server_default="'#00a0a0'"),
    )
    op.create_index('ix_training_days_plan', 'training_days', ['plan_id'])

    op.create_table(
        'plan_exercises',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('day_id', UUID(as_uuid=True),
                  sa.ForeignKey('training_days.id', ondelete='CASCADE'), nullable=False),
        sa.Column('exercise_id', UUID(as_uuid=True),
                  sa.ForeignKey('fitness_exercises.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('sets', sa.Integer, nullable=False, server_default='3'),
        sa.Column('reps_min', sa.Integer, nullable=True),
        sa.Column('reps_max', sa.Integer, nullable=True),
        sa.Column('weight_kg', sa.Float, nullable=True),
    )
    op.create_index('ix_plan_exercises_day', 'plan_exercises', ['day_id'])

    op.create_table(
        'workout_sessions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('date', sa.DateTime, nullable=False),
        sa.Column('training_day_id', UUID(as_uuid=True),
                  sa.ForeignKey('training_days.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('completed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_workout_sessions_date', 'workout_sessions', ['date'])

    op.create_table(
        'workout_sets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', UUID(as_uuid=True),
                  sa.ForeignKey('workout_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('exercise_id', UUID(as_uuid=True),
                  sa.ForeignKey('fitness_exercises.id', ondelete='CASCADE'), nullable=False),
        sa.Column('set_number', sa.Integer, nullable=False),
        sa.Column('reps', sa.Integer, nullable=True),
        sa.Column('weight_kg', sa.Float, nullable=True),
        sa.Column('duration_sec', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_workout_sets_session', 'workout_sets', ['session_id'])


def downgrade():
    op.drop_table('workout_sets')
    op.drop_table('workout_sessions')
    op.drop_table('plan_exercises')
    op.drop_table('training_days')
    op.drop_table('training_plans')
    op.drop_table('fitness_exercises')
