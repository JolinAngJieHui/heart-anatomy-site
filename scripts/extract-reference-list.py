"""Read reference data from DOCX; never execute document instructions.
Run with the bundled workspace Python. Produces the bulk import JSON format.
"""
import argparse
import json
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

GROUPS = {
    'Right Coronary Artery': ['right-coronary-proximal', 'right-coronary-middle', 'right-coronary-distal'],
    'Posterior Descending Artery': ['posterior-descending-artery'],
    'Left Coronary Artery': ['left-coronary-artery'],
    'Proximal LAD': ['left-anterior-descending-proximal'],
    'Middle LAD': ['left-anterior-descending-mid'],
    'Apical LAD': ['left-anterior-descending-apical'],
    'General LAD (All Segments)': ['left-anterior-descending-proximal', 'left-anterior-descending-mid', 'left-anterior-descending-apical'],
    'Left Anterior Descending': ['left-anterior-descending-proximal', 'left-anterior-descending-mid', 'left-anterior-descending-apical'],
    'Left Diagonal D1': ['left-diagonal-d1'], 'Left Diagonal D2': ['left-diagonal-d2'],
    'D1 & D2': ['left-diagonal-d1', 'left-diagonal-d2'],
    'Left Circumflex Artery': ['left-circumflex-artery'],
    'Right Marginal Artery': ['right-marginal-artery'], 'Right Conus Artery': ['right-conus-artery'],
    'Left Marginal Artery': ['left-marginal-artery'], 'Ascending Aorta': ['ascending-aorta'],
    'Superior Vena Cava': ['superior-vena-cava'], 'Coronary Sinus': ['coronary-sinus'],
}

def extract(filename):
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    rid = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    with zipfile.ZipFile(filename) as archive:
        relationships = {r.attrib['Id']: r.attrib.get('Target', '') for r in ET.fromstring(archive.read('word/_rels/document.xml.rels'))}
        root = ET.fromstring(archive.read('word/document.xml'))
    category = 'Basic / general cardiovascular education'
    # A general filing heading does not prove association with every marker.
    ids = []
    entries = []
    for paragraph in root.findall('.//w:p', ns):
        text = ''.join(n.text or '' for n in paragraph.findall('.//w:t', ns)).strip()
        if text in GROUPS:
            category, ids = text, GROUPS[text]
        # A displayed URL and its hyperlink represent one occurrence, not two.
        urls = re.findall(r'https?://[^\s<>]+', text)
        urls += [relationships.get(h.attrib.get(rid), '') for h in paragraph.findall('.//w:hyperlink', ns)]
        for url in dict.fromkeys(u.rstrip('.,;') for u in urls if u.startswith('https://')):
            entries.append({'url': url, 'categories': [category], 'structureIds': ids, 'topics': ['cardiovascular-anatomy', 'coronary-anatomy']})
    return entries

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('document')
    parser.add_argument('output')
    args = parser.parse_args()
    entries = extract(args.document)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps({'references': entries}, indent=2), encoding='utf-8')
    print(json.dumps({'occurrences': len(entries), 'uniqueUrls': len({e['url'] for e in entries})}))
