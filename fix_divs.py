import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# The incorrect closing tags
old_str = '''                  <div id="tmeTargetGstAmount" style="font-size: 18px; font-weight: 800; color: #16a34a; margin-top: 2px;">Rs. 0</div>
                </div>
              </div>
            </div>
          </div>
          
<div class="dashboard-metrics">'''

# Remove one </div>
new_str = '''                  <div id="tmeTargetGstAmount" style="font-size: 18px; font-weight: 800; color: #16a34a; margin-top: 2px;">Rs. 0</div>
                </div>
              </div>
            </div>
          
<div class="dashboard-metrics">'''

content = content.replace(old_str, new_str)

with open('tme.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed extra closing div!")
