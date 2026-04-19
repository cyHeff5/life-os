"""add user_context table

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_context',
        sa.Column('key',        sa.String(50),  primary_key=True),
        sa.Column('value',      sa.Text(),       nullable=False, server_default=''),
        sa.Column('updated_at', sa.DateTime(),   nullable=True),
    )


def downgrade():
    op.drop_table('user_context')
