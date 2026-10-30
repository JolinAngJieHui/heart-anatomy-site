"""Public repository ingestion, no keys or paid APIs.
Europe PMC fullTextXML is the repository's supported machine interface.
Only explicit unrestricted CC BY / CC BY-SA content is persisted as text.
NC/ND/custom/unknown licenses remain metadata-only pending rights clarification.
"""
import concurrent.futures
import argparse
import hashlib
import json
import re
import os
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'knowledge-base/imports/approved-reference-list.json'
CACHE = ROOT / 'knowledge-base/imports/verified-reference-metadata.json'

def text(node):
    return re.sub(r'\s+', ' ', ''.join(node.itertext())).strip() if node is not None else ''

def license_uri(uri, terms):
    # XML inline text can concatenate '/4.0/' and 'This'. Capture just the URI.
    pattern = r'https?://(?:www\.)?creativecommons.org/licenses/[a-z-]+/\d\.\d/?'
    match = re.search(pattern, uri or '') or re.search(pattern, terms or '')
    if match: return match.group(0)
    # Do not infer an unrestricted licence from a restricted attribution licence.
    if re.search(r'non[ -]?commercial|no[ -]?derivatives|CC[ -]*BY[ -]*(?:NC|ND)', terms, re.I): return None
    if 'Creative Commons Attribution License' in terms and re.search(r'unrestricted use|permits any use', terms, re.I):
        version = re.search(r'\bCC[ -]*BY\s+(\d\.\d)', terms, re.I)
        # Generic BY URI records an unspecified version; never invent an edition.
        return 'https://creativecommons.org/licenses/by/' + (version.group(1) + '/' if version else '')
    return None

def permitted(uri):
    return bool(uri and re.fullmatch(r'https?://(?:www\.)?creativecommons.org/licenses/(?:by|by-sa)/(?:\d\.\d/?)?', uri))

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'HeartAnatomyEducationalReferenceImporter/1.0'}), timeout=25) as response:
        if int(response.headers.get('Content-Length', 0)) > 20 * 1024 * 1024:
            raise ValueError('Response exceeds 20 MB')
        data = response.read(20 * 1024 * 1024 + 1)
        if len(data) > 20 * 1024 * 1024: raise ValueError('Response exceeds 20 MB')
        return data, response.geturl()

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(); self.in_title = False; self.title = ''; self.values = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title': self.in_title = True
        if tag == 'meta':
            key = attrs.get('name', attrs.get('property', '')).lower()
            self.values.setdefault(key, []).append(attrs.get('content', ''))
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
    def handle_data(self, data):
        if self.in_title: self.title += data

