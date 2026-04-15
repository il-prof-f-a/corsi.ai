import pandas as pd
import numpy as np

def generate():
    try:
        df = pd.read_excel('25.xlsx', sheet_name='Indicatori principali', header=1)
        years = ['2017', '2018', '2019', '2020', '2021', '2022', '2023']
        
        def get_vals(ind, mod='Totale'):
            row = df[(df['Principali aggregati e indicatori economici'] == ind) & (df['Modalità di classificazione'] == mod)]
            if row.empty: return None
            return row[years].values[0]

        x_raw = get_vals('Addetti', 'Totale')
        va_p_raw = get_vals('Valore aggiunto per addetto', 'Totale')
        pos_raw = get_vals('Posizioni lavorative', 'Tipologia')

        data = pd.DataFrame({'year': years, 'x': x_raw, 'va_p': va_p_raw, 'pos': pos_raw}).apply(pd.to_numeric, errors='coerce').dropna()
        data['y1_va'] = (data['va_p'] * data['x']) / 1000 # Mln €
        
        X = data['x'].values
        Y1 = data['y1_va'].values
        Y2 = data['pos'].values

        # Formule
        l1 = np.polyfit(X, Y1, 1)
        l2 = np.polyfit(X, Y2, 1)
        p1 = np.polyfit(X, Y1, 5)
        p2 = np.polyfit(X, Y2, 5)

        print(f"\nFORMULA VA (y1): y = {l1[0]:.4f}x + ({l1[1]:.4f})")
        print(f"POLINOMIALE VA (y1): y = {p1[0]:.2e}x^5 + {p1[1]:.2e}x^4 + {p1[2]:.2e}x^3 + {p1[3]:.2e}x^2 + {p1[4]:.2e}x + {p1[5]:.2e}")
        
        print(f"\nFORMULA POS (y2): y = {l2[0]:.4f}x + ({l2[1]:.4f})")
        print(f"POLINOMIALE POS (y2): y = {p2[0]:.2e}x^5 + {p2[1]:.2e}x^4 + {p2[2]:.2e}x^3 + {p2[3]:.2e}x^2 + {p2[4]:.2e}x + {p2[5]:.2e}")

        # SVG
        w, h = 1000, 700
        pad = 100
        mx, Mx = X.min()*0.98, X.max()*1.02
        my1, My1 = Y1.min()*0.9, Y1.max()*1.1
        my2, My2 = Y2.min()*0.9, Y2.max()*1.1

        def tx(v): return pad + (v-mx)/(Mx-mx)*(w-2*pad)
        def ty1(v): return h-pad - (v-my1)/(My1-my1)*(h-2*pad)
        def ty2(v): return h-pad - (v-my2)/(My2-my2)*(h-2*pad)

        svg = [f'<svg width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg" style="background:#fdfdfd">']
        svg.append(f'<text x="{w/2}" y="40" text-anchor="middle" font-family="Arial" font-size="22" font-weight="bold">Analisi Predittiva: Addetti vs VA e Occupazione</text>')
        
        # Assi
        svg.append(f'<line x1="{pad}" y1="{h-pad}" x2="{w-pad}" y2="{h-pad}" stroke="#333" stroke-width="2"/>')
        svg.append(f'<line x1="{pad}" y1="{pad}" x2="{pad}" y2="{h-pad}" stroke="#3498db" stroke-width="2"/>')
        svg.append(f'<line x1="{w-pad}" y1="{pad}" x2="{w-pad}" y2="{h-pad}" stroke="#e74c3c" stroke-width="2"/>')

        # Curve
        xr = np.linspace(mx, Mx, 100)
        svg.append(f'<polyline points="{" ".join([f"{tx(v)},{ty1(np.polyval(p1,v))}" for v in xr])}" fill="none" stroke="#3498db" stroke-width="3" opacity="0.4"/>')
        svg.append(f'<polyline points="{" ".join([f"{tx(v)},{ty2(np.polyval(p2,v))}" for v in xr])}" fill="none" stroke="#e74c3c" stroke-width="3" opacity="0.4"/>')
        
        # Lineari
        svg.append(f'<line x1="{tx(mx)}" y1="{ty1(np.polyval(l1,mx))}" x2="{tx(Mx)}" y2="{ty1(np.polyval(l1,Mx))}" stroke="#3498db" stroke-width="1" stroke-dasharray="5"/>')
        svg.append(f'<line x1="{tx(mx)}" y1="{ty2(np.polyval(l2,mx))}" x2="{tx(Mx)}" y2="{ty2(np.polyval(l2,Mx))}" stroke="#e74c3c" stroke-width="1" stroke-dasharray="5"/>')

        # Punti
        for i in range(len(X)):
            svg.append(f'<circle cx="{tx(X[i])}" cy="{ty1(Y1[i])}" r="6" fill="#3498db"/>')
            svg.append(f'<rect x="{tx(X[i])-5}" y="{ty2(Y2[i])-5}" width="10" height="10" fill="#e74c3c"/>')
            svg.append(f'<text x="{tx(X[i])}" y="{ty1(Y1[i])-12}" text-anchor="middle" font-family="Arial" font-size="11">{data.iloc[i]["year"]}</text>')

        # Legenda (ASCII-friendly)
        svg.append(f'<text x="{pad+20}" y="{pad+20}" font-family="Arial" font-size="12" fill="#3498db" font-weight="bold">VA (Mln EUR)</text>')
        svg.append(f'<text x="{pad+20}" y="{pad+40}" font-family="Arial" font-size="12" fill="#e74c3c" font-weight="bold">Posizioni Lavorative</text>')

        svg.append('</svg>')
        with open('regressione_completa.svg', 'w', encoding='utf-8') as f: f.write("\n".join(svg))
        print("\nSVG creato correttamente.")

    except Exception as e: print(f"Errore: {e}")

if __name__ == "__main__": generate()
