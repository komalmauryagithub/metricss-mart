import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

def get_block(start_str, next_str):
    start_idx = content.find(start_str)
    end_idx = content.find(next_str, start_idx) if next_str else len(content)
    if start_idx == -1 or end_idx == -1:
        return ""
    return content[start_idx:end_idx]

b_strip = '<div class="sales-target-strip">'
b_metrics = '<div class="dashboard-metrics">'
b_appt = '<div class="appointment-status-board">'
b_funnel = '<div class="dashboard-panel funnel-panel-dashboard">'
b_gst = '<div class="gst-summary-professional-card"'
b_target = '<div\n            class="target-progress-panel"'
b_deals = '<div id="deals" class="section">'

block_strip = get_block(b_strip, b_metrics)
block_gst = get_block(b_gst, b_target)

# We want to remove block_gst from its current position
if block_gst:
    content = content.replace(block_gst, "")

new_gst_banner = '''          <div class="gst-summary-banner" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); color: white; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 18px;">
              <div style="background: rgba(52, 211, 153, 0.15); width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; backdrop-filter: blur(8px); border: 1px solid rgba(52,211,153,0.2);">
                <i class="fas fa-chart-pie" style="color: #34d399;"></i>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; color: #f8fafc;">Sales & GST Breakdown</h3>
                <p style="margin: 3px 0 0; font-size: 12px; color: #94a3b8;">Real-time metrics overview</p>
              </div>
            </div>
            <div style="display: flex; gap: 32px; text-align: right; align-items: center;">
              <div>
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 500;">Total Sale</span>
                <div id="tmeTargetTotalSaleSummary" style="font-size: 20px; font-weight: 700; margin-top: 3px; color: #f8fafc; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Rs. 0</div>
              </div>
              <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.1);"></div>
              <div>
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 500;">Without GST</span>
                <div id="tmeTargetWithoutGstSummary" style="font-size: 20px; font-weight: 700; color: #60a5fa; margin-top: 3px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Rs. 0</div>
              </div>
              <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.1);"></div>
              <div>
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 500;">GST Amount</span>
                <div id="tmeTargetGstAmount" style="font-size: 20px; font-weight: 700; color: #34d399; margin-top: 3px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Rs. 0</div>
              </div>
            </div>
          </div>
          
'''

# Now inject new_gst_banner right after block_strip
if block_strip:
    content = content.replace(block_strip, block_strip + new_gst_banner)
    with open('tme.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected new banner and removed old one!")
else:
    print("Could not find block_strip")
