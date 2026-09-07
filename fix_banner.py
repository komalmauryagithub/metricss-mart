import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old block regex to capture the whole gst-summary-banner
old_banner_pattern = r'<div class="gst-summary-banner"[^>]*>.*?</div>\s*</div>\s*</div>'

new_banner = '''<div class="gst-summary-ribbon" style="background: #ffffff; border-radius: 12px; padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03); border: 1px solid #e2e8f0;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div style="background: #f0fdf4; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid #bbf7d0;">
                  <i class="fas fa-chart-pie" style="color: #16a34a;"></i>
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: -0.01em;">Sales & GST Breakdown</h3>
                  <p style="margin: 2px 0 0; font-size: 13px; color: #64748b; font-weight: 500;">Real-time revenue metrics</p>
                </div>
              </div>
              <div style="display: flex; gap: 32px; align-items: center;">
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Total Sale</span>
                  <div id="tmeTargetTotalSaleSummary" style="font-size: 18px; font-weight: 800; margin-top: 2px; color: #0f172a;">Rs. 0</div>
                </div>
                <div style="width: 1px; height: 32px; background: #e2e8f0;"></div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Without GST</span>
                  <div id="tmeTargetWithoutGstSummary" style="font-size: 18px; font-weight: 800; color: #2563eb; margin-top: 2px;">Rs. 0</div>
                </div>
                <div style="width: 1px; height: 32px; background: #e2e8f0;"></div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">GST Amount</span>
                  <div id="tmeTargetGstAmount" style="font-size: 18px; font-weight: 800; color: #16a34a; margin-top: 2px;">Rs. 0</div>
                </div>
              </div>
            </div>'''

# Replace using dotall
content = re.sub(old_banner_pattern, new_banner, content, flags=re.DOTALL)

with open('tme.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated banner!")
