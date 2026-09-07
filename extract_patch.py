import re

with open('restore.patch', 'r', encoding='utf-8') as f:
    lines = f.readlines()

diff_lines = []
in_diff = False
for line in lines:
    if line.startswith('diff --git'):
        in_diff = True
    if in_diff:
        diff_lines.append(line)

with open('clean_restore.patch', 'w', encoding='utf-8') as f:
    f.writelines(diff_lines)

print(f"Extracted {len(diff_lines)} lines of diff.")
