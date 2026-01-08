import requests
import pandas as pd
from zipfile import ZipFile
from bs4 import BeautifulSoup
from pathlib import Path
import lxml
from io import BytesIO
import os
from dotenv import load_dotenv

load_dotenv()

# DART API 키
api_key = os.getenv('DART_API_KEY', '')

# Get the directory where the script is located and define the output path
script_dir = Path(__file__).parent
path = script_dir / 'DART' / 'corp_code.csv'

def get_corp_code(api_key: str, path: Path):
    """
    DART에 등록된 모든 회사의 고유번호를 요청하는 함수
    
    Args:
        api_key (str): DART API 키
        path (Path): 고유번호를 저장할 경로 (pathlib.Path object)
    """
    params = {'crtfc_key': api_key}
    url = 'https://opendart.fss.or.kr/api/corpCode.xml'
    
    try:
        # DART API에 고유번호 zip 파일 요청
        res = requests.get(url, params=params)
        res.raise_for_status()  # HTTP 오류가 발생하면 예외를 발생시킴
        
        # 요청에 성공하면 zip 파일 압축 해제
        zipfile = ZipFile(BytesIO(res.content))
        xml_file = zipfile.open('CORPCODE.xml')
        
        # XML 파일을 읽고 파싱
        soup = BeautifulSoup(xml_file, 'lxml-xml')
        
        # corp_code, corp_name, stock_code, modify_date 추출
        corp_codes = soup.find_all('corp_code')
        corp_names = soup.find_all('corp_name')
        stock_codes = soup.find_all('stock_code')
        modify_dates = soup.find_all('modify_date')
        
        # 데이터를 리스트로 변환
        corp_code_list = [code.text for code in corp_codes]
        corp_name_list = [name.text for name in corp_names]
        stock_code_list = [stock.text.strip() for stock in stock_codes]
        modify_date_list = [date.text for date in modify_dates]
        
        # DataFrame 생성
        df = pd.DataFrame({
            'corp_code': corp_code_list,
            'corp_name': corp_name_list,
            'stock_code': stock_code_list,
            'modify_date': modify_date_list
        })
        
        # Ensure the directory exists
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # CSV 파일로 저장
        df.to_csv(path, index=False, encoding='utf-8-sig')
        print(f"Successfully saved corporation codes to {path}")
        
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    if api_key == '':
        print("Failed to load DART API KEY")
    else:
        get_corp_code(api_key, path)
        print("success")