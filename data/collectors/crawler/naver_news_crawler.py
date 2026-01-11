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
import argparse

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
        response = urllib.request.urlopen(request, timeout=5)
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

def crawl_naver_news(keyword, display=10, sort='sim', crawl_content=False):
    """
    네이버 뉴스 검색 및 본문 수집을 수행합니다.
    crawl_content=True일 경우 상세 페이지 본문까지 수집합니다 (시간 소요).
    """
    search_result = get_news_list(keyword, display=display, sort=sort)
    
    if not search_result or 'items' not in search_result:
        return None
    
    items = search_result['items']
    collected_data = []
    
    for item in items:
        # HTML 태그 제거 (API 응답의 제목과 요약에는 <b> 태그 등이 포함됨)
        item['title'] = BeautifulSoup(item['title'], 'html.parser').get_text()
        item['description'] = BeautifulSoup(item['description'], 'html.parser').get_text()
        
        if crawl_content and 'n.news.naver.com' in item['link']:
            content = get_news_content(item['link'])
            item['content'] = content
            if content:
                time.sleep(0.3)
        else:
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
    parser = argparse.ArgumentParser(description='NAVER News Crawler')
    parser.add_argument('--keyword', type=str, default='삼성전자', help='Search keyword for news')
    parser.add_argument('--display', type=int, default=10, help='Number of articles to crawl (max 100)')
    parser.add_argument('--sort', type=str, default='sim', choices=['sim', 'date'], help='Sort order: sim (similarity) or date (date)')
    
    args = parser.parse_args()
    
    result = crawl_naver_news(args.keyword, display=args.display, sort=args.sort)
    
    if result:
        save_to_json(result, f"naver_news_{args.keyword}.json")

