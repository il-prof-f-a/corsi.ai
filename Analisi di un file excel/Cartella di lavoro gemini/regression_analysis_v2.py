import pandas as pd
import numpy as np

def generate():
    try:
        df = pd.read_excel('25.xlsx', sheet_name='Indicatori principali', header=1)
        years = ['2017', '2018', '2019', '2020', '2021', '2022', '2023']
        
        def get_vals(ind):
            row = df[(df['Principali aggregati e indicatori economici'] == ind) & (df['Modalità di classificazione'] == 'Totale')]
            return row[years].values[0]

        x = get_vals('Addetti')
        va_p = get_vals('Valore aggiunto per addetto')
        pos = get_vals('Posizioni lavorative')

        # Creo DataFrame e pulisco i NaN
        data = pd.DataFrame({'year': years, 'x': x, 'va_p': va_p, 'pos': pos}).apply(pd.to_numeric, errors='coerce').dropna()
        data['y1_va'] = (data['va_p'] * data['x']) / 1000 # Mln €
        
        X = data['x'].values
        Y1 = data['y1_va'].values
        Y2 = data['pos'].values

        # Formule (Lineare)
        l1 = np.polyfit(X, Y1, 1)
        l2 = np.polyfit(X, Y2, 1)
        
        # Formule (Polinomiale Grado 5)
        p1 = np.polyfit(X, Y1, 5)
        p2 = np.polyfit(X, Y2, 5)

        print("\n--- FORMULE PER VALORE AGGIUNTO (y1) ---")
        print(f"Lineare: y = {l1[0]:.4f}x + ({l1[1]:.4f})")
        print(f"Polinomiale: y = {p1[0]:.2e}x^5 + {p1[1]:.2e}x^4 + {p1[2]:.2e}x^3 + {p1[3]:.2e}x^2 + {p1[4]:.2e}x + {p1[5]:.2e}")

        print("\n--- FORMULE PER POSIZIONI LAVORATIVE (y2) ---")
        print(f"Lineare: y = {l2[0]:.4f}x + ({l2[1]:.4f})")
        print(f"Polinomiale: y = {p2[0]:.2e}x^5 + {p2[1]:.2e}x^4 + {p2[2]:.2e}x^3 + {p2[3]:.2e}x^2 + {p2[4]:.2e}x + {p2[5]:.2e}")

        # Generazione SVG
        w, h = 1000, 700
        pad = 100
        mx, Mx = X.min()*0.98, X.max()*1.02
        my1, My1 = Y1.min()*0.9, Y1.max()*1.1
        my2, My2 = Y2.min()*0.9, Y2.max()*1.1

        def tx(v): return pad + (v-mx)/(Mx-mx)*(w-2*pad)
        def ty1(v): return h-pad - (v-my1)/(My1-my1)*(h-2*pad)
        def ty2(v): return h-pad - (v-my2)/(My2-my2)*(h-2*pad)

        svg = [f'<svg width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg" style="background:white">']
        svg.append(f'<text x="{w/2}" y="40" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold">Analisi Regressione: Lavoratori vs VA e Occupazione</text>')
        
        # Curve
        xr = np.linspace(mx, Mx, 100)
        pts1 = " ".join([f"{tx(v)},{ty1(np.polyval(p1,v))}" for v in xr])
        pts2 = " ".join([f"{tx(v)},{ty2(np.polyval(p2,v))}" for v in xr])
        svg.append(f'<polyline points="{pts1}" fill="none" stroke="#3498db" stroke-width="3" opacity="0.5"/>')
        svg.append(f'<polyline points="{pts2}" fill="none" stroke="#e74c3c" stroke-width="3" opacity="0.5"/>')

        # Punti Reali
        for i in range(len(X)):
            svg.append(f'<circle cx="{tx(X[i])}" cy="{ty1(Y1[i])}" r="5" fill="#3498db"/>')
            svg.append(f'<rect x="{tx(X[i])-4}" y="{ty2(Y2[i])-4}" width="8" height="8" fill="#e74c3c"/>')
            svg.append(f'<text x="{tx(X[i])}" y="{ty1(Y1[i])-10}" font-size="10" text-anchor="middle">{data.iloc[i]["year"]}</text>')

        svg.append('</svg>')
        with open('regressione_finale.svg', 'w') as f: f.write("\n".join(svg))
        print("\nSVG 'regressione_finale.svg' creato.")

    except Exception as e: print(f"Errore: {e}")

if __name__ == "__main__": generate()
