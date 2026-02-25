import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin

# --- CONFIGURACIÓN ---
BASE_URL = "https://www.cagematch.net"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def extraer_todos_eventos():
    eventos_encontrados = []
    
    # Iterar por todas las páginas
    for s in range(0, 1501, 100):
        #url = f"{BASE_URL}?id=8&nr=1&page=4&showtype=TV-Show&search=WWE+NXT&s=0{s}"
        url = f"https://www.cagematch.net/en/?id=8&nr=7&page=4&showtype=Pay+Per+View%7CPremium+Live+Event&s=0"

        print(f"[*] Accediendo a página s={s}")
        
        try:
            response = requests.get(url, headers=HEADERS)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Buscar todas las filas de la tabla
            rows = soup.find_all('tr')
            
            for row in rows:
                # Buscar todas las celdas en esta fila
                cells = row.find_all('td')
                
                if len(cells) >= 6:
                    # Intentar extraer fecha (segunda celda)
                    fecha_cell = cells[1] if len(cells) > 1 else None
                    fecha = fecha_cell.get_text(strip=True) if fecha_cell else ""
                    
                    # Verificar si es una fecha válida (formato DD.MM.YYYY)
                    if fecha and len(fecha) == 10 and fecha[2] == '.' and fecha[5] == '.':
                        
                        # Buscar enlace del evento (cuarta celda)
                        if len(cells) > 3:
                            event_link_tag = cells[3].find('a')
                            if event_link_tag:
                                title = event_link_tag.get_text(strip=True)
                                href = event_link_tag.get('href', '')
                                
                                # Buscar enlace de Card (sexta celda)
                                if len(cells) > 5:
                                    card_link_tag = cells[5].find('a')
                                    if card_link_tag and "Card" in card_link_tag.get_text():
                                        card_href = card_link_tag.get('href', '')
                                        
                                        # Construir URLs completas
                                        if href and card_href:
                                            event_url = urljoin(BASE_URL, href)
                                            card_url = urljoin(BASE_URL, card_href)
                                            
                                            # Solo agregar si no existe ya
                                            if not any(e['title'] == title for e in eventos_encontrados):
                                                eventos_encontrados.append({
                                                    "title": title,
                                                    "link": card_url,
                                                    "date": fecha
                                                })
                                                print(f"[+] {fecha} - {title}")
            
            # Pequeña pausa entre páginas
            time.sleep(0.5)
            
        except Exception as e:
            print(f"[!] Error en página s={s}: {e}")
            continue
    
    # Ordenar por fecha (más reciente primero)
    eventos_encontrados.sort(key=lambda x: x['date'], reverse=True)
    
    # Guardar resultados
    with open("njpw_all_ppv_cards_links.json", "w", encoding="utf-8") as f:
        json.dump(eventos_encontrados, f, indent=4, ensure_ascii=False)
    
    print(f"\n[!] Éxito: {len(eventos_encontrados)} eventos encontrados.")
    return eventos_encontrados

if __name__ == "__main__":
    eventos = extraer_todos_eventos()
    
    # Mostrar algunos resultados
    if eventos:
        print("\n--- PRIMEROS 10 EVENTOS ---")
        for i, evento in enumerate(eventos[:10], 1):
            print(f"{i}. {evento['date']} - {evento['title']}")
            print(f"   Link: {evento['link']}")