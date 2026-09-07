import os

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Restore the without-gst card in the strip
wrong_card = '''            <div class="sales-target-card gst-summary" style="min-width: 200px;">
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

original_card = '''            <div class="sales-target-card without-gst">
              <div class="sales-target-icon">
                <i class="fas fa-calculator"></i>
              </div>
              <div>
                <span>Without GST</span>
                <strong id="tmeTargetWithoutGst">Rs. 0</strong>
                <small id="tmeTargetWithoutGstHint">Paid amount excluding GST</small>
              </div>
            </div>'''

content = content.replace(wrong_card, original_card)

# 2. Add the GST Summary card to dashboard-metrics
new_metric_card = '''            <div
              class="metric-card"
              style="grid-column: span 1; display: flex; align-items: center; gap: 15px; padding: 15px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);"
            >
              <div class="metric-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 20px;">
                <i class="fas fa-file-invoice-dollar"></i>
              </div>
              <div style="flex: 1;">
                <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">GST Summary</span>
                <div style="margin-top: 6px; font-size: 14px; line-height: 1.5;">
                   <div style="display:flex; justify-content:space-between;"><span style="color:#475569;">Without GST:</span> <strong id="tmeTargetWithoutGstSummary" style="color:#1e293b;">Rs. 0</strong></div>
                   <div style="display:flex; justify-content:space-between;"><span style="color:#475569;">GST Amount:</span> <strong id="tmeTargetGstAmount" style="color:#10b981;">Rs. 0</strong></div>
                </div>
              </div>
            </div>
            
            <div'''

content = content.replace('<div class="dashboard-metrics">\n            \n            \n            \n            <div', '<div class="dashboard-metrics">\n            \n' + new_metric_card)

with open('tme.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated tme.html with separate metric card")
