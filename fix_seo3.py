import re

with open('seo.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"openSeoWork\('',\s*", r"openSeoWork('', ", content)
content = re.sub(r"openProjectSheetAccess\('',\s*", r"openProjectSheetAccess('', ", content)
content = re.sub(r"reactivateSeo\(''\)", r"reactivateSeo('')", content)
content = re.sub(r"submitGmbReportDirectly\(''\)", r"submitGmbReportDirectly('')", content)
content = re.sub(r"extendGmbPostScheduleFromCard\('',\s*", r"extendGmbPostScheduleFromCard('', ", content)

with open('seo.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Regex replace fixed!")
