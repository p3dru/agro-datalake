import os
files = [
    'agro-dashboard/app/components/ChartAgro.tsx',
    'agro-dashboard/app/components/ChartCreditoVBP.tsx',
    'agro-dashboard/app/components/ChartMatopiba.tsx',
    'agro-dashboard/app/page.tsx'
]

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Fix formmater value: number | string -> value: any
    content = content.replace('value: number | string', 'value: any')
    content = content.replace('name: string', 'name: any')
    
    # Fix ChartMatopiba.tsx chartData[0]
    if 'ChartMatopiba.tsx' in f:
        content = content.replace('Object.keys(chartData[0] || {}).filter(k => k !== \'ano\').map((estado, index) => (', 
                                  'Object.keys(chartData[0] || {}).filter((k) => k !== \'ano\').map((estado: any, index: number) => (')
        
    with open(f, 'w') as file:
        file.write(content)

