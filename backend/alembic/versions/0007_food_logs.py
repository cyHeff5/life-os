"""food logs

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'food_logs',
        sa.Column('id',         UUID(as_uuid=True), primary_key=True),
        sa.Column('date',       sa.Date(),          nullable=False),
        sa.Column('name',       sa.String(255),     nullable=False),
        sa.Column('brand',      sa.String(255),     nullable=True),
        sa.Column('grams',      sa.Float(),         nullable=False),
        sa.Column('kcal',       sa.Float(),         nullable=False),
        sa.Column('protein',    sa.Float(),         nullable=True),
        sa.Column('fat',        sa.Float(),         nullable=True),
        sa.Column('carbs',      sa.Float(),         nullable=True),
        sa.Column('created_at', sa.DateTime(),      nullable=True),
    )
    op.create_index('ix_food_logs_date', 'food_logs', ['date'])


def downgrade():
    op.drop_index('ix_food_logs_date', 'food_logs')
    op.drop_table('food_logs')
