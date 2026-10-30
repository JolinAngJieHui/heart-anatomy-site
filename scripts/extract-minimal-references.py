"""Faithful paragraph extraction for the supplied 11-source guidance.
No generated descriptions, abstracts, figures, captions, tables or bibliography.
Produces pending-review records and scoped text; never grants scientific approval.
"""
import hashlib,json,re
import xml.etree.ElementTree as ET
from pathlib import Path
from lxml import html
import importlib.util
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.next/minimal-acquisition'
COLLECTION='minimal-2026-10-14'
OUT=ROOT/'knowledge-base/collections'/COLLECTION
REGISTER=json.loads((ROOT/'docs/rag/anatomy_RAG_minimal_reference_register.json').read_text(encoding='utf-8'))
ACQUIRED={r['id']:r for r in json.loads((CACHE/'acquisition.json').read_text(encoding='utf-8'))}
sha=lambda value:hashlib.sha256(value.encode('utf-8') if isinstance(value,str) else value).hexdigest()
text=lambda node:re.sub(r'\s+',' ',''.join(node.itertext())).strip()

def paragraphs(source):
    key=source['id']; found=[]
    if ACQUIRED[key].get('format')=='html':
        tree=html.fromstring((CACHE/(key+'.html')).read_bytes())
        if key=='R2':
            for section in tree.iter('div'):
                if not any(c.startswith('ipub-html-sec') for c in section.get('class','').split()):continue
                heading=next((text(n) for n in section if n.tag=='div' and 'ipub-html-title' in n.get('class','')),section.get('id',''))
                for i,p in enumerate(n for n in section if n.tag=='p'):
                    for n in p.xpath('.//img|.//table|.//figure'):n.drop_tree()
                    found.append((heading,section.get('id','')+f'/p[{i+1}]',text(p)))
        else:
            for section in tree.iter('div'):
                if 'c-article-section' not in section.get('class','').split():continue
                heading=next((text(n) for n in section if n.tag=='h2'),'')
                content=next((n for n in section if n.tag=='div' and 'c-article-section__content' in n.get('class','')),None)
                if content is None:continue
                for i,p in enumerate(n for n in content if n.tag=='p'):
                    for n in p.xpath('.//img|.//table|.//figure'):n.drop_tree()
                    found.append((heading,section.get('id','')+f'/p[{i+1}]',text(p)))
    else:
        tree=ET.fromstring((CACHE/(key+'.xml')).read_bytes())
        def walk(node,path):
            number=0
            for child in node:
                if child.tag=='sec':walk(child,path+[text(child.find('title')) if child.find('title') is not None else 'Unnamed section'])
                elif child.tag=='p':
                    number+=1; found.append((' > '.join(path),f"{node.get('id','body')}/p[{number}]",text(child)))
        walk(tree.find('body'),[])
    return found

def selected(key,heading):
    h=heading.lower()
    if key=='R1':return h=='3. anatomy of the coronary arteries'
    if key=='R2':return bool(re.match(r'^[1234]\.',h)) and not any(x in h for x in ['invasive','hemodynamic','post-mortem'])
    if key=='R3':return h.startswith(('1. introduction','2. clinical presentation','3. diagnosis')) or h=='4. lmcad pathophysiology and genetic/phenotypic considerations'
    if key=='R4':return h=='1. introduction' or ('2. updates in cad diagnosis' in h and 'planning percutaneous' not in h)
    if key=='R5':return h in ['introduction','background','discussion','limitations']
    if key=='R6':return h=='1. introduction' or any(x in h for x in ['2.1.1 anatomical','2.1.7 acute coronary','2.1.8 culprit','2.4 imaging'])
    if key=='R7':return h in ['background','case presentation','discussion']
    if key=='R8':return any(x in h for x in ['aortic anatomy','ascending aortic and sinuses','aortic dissection'])
    if key=='R9':return h in ['1. introduction','4. discussion']
    if key=='R10':return h in ['anatomy and physiology','etiologies','clinical evaluation','imaging','histology']
    if key=='R11':return ('pathophysiology' in h and 'specific pathology' not in h) or h in ['cst','cst > cst formation mechanisms','clinical presentations of cst','clinical diagnosis of cst']
    return False

