import re
from pathlib import Path
text = Path('sql/schema.sql').read_text()
req = [
    'announcements','archive_settings','attendance_records','authentications',
    'chat_message_reads','chat_messages','chat_participants','chats',
    'cost_approval_history','cost_predictions','dashboard_settings','dashboards',
    'data_visibility_settings','device_logs','document_index','down_payment_requests',
    'edge_rate_limits','employees','equipment','federal_permits','feedback',
    'field_team_settings','historical_site_costs','hubs','incident_reports',
    'inventory_items','local_permits','location_logs','mmp_files','mmp_site_entries',
    'notifications','organizations','payment_methods','payments','payout_requests',
    'permissions','profiles','project_activities','project_memberships','project_scopes',
    'projects','purchase_orders','refresh_tokens','report_photos','reports','roles',
    'safety_checklists','settings','site_visit_cost_submissions','site_visit_costs',
    'site_visit_photos','site_visits','sites_registry','state_permits','sub_activities',
    'supply_requests','support_tickets','ticket_messages','user_roles','user_settings',
    'visit_status','wallet_settings','wallet_transactions','wallets','withdrawal_requests'
]
existing = []
missing = []
for name in req:
    if re.search(r'create table if not exists\s+([\w\.]*\.)?' + re.escape(name) + r'\b', text, re.IGNORECASE):
        existing.append(name)
    else:
        missing.append(name)
print('MISSING IN CURRENT SCHEMA:')
for n in missing:
    print(n)
