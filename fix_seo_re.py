import re

with open('seo.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"openSeoWork\('\$\{proj\.id\}'", r"openSeoWork(''", content)
content = re.sub(r"openProjectSheetAccess\('\$\{proj\.id\}'", r"openProjectSheetAccess(''", content)
content = re.sub(r"reactivateSeo\('\$\{proj\.id\}'\)", r"reactivateSeo('')", content)
content = re.sub(r"submitGmbReportDirectly\('\$\{proj\.id\}'\)", r"submitGmbReportDirectly('')", content)
content = re.sub(r"extendGmbPostScheduleFromCard\('\$\{proj\.id\}'", r"extendGmbPostScheduleFromCard(''", content)

with open('seo.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Regex replace done!")
