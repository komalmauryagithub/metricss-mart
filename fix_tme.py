import re

with open('tme.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to add tmeProgressAchievedText and tmeProgressRemainingText update in renderTargetProgressChart
target_prog = '''  const safeTarget = Number(target || 0);
  const safeAchieved = Number(achieved || 0);
  const remaining = Math.max(safeTarget - safeAchieved, 0);'''

target_prog_new = '''  const safeTarget = Number(target || 0);
  const safeAchieved = Number(achieved || 0);
  const remaining = Math.max(safeTarget - safeAchieved, 0);
  
  const achievedText = document.getElementById("tmeProgressAchievedText");
  const remainingText = document.getElementById("tmeProgressRemainingText");
  if (achievedText) achievedText.textContent = Rs. ;
  if (remainingText) remainingText.textContent = Rs. ;'''

content = content.replace(target_prog, target_prog_new)

# Add renderFreshVsRenewalChart if it doesn't exist
fresh_renewal_func = '''
let tmeFreshRenewalChartInstance = null;
function renderFreshVsRenewalChart(freshAmount, renewalAmount) {
  const canvas = document.getElementById("tmeFreshRenewalChart");
  if (!canvas?.getContext) return;
  
  const freshText = document.getElementById("tmeFreshAmountText");
  const renewalText = document.getElementById("tmeRenewalAmountText");
  if (freshText) freshText.textContent = Rs. ;
  if (renewalText) renewalText.textContent = Rs. ;

  const ctx = canvas.getContext("2d");
  if (tmeFreshRenewalChartInstance) {
    tmeFreshRenewalChartInstance.destroy();
  }

  tmeFreshRenewalChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Fresh", "Renewal"],
      datasets: [
        {
          data: [Number(freshAmount || 0), Number(renewalAmount || 0)],
          backgroundColor: ["#3b82f6", "#eab308"],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 12,
          titleFont: { size: 13, family: "'Segoe UI', sans-serif" },
          bodyFont: { size: 14, weight: "bold", family: "'Segoe UI', sans-serif" },
          callbacks: {
            label: (ctx) =>  Rs. ,
          },
        },
      },
    },
  });
}
'''

if 'function renderFreshVsRenewalChart' not in content:
    content += fresh_renewal_func

with open('tme.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated tme.js successfully")
