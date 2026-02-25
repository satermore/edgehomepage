import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re
from datetime import datetime

# --- CONFIGURACIÓN ---
INPUT_FILE = "njpw_all_ppv_cards_links.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
DELAY_SECONDS = 3 

def log(mensaje, tipo="INFO"):
    ahora = datetime.now().strftime("%H:%M:%S")
    colores = {
        "INFO": "\033[94m",    # Azul
        "EXITO": "\033[92m",   # Verde
        "ADVERTENCIA": "\033[93m", # Amarillo
        "ERROR": "\033[91m",   # Rojo
        "RESET": "\033[0m"
    }
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
    filename = f"njpw_ppv_cagematch{anio}.json"
    
    datos_anio = []
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            try: datos_anio = json.load(f)
            except: pass
    
    datos_anio.append(evento)
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(datos_anio, f, ensure_ascii=False, indent=4)
    return anio

def extraer_detalles(url, titulo_original):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        response.encoding = response.apparent_encoding 
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extraer el número de episodio (ejemplo: #1701)
        match_ep = re.search(r'#\d+', titulo_original)
        num_episodio = match_ep.group(0) if match_ep else "N/A"

        datos_evento = {
            "Original_Title": titulo_original,
            "Number of Episode": num_episodio,
            "Url": url,
            "Name of the event": "",
            "Date": "",
            "Promotion": "",
            "Type": "",
            "Location": "",
            "Arena": "",
            "Matches": [],
            "All_Workers": ""
        }

        # 1. INFORMACIÓN GENERAL
        info_titles = soup.find_all('div', class_='InformationBoxTitle')
        info_contents = soup.find_all('div', class_='InformationBoxContents')
        for i in range(min(len(info_titles), len(info_contents))):
            label = limpiar_texto(info_titles[i].get_text()).replace(":", "")
            value = limpiar_texto(info_contents[i].get_text())
            if label in datos_evento:
                datos_evento[label] = value
            else:
                datos_evento[label] = value

        # 2. MATCHES
        match_containers = soup.find_all('div', class_='Match')
        for m in match_containers:
            type_div = m.find('div', class_='MatchType')
            results_div = m.find('div', class_='MatchResults')
            
            if results_div or type_div:
                datos_evento["Matches"].append({
                    "Match": limpiar_texto(results_div.get_text()) if results_div else "N/A",
                    "TypeMatch": limpiar_texto(type_div.get_text()) if type_div else "Match"
                })

        # 3. ALL WORKERS (Lógica corregida para Caption + Comments)
        caption_workers = soup.find('div', class_='Caption', string=re.compile(r'All workers', re.I))
        if caption_workers:
            div_nombres = caption_workers.find_next_sibling('div', class_='Comments')
            if div_nombres:
                datos_evento["All_Workers"] = limpiar_texto(div_nombres.get_text())

        return datos_evento

    except Exception as e:
        log(f"Error en {url}: {str(e)}", "ERROR")
        return None

def main():
    if not os.path.exists(INPUT_FILE):
        log(f"No se encuentra el archivo {INPUT_FILE}", "ERROR")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        enlaces = json.load(f)

    total = len(enlaces)
    conteo_por_anio = {}
    
    log(f"Iniciando Deep Scraping de {total} eventos...", "INFO")

    try:
        for i, item in enumerate(enlaces):
            # Log de inicio de proceso para este link
            log(f"[{i+1}/{total}] Analizando: {item['title']}")
            
            datos = extraer_detalles(item['link'], item['title'])
            
            if datos:
                anio = guardar_evento_por_anio(datos)
                conteo_por_anio[anio] = conteo_por_anio.get(anio, 0) + 1
                
                # Log detallado de confirmación
                num_matches = len(datos['Matches'])
                has_workers = "SÍ" if datos['All_Workers'] else "NO"
                ep = datos['Number of Episode']
                
                log(f"EXITO       | Ep: {ep} | Año: {anio} | Combates: {num_matches} | Workers: {has_workers}", "EXITO")
            else:
                log(f"FALLO       | No se pudo extraer data de: {item['title']}", "ADVERTENCIA")
            
            # Pausa para evitar bloqueos de IP
            time.sleep(DELAY_SECONDS)

    except KeyboardInterrupt:
        log("Proceso detenido manualmente por el usuario.", "ADVERTENCIA")

    # --- REPORTE FINAL ---
    print("\n" + "="*60)
    print("                RESUMEN FINAL DEL SCRAPING")
    print("="*60)
    if not conteo_por_anio:
        print(" No se procesaron datos correctamente.")
    else:
        for anio in sorted(conteo_por_anio.keys()):
            print(f" • [Año {anio}]: {conteo_por_anio[anio]} episodios guardados.")
    print("="*60)
    log("Proceso completado con éxito.", "EXITO")

if __name__ == "__main__":
    if os.name == 'nt': os.system('color')
    main()