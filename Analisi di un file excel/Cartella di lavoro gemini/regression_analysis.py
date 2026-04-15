import pandas as pd
import numpy as np
import math

def generate_svg_regression():
    try:
        # Caricamento dati
        df = pd.read_excel('25.xlsx', sheet_name='Indicatori principali', header=1)
        years = ['2017', '2018', '2019', '2020', '2021', '2022', '2023']
        
        def get_data(indicator):
            row = df[(df['Principali aggregati e indicatori economici'] == indicator) & 
                    (df['Modalità di classificazione'] == 'Totale')]
            if not row.empty:
                return [float(x) for x in row[years].values[0]]
            return None

        x_addetti = np.array(get_data('Addetti'))
        va_per_addetto = np.array(get_data('Valore aggiunto per addetto'))
        y1_va_tot = (va_per_addetto * x_addetti) / 1000  # Mln €
        y2_posizioni = np.array(get_data('Posizioni lavorative'))

        # Regressioni per Valore Aggiunto (Y1)
        lin_y1 = np.polyfit(x_addetti, y1_va_tot, 1)
        poly5_y1 = np.polyfit(x_addetti, y1_va_tot, 5)

        # Regressioni per Posizioni Lavorative (Y2)
        lin_y2 = np.polyfit(x_addetti, y2_posizioni, 1)
        poly5_y2 = np.polyfit(x_addetti, y2_posizioni, 5)

        print("\n--- PARAMETRI REGRESSIONE (Addetti -> Valore Aggiunto) ---")
        print(f"Lineare: y = {lin_y1[0]:.4f}x + ({lin_y1[1]:.4f})")
        print(f"Polinomiale Grado 5: y = {poly5_y1[0]:.2e}x^5 + {poly5_y1[1]:.2e}x^4 + {poly5_y1[2]:.2e}x^3 + {poly5_y1[3]:.2e}x^2 + {poly5_y1[4]:.2e}x + {poly5_y1[5]:.2e}")

        print("\n--- PARAMETRI REGRESSIONE (Addetti -> Posizioni Lavorative) ---")
        print(f"Lineare: y = {lin_y2[0]:.4f}x + ({lin_y2[1]:.4f})")
        print(f"Polinomiale Grado 5: y = {poly5_y2[0]:.2e}x^5 + {poly5_y2[1]:.2e}x^4 + {poly5_y2[2]:.2e}x^3 + {poly5_y2[3]:.2e}x^2 + {poly5_y2[4]:.2e}x + {poly5_y2[5]:.2e}")

        # Generazione SVG
        width, height = 1000, 750
        padding = 100
        
        # Scale (Y doppia: sinistra VA, destra Posizioni)
        min_x, max_x = x_addetti.min() * 0.98, x_addetti.max() * 1.02
        min_y1, max_y1 = y1_va_tot.min() * 0.9, y1_va_tot.max() * 1.1
        min_y2, max_y2 = y2_posizioni.min() * 0.9, y2_posizioni.max() * 1.1

        def sx(v): return padding + (v - min_x) / (max_x - min_x) * (width - 2 * padding)
        def sy1(v): return height - padding - (v - min_y1) / (max_y1 - min_y1) * (height - 2 * padding)
        def sy2(v): return height - padding - (v - min_y2) / (max_y2 - min_y2) * (height - 2 * padding)

        svg = [f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">']
        svg.append('<rect width="100%" height="100%" fill="#fff"/>')
        
        # Assi
        svg.append(f'<line x1="{padding}" y1="{height-padding}" x2="{width-padding}" y2="{height-padding}" stroke="black" stroke-width="2"/>')
        svg.append(f'<line x1="{padding}" y1="{padding}" x2="{padding}" y2="{height-padding}" stroke="#3498db" stroke-width="2"/>') # Y1
        svg.append(f'<line x1="{width-padding}" y1="{padding}" x2="{width-padding}" y2="{height-padding}" stroke="#e74c3c" stroke-width="2"/>') # Y2
        
        # Etichette
        svg.append(f'<text x="{width/2}" y="{height-40}" text-anchor="middle" font-family="Arial" font-size="16">Numero di Addetti (Lavoratori)</text>')
        svg.append(f'<text x="40" y="{height/2}" text-anchor="middle" font-family="Arial" font-size="16" transform="rotate(-90 40,{height/2})" fill="#3498db">Valore Aggiunto (Mln €)</text>')
        svg.append(f'<text x="{width-40}" y="{height/2}" text-anchor="middle" font-family="Arial" font-size="16" transform="rotate(90 {width-40},{height/2})" fill="#e74c3c">Posizioni Lavorative</text>')
        svg.append(f'<text x="{width/2}" y="50" text-anchor="middle" font-family="Arial" font-size="22" font-weight="bold">Regressioni: Addetti vs Valore Aggiunto e Lavoro</text>')

        # Funzioni di regressione per il disegno
        x_range = np.linspace(min_x, max_x, 100)
        
        # Disegno Curve VA (Y1)
        path_lin1 = []
        path_poly1 = []
        for xi in x_range:
            yi_lin = np.polyval(lin_y1, xi)
            yi_poly = np.polyval(poly5_y1, xi)
            path_lin1.append(f"{sx(xi)},{sy1(yi_lin)}")
            path_poly1.append(f"{sx(xi)},{sy1(yi_poly)}")
        
        svg.append(f'<polyline points="{" ".join(path_lin1)}" fill="none" stroke="#3498db" stroke-width="1" stroke-dasharray="5"/>')
        svg.append(f'<polyline points="{" ".join(path_poly1)}" fill="none" stroke="#3498db" stroke-width="3" opacity="0.6"/>')

        # Disegno Curve Posizioni (Y2)
        path_lin2 = []
        path_poly2 = []
        for xi in x_range:
            yi_lin = np.polyval(lin_y2, xi)
            yi_poly = np.polyval(poly5_y2, xi)
            path_lin2.append(f"{sx(xi)},{sy2(yi_lin)}")
            path_poly2.append(f"{sx(xi)},{sy2(yi_poly)}")
            
        svg.append(f'<polyline points="{" ".join(path_lin2)}" fill="none" stroke="#e74c3c" stroke-width="1" stroke-dasharray="5"/>')
        svg.append(f'<polyline points="{" ".join(path_poly2)}" fill="none" stroke="#e74c3c" stroke-width="3" opacity="0.6"/>')

        # Punti reali
        for i in range(len(years)):
            # VA (Cerchi blu)
            svg.append(f'<circle cx="{sx(x_addetti[i])}" cy="{sy1(y1_va_tot[i])}" r="6" fill="#3498db" stroke="white" stroke-width="1"/>')
            # Posizioni (Quadrati rossi)
            svg.append(f'<rect x="{sx(x_addetti[i])-5}" y="{sy2(y2_posizioni[i])-5}" width="10" height="10" fill="#e74c3c" stroke="white" stroke-width="1"/>')
            # Anno
            svg.append(f'<text x="{sx(x_addetti[i])}" y="{sy1(y1_va_tot[i])-15}" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold">{years[i]}</text>')

        # Legenda
        svg.append('<rect x="120" y="80" width="300" height="100" fill="white" opacity="0.8" stroke="#ccc"/>')
        svg.append('<circle cx="140" cy="100" r="5" fill="#3498db"/> <text x="155" y="105" font-family="Arial" font-size="12">Punti Reali Valore Aggiunto</text>')
        svg.append('<rect x="135" y="120" width="10" height="10" fill="#e74c3c"/> <text x="155" y="130" font-family="Arial" font-size="12">Punti Reali Posizioni Lav.</text>')
        svg.append('<line x1="135" y1="145" x2="150" y2="145" stroke="black" stroke-dasharray="5"/> <text x="160" y="150" font-family="Arial" font-size="12">Regressione Lineare</text>')
        svg.append('<line x1="135" y1="165" x2="150" y2="165" stroke="black" stroke-width="3" opacity="0.4"/> <text x="160" y="170" font-family="Arial" font-size="12">Regr. Polinomiale (Grado 5)</text>')

        svg.append('</svg>')
        
        with open('regressione_ateco25_addetti.svg', 'w', encoding='utf-8') as f:
            f.write('\n'.join(svg))
        print("\nGrafico generato: regressione_ateco25_addetti.svg")

    except Exception as e:
        print(f"Errore: {e}")

if __name__ == "__main__":
    generate_svg_regression()
