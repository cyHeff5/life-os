"""stocks watchlist and analysis cache

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-19
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stock_watchlist',
        sa.Column('symbol',   sa.String(10),  primary_key=True),
        sa.Column('name',     sa.String(255), nullable=True),
        sa.Column('added_at', sa.DateTime,    nullable=True),
    )
    op.create_table(
        'stock_analysis_cache',
        sa.Column('symbol',         sa.String(10),  primary_key=True),
        sa.Column('regime',         sa.String(50),  nullable=True),
        sa.Column('risk_tag',       sa.String(20),  nullable=True),
        sa.Column('news_signal',    sa.String(20),  nullable=True),
        sa.Column('recommendation', sa.String(20),  nullable=True),
        sa.Column('price',          sa.Float,       nullable=True),
        sa.Column('news_json',      sa.Text,        nullable=True),
        sa.Column('updated_at',     sa.DateTime,    nullable=True),
    )


def downgrade():
    op.drop_table('stock_analysis_cache')
    op.drop_table('stock_watchlist')