def exclude(key,paragraph):
    # Drop whole paragraphs; never manufacture replacement prose or remove a qualifier.
    if not paragraph or len(paragraph)<60:return 'No coherent body paragraph'
    if re.search(r'\b(reproduced|reprinted|adapted)\b.{0,50}\bpermission\b',paragraph,re.I):return 'Separately credited material requires review'
    if re.search(r'\b(guidewires?|guiding catheters?|catheter was|catheter is advanced|stent placement|stent insertion|indicates a need for|percutaneous stenting|recanalized|recanalize|balloon inflation|anticoagulation therapy)\b',paragraph,re.I):return 'Excluded procedural instructions or treatment selection'
    if re.search(r'\b(aspirin|clopidogrel|heparin|warfarin|amiodarone|atorvastatin|bisoprolol|alteplase|dosage|drug regimen|drug-eluting|balloon angioplasty|cabg versus|pci versus|revascularization strategy|treated with|we recommend|recommended treatment)\b',paragraph,re.I):return 'Excluded treatment/procedural detail'
    if re.search(r'\b\d+[-\s]year[-\s]old\b|\bbody weight\b|\bHospital Center\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}',paragraph,re.I):return 'Excluded identifying case narrative'
    if re.search(r'\d\s*(?:mg|mmhg|mSv)\b|[<>≥≤]\s*\d',paragraph,re.I):return 'Unreviewed numerical diagnostic/procedural cutoff'
    if key=='R2' and re.search(r'\d\s*mm\b.{0,80}\b(ST|electrocard|elevation)\b|\b(ST|electrocard|elevation)\b.{0,80}\d\s*mm\b',paragraph,re.I):return 'Unreviewed ECG numerical cutoff'
    if key=='R1' and re.search(r'2\s*(?:[-–—]|to)\s*4\s*mm',paragraph,re.I):return 'Register exclusion: left-main length statement'
    if key=='R7' and re.search(r'\b(our patient|the patient|he was discharged|at least three|ST-segment elevation of \d)\b',paragraph,re.I):return 'Excluded identifying or unreviewed numerical case detail'
    if key=='R7' and re.search(r'inevitab|will die|death.{0,40}without|must.{0,30}(stent|intervention)',paragraph,re.I):return 'Register exclusion: absolute prognosis'
    if key in ['R5','R9'] and re.search(r'\b(patients? underwent|our patient|the patient|surgical technique|anticoagulation|anticoagulant|operative|thrombectomy)\b',paragraph,re.I):return 'Excluded case/treatment detail'
    return None

