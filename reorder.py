import re

with open('tme.html', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to find <div class="appointment-status-board"> ... </div>
# and <div class="sales-target-header"> ... </div>
# up to the end of <div class="target-progress-panel"> ... </div>
# Then swap them.

# Let's just use string finding since it's safer.
app_start = content.find('<div class="appointment-status-board">')
sales_start = content.find('<div class="sales-target-header">')

if app_start != -1 and sales_start != -1:
    # Find the end of target-progress-panel
    # It has a closing div, we will just find the next major block which is <div class="dashboard-panels">
    dash_panels_start = content.find('<div class="dashboard-panels">')
    
    if dash_panels_start != -1:
        app_block = content[app_start:sales_start]
        sales_block = content[sales_start:dash_panels_start]
        
        # We also need to reorder the sales target cards within sales_block.
        # cards are: set, contract, achieved, without-gst, remaining.
        # Required: set, achieved, without-gst, contract, remaining.
        
        # Split cards
        cards_container_start = sales_block.find('<div class="sales-target-strip">')
        cards_container_end = sales_block.find('</div>', sales_block.rfind('remaining')) + 6 # roughly
        
        new_content = content[:app_start] + sales_block + app_block + content[dash_panels_start:]
        with open('tme.html', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Swapped blocks successfully')
    else:
        print('Could not find dashboard-panels')
