import os

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the old metric card GST summary
old_metric_card = '''            <div
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
            </div>'''
content = content.replace(old_metric_card, '')

# 2. Add the new professional panel
new_panel = '''          <div class="gst-summary-professional-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
            <div style="display: flex; align-items: center; gap: 18px;">
              <div style="background: rgba(16, 185, 129, 0.1); color: #10b981; width: 64px; height: 64px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 28px;">
                <i class="fas fa-file-invoice-dollar"></i>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; letter-spacing: -0.5px;">GST Summary</h3>
                <p style="margin: 4px 0 0; font-size: 14px; color: #64748b;">Overview of total sales and tax amounts</p>
              </div>
            </div>
            <div style="display: flex; gap: 40px; text-align: right; align-items: center;">
              <div>
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Total Sale</span>
                <div id="tmeTargetTotalSaleSummary" style="font-size: 22px; font-weight: 800; color: #1e293b; margin-top: 4px;">Rs. 0</div>
              </div>
              <div style="width: 1px; height: 40px; background: #e2e8f0;"></div>
              <div>
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Without GST</span>
                <div id="tmeTargetWithoutGstSummary" style="font-size: 22px; font-weight: 800; color: #3b82f6; margin-top: 4px;">Rs. 0</div>
              </div>
              <div style="width: 1px; height: 40px; background: #e2e8f0;"></div>
              <div>
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">GST Amount</span>
                <div id="tmeTargetGstAmount" style="font-size: 22px; font-weight: 800; color: #10b981; margin-top: 4px;">Rs. 0</div>
              </div>
            </div>
          </div>
          
          <div
            class="target-progress-panel"'''
content = content.replace('<div\n            class="target-progress-panel"', new_panel)

# 3. Remove attendance metric card
import re
attendance_pattern = re.compile(r'<\s*div[^>]*class="metric-card attendance"[^>]*>.*?<\s*/div\s*>\s*<\s*/div\s*>\s*<\s*/div\s*>', re.DOTALL)
content = attendance_pattern.sub('', content)

with open('tme.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated tme.html with professional panel and removed attendance")
