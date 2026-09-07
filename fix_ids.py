import sys

with open('seo.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("openSeoWork('',", "openSeoWork('',")
content = content.replace("openProjectSheetAccess('',", "openProjectSheetAccess('',")
content = content.replace("reactivateSeo('')", "reactivateSeo('')")
content = content.replace("submitGmbReportDirectly('')", "submitGmbReportDirectly('')")
content = content.replace("extendGmbPostScheduleFromCard('',", "extendGmbPostScheduleFromCard('',")

with open('seo.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced simple strings!")
