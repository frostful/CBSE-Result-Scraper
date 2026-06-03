"""
Parse a CBSE result HTML page into a structured student record.

>>> EDIT THIS FILE if CBSE changes the result page layout (labels, tables, etc.). <<<
"""
import re
import logging

logger = logging.getLogger(__name__)

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


def strip_html(text):
    cleaned = re.sub(r'<[^>]+>', '', text)
    cleaned = cleaned.replace('&nbsp;', ' ').replace('&amp;', '&')
    return re.sub(r'\s+', ' ', cleaned).strip()


def parse_student_html(html_text, roll_no, admid):
    try:
        candidate_name, mother_name, father_name, school_name, result_status = "UNKNOWN", "", "", "", "PASS"
        if BeautifulSoup:
            soup = BeautifulSoup(html_text, 'html.parser')
            for td in soup.find_all('td'):
                td_text = td.get_text(strip=True)
                if 'Candidate Name' in td_text and ':' in td_text:
                    n = td.find_next_sibling('td')
                    candidate_name = n.find('b').get_text(strip=True) if n and n.find('b') else (n.get_text(strip=True) if n else "")
                elif "Mother" in td_text and "Name" in td_text and ':' in td_text:
                    n = td.find_next_sibling('td')
                    mother_name = n.find('b').get_text(strip=True) if n and n.find('b') else (n.get_text(strip=True) if n else "")
                elif "Father" in td_text and "Name" in td_text and ':' in td_text:
                    n = td.find_next_sibling('td')
                    father_name = n.find('b').get_text(strip=True) if n and n.find('b') else (n.get_text(strip=True) if n else "")
                elif "School" in td_text and "Name" in td_text and ':' in td_text:
                    n = td.find_next_sibling('td')
                    school_name = n.find('b').get_text(strip=True) if n and n.find('b') else (n.get_text(strip=True) if n else "")
            
            result_td = soup.find(string=re.compile(r"Result\s*:", re.I))
            if result_td:
                res_text = result_td.find_parent('tr').get_text(strip=True).upper() if result_td.find_parent('tr') else result_td.find_next().get_text(strip=True).upper()
                if 'COMP' in res_text: result_status = 'COMP'
                elif 'FAIL' in res_text or 'REPEAT' in res_text: result_status = 'FAIL'

        candidate_name = strip_html(candidate_name)
        mother_name = strip_html(mother_name)
        father_name = strip_html(father_name)
        school_name = strip_html(school_name)
        
        subjects_data = []
        if BeautifulSoup:
            soup = BeautifulSoup(html_text, 'html.parser')
            marks_table = next((t for t in soup.find_all('table') if 'SUB CODE' in t.text), None)
            if marks_table:
                for row in marks_table.find_all('tr'):
                    cols = [c.text.strip().replace(u'\xa0', u' ') for c in row.find_all(['td', 'th'])]
                    if len(cols) >= 6 and cols[0].isdigit() and cols[0] != 'SUB CODE':
                        subjects_data.append({
                            'SubCode': cols[0], 'SubName': cols[1], 'Theory': cols[2].strip(),
                            'Practical': cols[3].strip(), 'Total': cols[4].strip(), 'Grade': cols[5].strip()
                        })

        return {
            'Roll': roll_no, 'Name': candidate_name, 'MotherName': mother_name,
            'FatherName': father_name, 'SchoolName': school_name,
            'ResultStatus': result_status, 'Subjects': subjects_data
        }
    except Exception:
        logger.warning("Failed to parse HTML for roll=%s admid=%s", roll_no, admid, exc_info=True)
        return None
