import pandas as pd

def generate_svg():
    try:
        # Caricamento dati
        df = pd.read_excel('25.xlsx', sheet_name='Indicatori principali', header=1)
        
        # Filtro per dati disponibili
        years = ['2017', '2018', '2019', '2020', '2021', '2022', '2023']
        
        def get_data(indicator):
            row = df[(df['Principali aggregati e indicatori economici'] == indicator) & 
                    (df['Modalità di classificazione'] == 'Totale')]
            if not row.empty:
                return [float(x) for x in row[years].values[0]]
            return None

        addetti = get_data('Addetti')
        va_per_addetto = get_data('Valore aggiunto per addetto')
        investimenti_per_addetto = get_data('Investimenti per addetto')

        if not addetti or not va_per_addetto:
            # Fallback su altri indicatori se necessari
            print("Dati insufficienti per alcuni indicatori. Verifico altri...")
            return

        # Calcolo Valore Aggiunto Totale (Mln €)
        va_totale = [(v * a) / 1000 for v, a in zip(va_per_addetto, addetti)]
        
        # Preparazione punti
        points = []
        for i, year in enumerate(years):
            points.append({
                'year': year,
                'va': va_totale[i],
                'addetti': addetti[i],
                'inv': investimenti_per_addetto[i] if investimenti_per_addetto else 10
            })

        # Dimensioni SVG
        width, height = 800, 600
        padding = 80

        # Scale
        min_va, max_va = min(p['va'] for p in points) * 0.95, max(p['va'] for p in points) * 1.05
        min_addetti, max_addetti = min(p['addetti'] for p in points) * 0.95, max(p['addetti'] for p in points) * 1.05
        min_inv, max_inv = min(p['inv'] for p in points), max(p['inv'] for p in points)

        def scale_x(v): return padding + (v - min_va) / (max_va - min_va) * (width - 2 * padding)
        def scale_y(v): return height - padding - (v - min_addetti) / (max_addetti - min_addetti) * (height - 2 * padding)
        def scale_r(v): return 10 + (v - min_inv) / (max_inv - min_inv) * 20

        # Generazione XML SVG
        svg = [f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">']
        svg.append('<rect width="100%" height="100%" fill="#ffffff"/>')
        
        # Assi e Griglia
        svg.append(f'<line x1="{padding}" y1="{height-padding}" x2="{width-padding}" y2="{height-padding}" stroke="#333" stroke-width="2"/>')
        svg.append(f'<line x1="{padding}" y1="{padding}" x2="{padding}" y2="{height-padding}" stroke="#333" stroke-width="2"/>')
        
        # Titoli
        svg.append(f'<text x="{width/2}" y="{height-20}" text-anchor="middle" font-family="Arial" font-size="14">Valore Aggiunto Totale (Milioni di €)</text>')
        svg.append(f'<text x="25" y="{height/2}" text-anchor="middle" font-family="Arial" font-size="14" transform="rotate(-90 25,{height/2})">Numero di Addetti</text>')
        svg.append(f'<text x="{width/2}" y="40" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold">Relazione Valore Aggiunto vs Addetti (Ateco 25)</text>')

        colors = ["#3498db", "#2980b9", "#1abc9c", "#f1c40f", "#e67e22", "#e74c3c", "#c0392b"]
        
        for i, p in enumerate(points):
            cx = scale_x(p['va'])
            cy = scale_y(p['addetti'])
            r = scale_r(p['inv'])
            color = colors[i]
            
            if i > 0:
                svg.append(f'<line x1="{scale_x(points[i-1]["va"])}" y1="{scale_y(points[i-1]["addetti"])}" x2="{cx}" y2="{cy}" stroke="#ccc" stroke-dasharray="4"/>')

            svg.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}" opacity="0.8" stroke="white">')
            svg.append(f'<title>Anno: {p["year"]}\nVA: {p["va"]:,.0f} M€\nAddetti: {p["addetti"]:,.0f}\nInv/Addetto: {p["inv"]}</title>')
            svg.append('</circle>')
            svg.append(f'<text x="{cx}" y="{cy-r-5}" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold">{p["year"]}</text>')

        svg.append(f'<text x="{width-250}" y="{height-40}" font-family="Arial" font-size="10" font-style="italic">* Dimensione bolla: Investimenti per addetto</text>')
        svg.append('</svg>')
        
        with open('relazioni_indicatori_ateco25.svg', 'w', encoding='utf-8') as f:
            f.write('\n'.join(svg))
        print("Grafico SVG generato con successo.")

    except Exception as e:
        print(f"Errore: {e}")

if __name__ == "__main__":
    generate_svg()
