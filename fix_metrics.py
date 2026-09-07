import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the specific metric cards
to_remove = [
    r'<div\s+class="metric-card sales"[\s\S]*?<small id="dashboardSalesHint">[^<]*</small>\s*</div>\s*</div>',
    r'<div\s+class="metric-card contract-value"[\s\S]*?<small>Total deal value</small>\s*</div>\s*</div>',
    r'<div\s+class="metric-card paid-without-gst"[\s\S]*?<small>Excluding GST</small>\s*</div>\s*</div>',
    r'<div\s+class="metric-card attendance"[\s\S]*?<small id="dashboardAttendanceHint">[^<]*</small>\s*</div>\s*</div>'
]

for pattern in to_remove:
    content = re.sub(pattern, '', content)

with open('tme.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed duplicate metric cards")
