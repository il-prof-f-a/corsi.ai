import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Caricamento dati
try:
    df = pd.read_excel('25.xlsx', sheet_name='Indicatori principali', header=1)
    df_tot = df[df['Modalità di classificazione'] == 'Totale']

    indicators = {
        'Valore aggiunto al costo dei fattori': 'Valore_Aggiunto',
        'Addetti': 'Addetti',
        'Ore lavorate': 'Ore_Lavorate'
    }

    data = {}
    years = [str(y) for y in range(2017, 2024)]

    for ind, name in indicators.items():
        row = df_tot[df_tot['Principali aggregati e indicatori economici'] == ind]
        if not row.empty:
            data[name] = pd.to_numeric(row[years].values[0], errors='coerce')

    pdf = pd.DataFrame(data, index=years).dropna()

    # Creazione grafico
    plt.figure(figsize=(12, 7))
    
    # La dimensione delle bolle rappresenta le ore lavorate (normalizzate per visibilità)
    sizes = pdf['Ore_Lavorate'] / pdf['Ore_Lavorate'].min() * 500
    
    scatter = plt.scatter(pdf['Valore_Aggiunto'], pdf['Addetti'], 
                        s=sizes, alpha=0.6, 
                        c=np.arange(len(pdf)), cmap='coolwarm', edgecolors='w')

    # Etichette anni
    for i, txt in enumerate(pdf.index):
        plt.annotate(txt, (pdf['Valore_Aggiunto'].iloc[i], pdf['Addetti'].iloc[i]), 
                    xytext=(10, 0), textcoords='offset points', fontsize=10, fontweight='bold')

    plt.title('Relazione tra Valore Aggiunto, Addetti e Ore Lavorate (Ateco 25: 2017-2023)', fontsize=14)
    plt.xlabel('Valore Aggiunto (Milioni di €)', fontsize=12)
    plt.ylabel('Numero di Addetti (Lavoratori)', fontsize=12)
    plt.grid(True, linestyle='--', alpha=0.6)
    
    # Legenda colori per gli anni
    cbar = plt.colorbar(scatter, ticks=np.arange(len(pdf)))
    cbar.set_label('Evoluzione Temporale', fontsize=10)
    cbar.set_ticklabels(pdf.index)

    plt.figtext(0.15, 0.02, '* La dimensione delle bolle rappresenta il volume totale delle Ore Lavorate.', 
                fontsize=9, style='italic')

    plt.tight_layout()
    plt.savefig('relazioni_indicatori_ateco25.svg', format='svg')
    print("Grafico generato con successo: relazioni_indicatori_ateco25.svg")

except Exception as e:
    print(f"Errore durante la generazione del grafico: {e}")
