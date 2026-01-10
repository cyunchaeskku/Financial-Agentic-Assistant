# -*- coding: utf-8 -*-
import os
import sys
import urllib.request
import json
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from pathlib import Path
from tqdm import tqdm
import time

# Load environment variables explicitly from project root
base_dir = Path(__file__).resolve().parent.parent.parent.parent
env_path = base_dir / ".env"

if env_path.exists():
    load_dotenv(env_path)
else:
    print(f"Warning: .env file not found at {env_path}")

# Corrected variable names from .env
CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

# Strip quotes if they were loaded from .env
if CLIENT_ID: CLIENT_ID = CLIENT_ID.strip('"')
if CLIENT_SECRET: CLIENT_SECRET = CLIENT_SECRET.strip('"')

def get_news_list(keyword, display=10, start=1, sort='sim'):
    """
    네이버 뉴스 검색 API를 호출하여 기사 목록을 가져옵니다.
    """
    encText = urllib.parse.quote(keyword)
    url = f"https://openapi.naver.com/v1/search/news.json?query={encText}&display={display}&start={start}&sort={sort}"
    
    request = urllib.request.Request(url)
    request.add_header("X-Naver-Client-Id", CLIENT_ID)
    request.add_header("X-Naver-Client-Secret", CLIENT_SECRET)
    
    try:
        response = urllib.request.urlopen(request)
        if response.getcode() == 200:
            return json.loads(response.read().decode('utf-8'))
        else:
            print(f"API Error Code: {response.getcode()}")
            return None
    except Exception as e:
        print(f"Error during API request: {e}")
        return None

def get_news_content(url):
    """
    네이버 뉴스 상세 페이지에서 본문 내용을 추출합니다.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 네이버 뉴스 본문 selector
        content_element = soup.select_one('#dic_area')
        if not content_element:
            content_element = soup.select_one('#newsct_article')
        if not content_element:
            content_element = soup.select_one('#articeBody')
            
        if content_element:
            # 불필요한 태그 제거
            for tag in content_element.select('.img_desc, .end_photo_org, script, style'):
                tag.decompose()
            return content_element.get_text(strip=True)
        else:
            return None
            
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

def crawl_naver_news(keyword, display=10):
    """
    검색부터 본문 수집까지 전체 과정을 수행합니다.
    """
    print(f"Searching news for: {keyword}...")
    search_result = get_news_list(keyword, display=display)
    
    if not search_result or 'items' not in search_result:
        print("No results found.")
        return None
    
    items = search_result['items']
    print(f"Found {len(items)} articles. Starting content crawl...")
    
    collected_data = []
    
    for item in tqdm(items):
        # 네이버 뉴스 링크가 있는 경우에만 본문 수집
        if 'n.news.naver.com' in item['link']:
            content = get_news_content(item['link'])
            if content:
                item['content'] = content
                collected_data.append(item)
                time.sleep(0.5)  # 요청 간 딜레이
        else:
            # 네이버 링크가 없으면 본문 없이 저장하거나 제외 (정책에 따라 결정)
            # 여기서는 제외하지 않고 content를 null로 두거나 제외할 수 있음
            # 일단 본문이 없으면 수집 목적에 부합하지 않으므로 제외하는 로직도 가능하나,
            # 제목/링크라도 남기기 위해 포함시킬 수도 있음. 여기서는 포함시킴.
            item['content'] = None
            collected_data.append(item)
            
    search_result['items'] = collected_data
    return search_result

def save_to_json(data, filename):
    save_dir = Path(__file__).parent.parent.parent / "storage" / "raw" / "crawler"
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / filename
    
    with open(save_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print(f"Data saved to {save_path}")

if __name__ == "__main__":
    target_keyword = "삼성전자"
    result = crawl_naver_news(target_keyword, display=5)
    
    if result:
        save_to_json(result, f"naver_news_{target_keyword}.json")