records=[];logs=[]
OUT.mkdir(parents=True,exist_ok=True)
for source in REGISTER['sources']:
    key=source['id']; acquired=ACQUIRED[key]; included=[]; excluded=[]
    if acquired['obtained'] and acquired['licenceChecked']:
        for heading,locator,paragraph in paragraphs(source):
            reason='Outside supplied starter scope' if not selected(key,heading) else exclude(key,paragraph)
            if reason:
                excluded.append({'section':heading,'locator':locator,'reason':reason,'originalTextSha256':sha(paragraph)})
                # The register explicitly permits selected non-identifying case
                # diagnostic narrative. Keep only complete, verbatim sentences
                # with their case qualification; never rewrite a clinical claim.
                if key=='R7' and selected(key,heading) and heading.lower() in ['case presentation','discussion']:
                    for number,sentence in enumerate(re.split(r'(?<=[.!?])\s+(?=[A-Z])',paragraph),1):
                        if re.search(r'\bin our case\b',sentence,re.I) and re.search(r'\b(EKG|ECG|angiogram|angiography)\b',sentence,re.I) and not exclude(key,sentence):
                            included.append({'section':heading,'locator':locator+f'/sentence[{number}]','text':sentence,'sha256':sha(sentence)})
            else:included.append({'section':heading,'locator':locator,'text':paragraph,'sha256':sha(paragraph)})
    attribution=f"# {source['title']}\n\nAuthors: {'; '.join(acquired.get('authors',[]))}\nSource: {source['url']}\nLicence: CC BY 4.0; https://creativecommons.org/licenses/by/4.0/\nCopyright: {acquired.get('copyrightNotice') or 'No separate copyright statement supplied in acquired metadata'}\nChange notice: Article prose excerpted; formatting normalised; figures, captions, tables and supplements omitted. Not scientifically reviewed; no author endorsement implied.\n\n"
    content=attribution+'\n\n'.join(f"## {p['section']} | {p['locator']}\n\n{p['text']}" for p in included)+'\n'
    digest=sha(content); version='extract-'+digest[:20]
    filename=f'pending_review/{COLLECTION}/{key}-{digest[:20]}.md' if included else None
    if filename:
        path=ROOT/'knowledge-base'/filename;path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists() and path.read_text(encoding='utf-8')!=content:raise ValueError('Immutable extraction file differs')
        path.write_bytes(content.encode('utf-8'))
    extraction={'collectionId':COLLECTION,'sourceLabel':key,'doi':source['doi'],'authors':acquired.get('authors',[]),'licenceUrl':acquired.get('licenceUrl'),'licenceText':acquired.get('licence'),'licenceCheckedOn':'2026-10-14','acquisitionUrl':acquired.get('acquisitionUrl'),'copyrightNotice':acquired.get('copyrightNotice'),'changesNotice':'Text excerpted and formatting normalised; images, captions, tables and supplements excluded. Generated explanations are AI paraphrases, not author endorsement.','rawSha256':acquired.get('rawSha256'),'sha256':digest if included else None,'articleType':acquired.get('articleType'),'starterSections':source['starter_sections'],'cautions':source['cautions'],'locators':[{'section':p['section'],'locator':p['locator'],'sha256':p['sha256']} for p in included]}
    record={'id':key,'title':source['title'],'institution':source['journal'],'publicationYear':source['year'],'edition':None,'yearOrEdition':source['volume_issue_pages'],'section':'Selected original article body paragraphs; exact headings and locators retained','structureIds':[v['structure_id'] for v in REGISTER['vessels'] if key in v['source_ids']],'topics':['cardiovascular-anatomy','cardiovascular-physiology','clinical-correlations','diagnostics'],'location':source['url'],'documentPath':filename,'sourceType':'journal','materialKind':'reference','status':'pending_review','approvedBy':None,'approvalDate':None,'documentVersion':version if included else 'metadata-1','approvedVersion':None,'approvedSha256':None,'licenseConfirmed':bool(included),'publicCitation':True,'externalIndexingPermission':{'cleared':bool(included),'reviewedBy':'Automated article-specific licence verification' if included else None,'reviewedOn':'2026-10-14' if included else None,'evidence':f"Article-specific CC BY 4.0 verified at {acquired.get('acquisitionUrl')}; licence {acquired.get('licenceUrl')}. Text-only scoped extraction, attribution and exclusions checked under project-owner upload authorisation. Scientific approval remains pending." if included else None},'extraction':extraction}
    records.append(record)
    logs.append({'sourceId':key,'obtained':acquired['obtained'],'identityVerified':acquired['obtained'],'licenceChecked':acquired['licenceChecked'],'licenceEvidenceUrl':acquired.get('acquisitionUrl'),'scientificReview':'pending_review','included':[{k:v for k,v in p.items() if k!='text'} for p in included],'excluded':excluded,'extractedParagraphs':len(included),'blocker':acquired['blocker'] if not included else None,'localIndexed':False,'remoteIndexed':False,'searchTested':False})
(OUT/'registry.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'extraction-log.json').write_text(json.dumps(logs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'register.json').write_text(json.dumps(REGISTER,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'sources':len(records),'assignments':sum(len(r['structureIds']) for r in records),'extracted':[{r['sourceId']:r['extractedParagraphs']} for r in logs]},indent=2))
