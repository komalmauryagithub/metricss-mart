import os

css_append = """
/* Responsive adjustments for mobile */
@media (max-width: 1024px) {
  .dashboard-metrics-4, .seo-basic-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 768px) {
  .dashboard-metrics-4, .seo-basic-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
  .seo-project-card, .ads-project-card, .phase-tracker-dialog {
    width: 100% !important;
    display: block !important;
  }
  .phase-tracker-overview {
    grid-template-columns: 1fr !important;
  }
  table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  button, input, select, textarea {
    width: 100% !important;
  }
  .seo-project-card, .ads-project-card, .dashboard-metrics-4 {
    padding: 10px !important;
    margin: 10px 0 !important;
  }
}

@media (max-width: 640px) {
  .dashboard-metrics-4, .seo-basic-summary {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 480px) {
  .dashboard-metrics-4, .seo-project-card, .ads-project-card, .seo-basic-summary {
    grid-template-columns: 1fr !important;
    padding: 8px !important;
  }
}

@media (max-width: 380px) {
  .dashboard-metrics-4, .seo-project-card, .ads-project-card {
    padding: 5px !important;
  }
}
"""

with open(r"c:\Users\komal\OneDrive\Desktop\metrics\mm_new\seo.css", "a") as f:
    f.write(css_append)
