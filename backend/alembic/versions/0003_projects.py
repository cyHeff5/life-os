"""projects, work areas, real work packages

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Sever FK from calendar_events → old work_packages
    op.execute(
        "ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS "
        "calendar_events_work_package_id_fkey"
    )
    op.execute("UPDATE calendar_events SET work_package_id = NULL")

    # 2. Drop placeholder work_packages
    op.drop_table('work_packages')

    # 3. Projects
    op.create_table(
        'projects',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('color', sa.String(7), nullable=False, server_default="'#00a0a0'"),
        sa.Column('status', sa.String(20), nullable=False, server_default="'active'"),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
    )

    # 4. Work areas (Kanban columns)
    op.create_table(
        'work_areas',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', UUID(as_uuid=True),
                  sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_work_areas_project_id', 'work_areas', ['project_id'])

    # 5. New work_packages (Kanban cards)
    op.create_table(
        'work_packages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', UUID(as_uuid=True),
                  sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('work_area_id', UUID(as_uuid=True),
                  sa.ForeignKey('work_areas.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default="'todo'"),
        sa.Column('priority', sa.String(10), nullable=False, server_default="'medium'"),
        sa.Column('estimated_hours', sa.Float, nullable=True),
        sa.Column('is_scheduled', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('color', sa.String(7), nullable=False, server_default="'#00a0a0'"),
        sa.Column('created_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False,
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_wp_project_id', 'work_packages', ['project_id'])
    op.create_index('ix_wp_work_area_id', 'work_packages', ['work_area_id'])
    op.create_index('ix_wp_status', 'work_packages', ['status'])

    # 6. Restore FK from calendar_events
    op.execute(
        "ALTER TABLE calendar_events ADD CONSTRAINT "
        "calendar_events_work_package_id_fkey "
        "FOREIGN KEY (work_package_id) REFERENCES work_packages(id) ON DELETE SET NULL"
    )


def downgrade():
    op.execute(
        "ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS "
        "calendar_events_work_package_id_fkey"
    )
    op.drop_table('work_packages')
    op.drop_table('work_areas')
    op.drop_table('projects')
