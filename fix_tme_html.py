import os

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_card = '''            <div class="sales-target-card without-gst">
              <div class="sales-target-icon">
                <i class="fas fa-calculator"></i>
              </div>
              <div>
                <span>Without GST</span>
                <strong id="tmeTargetWithoutGst">Rs. 0</strong>
                <small id="tmeTargetWithoutGstHint">Paid amount excluding GST</small>
              </div>
            </div>'''

new_card = '''            <div class="sales-target-card gst-summary" style="min-width: 200px;">
              <div class="sales-target-icon">
                <i class="fas fa-file-invoice"></i>
              </div>
              <div style="flex: 1;">
                <span>GST Summary</span>
                <div style="font-size: 13px; line-height: 1.4; margin-top: 4px;">
                   <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Without GST:</span> <strong id="tmeTargetWithoutGst" style="color:#334155;">Rs. 0</strong></div>
                   <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">GST Amount:</span> <strong id="tmeTargetGstAmount" style="color:#10b981;">Rs. 0</strong></div>
                </div>
              </div>
            </div>'''

content = content.replace(old_card, new_card)

with open('tme.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated tme.html")