def ingest(url):
    result = {'url': url, 'checkedOn': '2026-10-11', 'identityVerified': False,
              'access': 'unavailable', 'title': None, 'authors': [], 'publicationYear': None,
              'doi': None, 'publicationDetails': None, 'license': None, 'licenseUrl': None,
              'articleType': None, 'text': None, 'sections': [], 'issues': []}
    try:
        match = re.fullmatch(r'https://pmc.ncbi.nlm.nih.gov/articles/(PMC\d+)/?', url)
        if match:
            pmcid = match.group(1)
            endpoint = f'https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML'
            data, resolved = fetch(endpoint)
            tree = ET.fromstring(data)
            meta = tree.find('./front/article-meta')
            if meta is None: raise ValueError('Article metadata missing')
            actual = text(meta.find("article-id[@pub-id-type='pmcid']"))
            if actual != pmcid: raise ValueError(f'Identity mismatch: expected {pmcid}, received {actual}')
            result.update(identityVerified=True, access='repository-xml', resolvedUrl=resolved, verificationUrl=endpoint,
                          title=text(meta.find('title-group/article-title')), articleType=tree.attrib.get('article-type'),
                          authors=[text(c.find('name/given-names')) + ' ' + text(c.find('name/surname')) if c.find('name') is not None else text(c.find('collab')) for c in meta.findall("contrib-group/contrib[@contrib-type='author']")],
                          doi=text(meta.find("article-id[@pub-id-type='doi']")) or None)
            date = meta.find("pub-date[@pub-type='epub']")
            if date is None: date = meta.find('pub-date')
            year = text(date.find('year')) if date is not None else ''
            result['publicationYear'] = int(year) if year.isdigit() else None
            journal = text(tree.find('./front/journal-meta/journal-title-group/journal-title'))
            result['publicationDetails'] = ', '.join(filter(None, [journal, year, text(meta.find('volume')), text(meta.find('issue')), text(meta.find('fpage')), text(meta.find('elocation-id'))]))
            license_node = meta.find('permissions/license')
            license_url = license_node.attrib.get('{http://www.w3.org/1999/xlink}href', '') if license_node is not None else ''
            if not license_url and license_node is not None:
                for n in license_node.iter():
                    href = n.attrib.get('{http://www.w3.org/1999/xlink}href', '')
                    if 'creativecommons.org/licenses/' in href: license_url = href; break
            license_text = text(license_node)
            if not license_url:
                found = re.search(r'https?://creativecommons.org/licenses/[^\s<)]+', license_text)
                if found: license_url = found.group(0)
            license_url = license_uri(license_url, license_text)
            result.update(license=license_text or 'No explicit license found', licenseUrl=license_url)
            allowed = permitted(license_url)
            if allowed:
                blocks = []
                def walk(node, headings):
                    for child in node:
                        if child.tag == 'sec':
                            heading = text(child.find('title')) or 'Unnamed section'
                            walk(child, headings + [heading])
                        elif child.tag == 'p':
                            paragraph = text(child)
                            if paragraph:
                                locator = ' > '.join(headings) or 'Article body'
                                blocks.append({'section': locator, 'text': paragraph})
                body = tree.find('body')
                if body is not None: walk(body, [])
                result['sections'] = list(dict.fromkeys(b['section'] for b in blocks))
                result['text'] = '\n\n'.join('## ' + b['section'] + '\n\n' + b['text'] for b in blocks) or None
                if not result['text']: result['issues'].append('No usable article-body paragraphs')
                result['rawSha256'] = hashlib.sha256(data).hexdigest()
            else:
                result['issues'].append('Full text not retained: NC/ND/custom/unknown license needs clarification')
        else:
            data, resolved = fetch(url)
            page = Metadata(); page.feed(data.decode('utf-8', errors='replace'))
            title = next(iter(page.values.get('citation_title', []) or page.values.get('og:title', [])), page.title).strip()
            if not title or re.search(r'access denied|captcha|just a moment|page not found|404|403|robot', title, re.I):
                raise ValueError('Error/challenge page; no verified citation')
            result.update(access='html-metadata', resolvedUrl=resolved, verificationUrl=url, title=title,
                          identityVerified=True, authors=page.values.get('citation_author', []),
                          doi=next(iter(page.values.get('citation_doi', [])), None))
            result['issues'].append('Website title verified; full text excluded until reuse permission is established')
    except Exception as error:
        result['issues'].append(str(error))
        match = re.fullmatch(r'https://pmc.ncbi.nlm.nih.gov/articles/(PMC\d+)/?', url)
        if match:
            try:
                endpoint = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=' + match.group(1) + '&format=json&resultType=core'
                data, _ = fetch(endpoint)
                matches = [r for r in json.loads(data)['resultList']['result'] if r.get('pmcid') == match.group(1)]
                if len(matches) != 1: raise ValueError('No unique exact PMCID metadata match')
                record = matches[0]
                year = record.get('pubYear', '')
                result.update(identityVerified=True, access='metadata-only-repository', verificationUrl=endpoint,
                              title=record.get('title'), authors=[a.get('fullName') or a.get('collectiveName') for a in record.get('authorList', {}).get('author', []) if a.get('fullName') or a.get('collectiveName')],
                              publicationYear=int(year) if str(year).isdigit() else None, doi=record.get('doi'),
                              publicationDetails=json.dumps(record.get('journalInfo', {}), ensure_ascii=False))
                result['issues'].append('Repository metadata verified, full text unavailable through XML interface')
            except Exception as fallback_error:
                result['issues'].append('Metadata fallback: ' + str(fallback_error))
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', default=str(INPUT))
    parser.add_argument('--output', default=str(CACHE))
    parser.add_argument('--retry-unavailable', action='store_true')
    parser.add_argument('--retry-permitted', action='store_true')
    args = parser.parse_args()
    INPUT, CACHE = Path(args.input), Path(args.output)
    value = json.loads(INPUT.read_text(encoding='utf-8'))
    entries = value if isinstance(value, list) else value['references']
    entries = [{'url': e} if isinstance(e, str) else e for e in entries]
    urls = list(dict.fromkeys(e['url'] for e in entries))
    existing = json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else []
    done = {r['url']: r for r in existing}
    retry = set()
    if args.retry_unavailable: retry.update(url for url, r in done.items() if not r['identityVerified'])
    if args.retry_permitted: retry.update(url for url, r in done.items() if not r['text'] and permitted(license_uri(r['licenseUrl'], r['license'] or '')))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(ingest, [u for u in urls if u not in done or u in retry]):
            prior = done.get(result['url'])
            if prior and not result['license'] and prior['license']:
                result['license'], result['licenseUrl'] = prior['license'], prior['licenseUrl']
                result['issues'].append('Previously verified licence metadata retained; latest full-text refresh unavailable')
            done[result['url']] = result
            # Never drop untouched entries during a retry; atomic replacement survives interruption.
            CACHE.parent.mkdir(parents=True, exist_ok=True)
            temporary = CACHE.with_suffix('.json.tmp')
            temporary.write_text(json.dumps(list(done.values()), indent=2), encoding='utf-8')
            os.replace(temporary, CACHE)
            print(json.dumps({k: result[k] for k in ['url', 'title', 'identityVerified', 'issues']}, ensure_ascii=True), flush=True)
    print(json.dumps({'unique': len(done), 'verified': sum(r['identityVerified'] for r in done.values()), 'searchable': sum(bool(r['text']) for r in done.values())}))
