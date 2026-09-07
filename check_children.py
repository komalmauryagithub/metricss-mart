import bs4
with open('tme.html', 'r', encoding='utf-8') as f:
    soup = bs4.BeautifulSoup(f, 'html.parser')

dashboard = soup.find('div', id='dashboard')
if dashboard:
    for child in dashboard.children:
        if isinstance(child, bs4.element.Tag):
            class_list = child.get('class', [])
            print(class_list)
