"""calendar and work packages

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "work_packages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("estimated_hours", sa.Float, server_default="1.0"),
        sa.Column("is_scheduled", sa.Boolean, server_default="false"),
        sa.Column("color", sa.String(7), server_default="'#00a0a0'"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    op.create_table(
        "calendar_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("start_time", sa.DateTime, nullable=False),
        sa.Column("end_time", sa.DateTime, nullable=False),
        sa.Column("color", sa.String(7), server_default="'#00a0a0'"),
        sa.Column("work_package_id", UUID(as_uuid=True), sa.ForeignKey("work_packages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_calendar_events_start", "calendar_events", ["start_time"])

    # Placeholder work packages
    op.execute("""
        INSERT INTO work_packages (title, estimated_hours, color) VALUES
        ('Backend API aufsetzen', 2.0, '#00a0a0'),
        ('UI Komponenten bauen', 1.5, '#00a0a0'),
        ('Datenbank Schema entwerfen', 1.0, '#00a0a0'),
        ('Tests schreiben', 0.5, '#00a0a0'),
        ('Dokumentation aktualisieren', 0.5, '#00a0a0')
    """)


def downgrade() -> None:
    op.drop_index("ix_calendar_events_start")
    op.drop_table("calendar_events")
    op.drop_table("work_packages")
