import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Blocks to capture and rearrange:
# 1. sales-target-strip (Starts with <div class="sales-target-strip"> and ends where gst-summary-professional-card starts)
# 2. gst-summary-professional-card
# 3. target-progress-panel
# 4. dashboard-metrics (ends right after followups card, where we need to insert </div>)
# 5. appointment-status-board
# 6. funnel-panel-dashboard

# This is getting too complex for simple regex. Let's use BeautifulSoup to parse and reorder!
