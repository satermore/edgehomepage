import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re
from datetime import datetime

# --- CONFIGURACIÓN ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def log(mensaje, tipo="INFO"):
    ahora = datetime.now().strftime("%H:%M:%S")
    colores = {"INFO": "\033[94m", "EXITO": "\033[92m", "ADVERTENCIA": "\033[93m", "ERROR": "\033[91m", "RESET": "\033[0m"}
    color = colores.get(tipo, colores["RESET"])
    print(f"[{ahora}] {color}{tipo:11}{colores['RESET']} | {mensaje}")

def limpiar_texto(texto):
    if not texto: return ""
    texto = texto.replace('\xa0', ' ').replace('\t', ' ')
    return re.sub(r'\s+', ' ', texto).strip()

def guardar_evento_por_anio(evento):
    fecha = evento.get("Date", "")
    match = re.search(r'\d{2}\.\d{2}\.(\d{4})', fecha)
    anio = match.group(1) if match else "Desconocido"
    filename = f"evento_especifico_{anio}.json"
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump([evento], f, ensure_ascii=False, indent=4)
    return filename

def extraer_detalles(url, titulo_original):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        response.encoding = response.apparent_encoding 
        soup = BeautifulSoup(response.text, 'html.parser')
        
        datos_evento = {
            "Original_Title": titulo_original,
            "Url": url,
            "Matches": [],
            "All_Workers": ""
        }

        # 1. INFORMACIÓN GENERAL
        info_titles = soup.find_all('div', class_='InformationBoxTitle')
        info_contents = soup.find_all('div', class_='InformationBoxContents')
        for i in range(min(len(info_titles), len(info_contents))):
            label = limpiar_texto(info_titles[i].get_text()).replace(":", "")
            datos_evento[label] = limpiar_texto(info_contents[i].get_text())

        # 2. COMBATES
        match_containers = soup.find_all('div', class_='Match')
        for m in match_containers:
            type_div = m.find('div', class_='MatchType')
            results_div = m.find('div', class_='MatchResults')
            if results_div or type_div:
                datos_evento["Matches"].append({
                    "Match": limpiar_texto(results_div.get_text()) if results_div else "N/A",
                    "TypeMatch": limpiar_texto(type_div.get_text()) if type_div else "Match"
                })

        return datos_evento
    except Exception as e:
        log(f"Error: {str(e)}", "ERROR")
        return None

def main():
    # URL ÚNICA SOLICITADA
    URL_OBJETIVO = "https://www.cagematch.net/?id=1&nr=5711&page=2"
    TITULO_TEMPORAL = "Evento Individual"

    log(f"Iniciando extracción de enlace único...")
    
    datos = extraer_detalles(URL_OBJETIVO, TITULO_TEMPORAL)
    
    if datos:
        archivo = guardar_evento_por_anio(datos)
        log(f"EXITO | Datos guardados en {archivo}", "EXITO")
        log(f"Detalles: {datos.get('Name of the event', 'N/A')} - {datos.get('Date', 'N/A')}")
    else:
        log("No se pudo extraer la información.", "ERROR")

if __name__ == "__main__":
    if os.name == 'nt': os.system('color')
    main()