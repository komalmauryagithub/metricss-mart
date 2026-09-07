import os

with open('tme.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = '''    setDashboardText(${prefix}TargetWithoutGstSummary, formatDashboardMoney(paidWithoutGst));
    setDashboardText(${prefix}TargetGstAmount, formatDashboardMoney(gstAmount));'''

new_logic = '''    setDashboardText(${prefix}TargetTotalSaleSummary, formatDashboardMoney(achieved));
    setDashboardText(${prefix}TargetWithoutGstSummary, formatDashboardMoney(paidWithoutGst));
    setDashboardText(${prefix}TargetGstAmount, formatDashboardMoney(gstAmount));'''

content = content.replace(old_logic, new_logic)

with open('tme.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated tme.js with total sale summary")
