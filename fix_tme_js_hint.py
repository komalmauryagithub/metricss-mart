import os

with open('tme.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = '''    const gstAmount = Math.max(0, achieved - paidWithoutGst);
    setDashboardText(${prefix}TargetWithoutGst, formatDashboardMoney(paidWithoutGst));
    setDashboardText(${prefix}TargetGstAmount, formatDashboardMoney(gstAmount));'''

new_logic = '''    const gstAmount = Math.max(0, achieved - paidWithoutGst);
    setDashboardText(${prefix}TargetWithoutGst, formatDashboardMoney(paidWithoutGst));
    setDashboardText(${prefix}TargetWithoutGstHint, "Paid amount excluding GST");
    setDashboardText(${prefix}TargetWithoutGstSummary, formatDashboardMoney(paidWithoutGst));
    setDashboardText(${prefix}TargetGstAmount, formatDashboardMoney(gstAmount));'''

content = content.replace(old_logic, new_logic)

with open('tme.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated tme.js with restored hint and summary value")
