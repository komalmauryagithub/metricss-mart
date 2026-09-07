import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# First, fix dashboard-metrics missing closing div
if '<div class="appointment-status-board">' in content and '</div>\n\n            <div class="appointment-status-board">' not in content:
    content = content.replace('<div class="appointment-status-board">', '</div>\n\n            <div class="appointment-status-board">')

def get_block(start_str, next_str):
    start_idx = content.find(start_str)
    end_idx = content.find(next_str, start_idx) if next_str else len(content)
    if start_idx == -1 or end_idx == -1:
        return ""
    return content[start_idx:end_idx]

# Let's see the current exact start strings
b_strip = '<div class="sales-target-strip">'
b_gst = '<div class="gst-summary-professional-card"'
b_target = '<div\n            class="target-progress-panel"'
b_metrics = '<div class="dashboard-metrics">'
b_appt = '<div class="appointment-status-board">'
b_funnel = '<div class="dashboard-panel funnel-panel-dashboard">'
b_deals = '<div id="deals" class="section">'

block_strip = get_block(b_strip, b_gst)
block_gst = get_block(b_gst, b_target)
block_target = get_block(b_target, b_metrics)
block_metrics = get_block(b_metrics, b_appt)
block_appt = get_block(b_appt, b_funnel)
block_funnel = get_block(b_funnel, b_deals)

# Verify we got everything
dashboard_start = content.find('<div id="dashboard" class="section active">')
if dashboard_start != -1:
    header = content[dashboard_start:content.find(b_strip)]
else:
    header = ""

# Assemble in the requested order:
# 1. dashboard-metrics
# 2. appointment-status-board
# 3. funnel-panel-dashboard
# 4. gst-summary-professional-card
# 5. target-progress-panel

# Wait, what about sales-target-strip? The user didn't mention it. 
# "appointmnet satus ko niche rkho and funnel ko uske niche then monthly target erfirmance ko uske niche then last me deals table"
# I should keep sales-target-strip at the top.

# Assemble:
new_dashboard = header + block_strip + block_metrics + block_appt + block_funnel + block_gst + block_target

# Replace in content
full_old = header + block_strip + block_gst + block_target + block_metrics + block_appt + block_funnel
if full_old.strip() != "" and full_old in content:
    content = content.replace(full_old, new_dashboard)
    with open('tme.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Reordered successfully!")
else:
    print("Failed to replace. Lengths:", len(full_old), len(content))

