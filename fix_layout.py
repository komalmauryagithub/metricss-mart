import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Fix the missing </div> for dashboard-metrics
# Insert it right before appointment-status-board
content = content.replace('<div class="appointment-status-board">', '</div>\n\n            <div class="appointment-status-board">')

# Step 2: Now we extract all the major blocks using regex
def extract_block(pattern_start, pattern_end):
    # This is risky with nested divs, but since they are at the top level of #dashboard, we can find them
    match = re.search(pattern_start + r'.*?' + pattern_end, content, re.DOTALL)
    if match:
        return match.group(0), match.span()
    return None, None

# Let's extract them by finding their start indices and assuming they go until the next block
blocks = {
    'sales-target-strip': content.find('<div class="sales-target-strip">'),
    'gst-summary-professional-card': content.find('<div class="gst-summary-professional-card"'),
    'target-progress-panel': content.find('<div\n            class="target-progress-panel"'),
    'dashboard-metrics': content.find('<div class="dashboard-metrics">'),
    'appointment-status-board': content.find('<div class="appointment-status-board">'),
    'funnel-panel-dashboard': content.find('<div class="dashboard-panel funnel-panel-dashboard">'),
    'deals': content.find('<div id="deals" class="section">')
}

# Print indices to see their order
for name, idx in sorted(blocks.items(), key=lambda x: x[1]):
    print(f"{name}: {idx}")

