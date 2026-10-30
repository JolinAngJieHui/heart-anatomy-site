"""Acquire original article XML from legitimate repositories. No OpenAI calls.
Raw XML is a temporary acquisition cache, never an ingestion/upload directory.
Only exact DOI/title/author matches with article-specific CC BY 4.0 are retained.
"""
import concurrent.futures
import hashlib
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import unicodedata
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.next/minimal-acquisition'
REGISTER = ROOT / 'docs/rag/anatomy_RAG_minimal_reference_register.json'

def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'HeartAnatomyResearchReferenceImporter/2.0'})
    with urllib.request.urlopen(request,timeout=35) as response:
        data=response.read(20*1024*1024+1)
        if len(data)>20*1024*1024:raise ValueError('Response larger than 20 MB')
        return data,response.geturl()

def text(node):return re.sub(r'\s+',' ',''.join(node.itertext())).strip() if node is not None else ''
def norm(value):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',value).encode('ascii','ignore').decode().lower())

def acquire_html(source,result):
    from lxml import html
    endpoint=source['publisher_url'];cache=CACHE/(source['id']+'.html')
    raw=cache.read_bytes() if cache.exists() else fetch(endpoint)[0]
    tree=html.fromstring(raw)
    titles=tree.xpath('//meta[@name="citation_title"]/@content') or tree.xpath('//h1//text()')
    title=' '.join(t.strip() for t in titles if t.strip())
    dois=tree.xpath('//meta[@name="citation_doi"]/@content')
    authors=tree.xpath('//meta[@name="citation_author"]/@content')
    if source['doi'].lower() not in [d.lower() for d in dois] or norm(title)!=norm(source['title']):raise ValueError('Publisher article title/DOI could not be verified')
    expected=[' '.join(a.strip().split()[:-1]) for a in source['authors'].split(',') if a.strip() and 'et al' not in a]
    if not authors or any(norm(n) not in norm(' '.join(authors)) for n in expected):raise ValueError('Publisher named authors could not be verified')
    license_nodes=tree.xpath('//a[contains(@href,"creativecommons.org/licenses/by/4.0")]')
    if not license_nodes:raise ValueError('Publisher article-specific CC BY 4.0 link not found')
    licence=' '.join(license_nodes[0].getparent().itertext()).strip()
    CACHE.mkdir(parents=True,exist_ok=True);cache.write_bytes(raw)
    result.update(obtained=True,licenceChecked=True,acquisitionUrl=endpoint,title=title,authors=authors,licence=licence,licenceUrl='https://creativecommons.org/licenses/by/4.0/',copyrightNotice=None,rawSha256=hashlib.sha256(raw).hexdigest(),articleType='case-report' if source['id']=='R7' else 'review-article',format='html')
    return result

def acquire(source):
    result={'id':source['id'],'doi':source['doi'],'checkedOn':datetime.now(timezone.utc).isoformat(),'obtained':False,'licenceChecked':False,'blocker':None}
    try:
        url='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':'DOI:'+source['doi'],'format':'json','resultType':'core'})
        data,_=fetch(url)
        matches=[r for r in json.loads(data)['resultList']['result'] if r.get('doi','').lower()==source['doi'].lower()]
        candidates=[r for r in matches if r.get('pmcid')]
        if not candidates:return acquire_html(source,result)
        endpoint=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{candidates[0]['pmcid']}/fullTextXML"
        cache=CACHE/(source['id']+'.xml')
        raw=cache.read_bytes() if cache.exists() else fetch(endpoint)[0]
        tree=ET.fromstring(raw);meta=tree.find('./front/article-meta')
        actual_doi=text(meta.find("article-id[@pub-id-type='doi']"))
        title=text(meta.find('title-group/article-title'))
        author_groups=[g for g in meta.findall('contrib-group') if g.get('content-type')=='author']
        contributors=[c for g in (author_groups or meta.findall('contrib-group')) for c in g.findall('contrib') if c.attrib.get('contrib-type','author')=='author' and 'editor' not in text(c.find('role')).lower()]
        surnames=[text(c.find('name/surname')) for c in contributors]
        expected=[' '.join(a.strip().split()[:-1]) for a in source['authors'].split(',') if a.strip() and 'et al' not in a]
        if actual_doi.lower()!=source['doi'].lower() or norm(title)!=norm(source['title']):raise ValueError(f'Article identity mismatch: {actual_doi}; {title}')
        if any(norm(n) not in [norm(v) for v in surnames] for n in expected):raise ValueError('Named author list mismatch: '+str(surnames))
        license_node=meta.find('permissions/license');license_text=text(license_node)
        license_links=[n.attrib.get('{http://www.w3.org/1999/xlink}href','') for n in license_node.iter()] if license_node is not None else []
        licensed=any(re.match(r'https?://(?:www\.)?creativecommons.org/licenses/by/4\.0/?$',u) for u in license_links)
        if not licensed:licensed=bool(re.search(r'https?://(?:www\.)?creativecommons.org/licenses/by/4\.0/?',license_text))
        if not licensed:raise ValueError('Article-specific CC BY 4.0 notice not verified in acquired version')
        CACHE.mkdir(parents=True,exist_ok=True);cache.write_bytes(raw)
        result.update(obtained=True,licenceChecked=True,pmcid=candidates[0]['pmcid'],acquisitionUrl=endpoint,title=title,authors=[text(c.find('name/given-names'))+' '+text(c.find('name/surname')) for c in contributors],licence=license_text,licenceUrl='https://creativecommons.org/licenses/by/4.0/',copyrightNotice=text(meta.find('permissions/copyright-statement')),rawSha256=hashlib.sha256(raw).hexdigest(),articleType=tree.attrib.get('article-type'))
        sections=[]
        def walk(node,path):
            for child in node:
                if child.tag=='sec':walk(child,path+[text(child.find('title')) or 'Unnamed section'])
                elif child.tag=='p':sections.append({'section':' > '.join(path),'text':text(child)})
        body=tree.find('body')
        if body is None:raise ValueError('No article body')
        walk(body,[]);result['sections']=[{'heading':s['section'],'characters':len(s['text'])} for s in sections]
    except Exception as error:result['blocker']=str(error)
    return result

if __name__=='__main__':
    sources=json.loads(REGISTER.read_text(encoding='utf-8'))['sources']
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(acquire,sources))
    CACHE.mkdir(parents=True,exist_ok=True)
    (CACHE/'acquisition.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for r in results:print(json.dumps({k:r.get(k) for k in ['id','obtained','licenceChecked','pmcid','blocker']},ensure_ascii=True))
