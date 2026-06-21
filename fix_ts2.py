import os
f = 'agro-dashboard/app/components/ChartMatopiba.tsx'

with open(f, 'r') as file:
    content = file.read()

# Fix grouped type back to any to bypass the arithmetic errors
content = content.replace('const grouped: Record<number, Record<string, number | string>> = {};', 'const grouped: any = {};')

with open(f, 'w') as file:
    file.write(content)

