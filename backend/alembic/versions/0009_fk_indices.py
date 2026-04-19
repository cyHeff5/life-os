"""Add indices for FK columns

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-19
"""
from alembic import op

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_calendar_events_work_package_id ON calendar_events (work_package_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_work_areas_project_id ON work_areas (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_work_packages_work_area_id ON work_packages (work_area_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_work_packages_project_id ON work_packages (project_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_work_packages_project_id")
    op.execute("DROP INDEX IF EXISTS ix_work_packages_work_area_id")
    op.execute("DROP INDEX IF EXISTS ix_work_areas_project_id")
    op.execute("DROP INDEX IF EXISTS ix_calendar_events_work_package_id")
