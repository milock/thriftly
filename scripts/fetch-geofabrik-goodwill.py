#!/usr/bin/env python3
"""Download dated ODbL state snapshots, retain Goodwill candidates with source tags.
Requires osmium==4.2.0. Processes one state at a time, removes large scratch files,
and checkpoints small JSON outputs. No operator websites or Overpass services used.
"""
import argparse, datetime, hashlib, json, os, re, tempfile, time, urllib.request
from pathlib import Path
import osmium

ROOT=Path(__file__).resolve().parents[1]
STATES=json.loads((ROOT/'scripts/geofabrik-states.json').read_text())
CACHE=ROOT/'.cache/geofabrik'
CACHE.mkdir(parents=True,exist_ok=True)
NOW=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()

def current(stamp):
    dt=datetime.datetime.fromisoformat(stamp.replace('Z','+00:00'))
    age=(datetime.datetime.now(datetime.timezone.utc)-dt).total_seconds()
    return -300 <= age <= 7*86400

def matches(tags):
    return any(re.match(r'^goodwill\b',tags.get(k,''),re.I) for k in ['name','brand']) or tags.get('brand:wikidata')=='Q5583655'

class Candidates(osmium.SimpleHandler):
    def __init__(self):
        super().__init__();self.elements={}
    def node(self,n):
        tags=dict(n.tags)
        if matches(tags) and n.location.valid():
            self.elements[f'node/{n.id}']={'type':'node','id':n.id,'lat':n.location.lat,'lon':n.location.lon,'tags':tags}
    def way(self,w):
        tags=dict(w.tags)
        if not matches(tags):return
        coords=[(n.lat,n.lon) for n in w.nodes if n.location.valid()]
        if coords:
            self.elements[f'way/{w.id}']={'type':'way','id':w.id,'center':{'lat':(min(c[0] for c in coords)+max(c[0] for c in coords))/2,'lon':(min(c[1] for c in coords)+max(c[1] for c in coords))/2},'tags':tags}
    def area(self,a):
        if a.from_way():return
        tags=dict(a.tags)
        if not matches(tags):return
        coords=[(n.lat,n.lon) for ring in a.outer_rings() for n in ring if n.location.valid()]
        if coords:
            self.elements[f'relation/{a.orig_id()}']={'type':'relation','id':a.orig_id(),'center':{'lat':(min(c[0] for c in coords)+max(c[0] for c in coords))/2,'lon':(min(c[1] for c in coords)+max(c[1] for c in coords))/2},'tags':tags}

def fetch(state):
    out=CACHE/(state['code']+'.json')
    if out.exists():
        saved=json.loads(out.read_text())
        if current(saved.get('osm3s',{}).get('timestamp_osm_base','1970-01-01T00:00:00Z')) and saved.get('elements'):
            print(state['code'],'cached',len(saved['elements']),flush=True);return
    url=f"https://download.geofabrik.de/north-america/us/{state['slug']}-latest.osm.pbf"
    with tempfile.TemporaryDirectory(prefix='pbf-',dir=CACHE) as tmp:
        pbf=Path(tmp)/'state.osm.pbf';index=Path(tmp)/'nodes.idx'
        req=urllib.request.Request(url,headers={'User-Agent':'Thriftly/1.0 (+https://www.thriftly.xyz)'})
        print(state['code'],'downloading',url,flush=True)
        digest=hashlib.sha256()
        with urllib.request.urlopen(req,timeout=120) as response,pbf.open('wb') as f:
            while chunk:=response.read(4*1024*1024):f.write(chunk);digest.update(chunk)
        reader=osmium.io.Reader(str(pbf));stamp=reader.header().get('osmosis_replication_timestamp');reader.close()
        if not stamp or not current(stamp):raise RuntimeError(f'{state["code"]}: stale or undated snapshot {stamp}')
        handler=Candidates()
        handler.apply_file(str(pbf),locations=True,idx='sparse_file_array,'+str(index))
        if not handler.elements:raise RuntimeError(f'{state["code"]}: zero candidates; review source')
        body={'source':'geofabrik-openstreetmap','sourceUrl':url,'fetchedAt':NOW(),'sha256':digest.hexdigest(),'osm3s':{'timestamp_osm_base':stamp},'elements':list(handler.elements.values())}
        temp=out.with_suffix('.tmp');temp.write_text(json.dumps(body));temp.replace(out)
        print(state['code'],'complete',len(handler.elements),'candidates',stamp,flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--states',help='Comma-separated state codes; defaults to all 50 states and DC');args=parser.parse_args()
    selected=set(args.states.split(',')) if args.states else None
    states=[s for s in STATES if not selected or s['code'] in selected]
    if selected and selected-{s['code'] for s in states}:raise SystemExit('Unknown state code')
    failures=[]
    for state in states:
        for attempt in range(3):
            try:fetch(state);break
            except Exception as e:
                print(state['code'],'attempt',attempt+1,type(e).__name__,str(e),flush=True)
                if attempt==2:failures.append(state['code'])
                else:time.sleep(5*(attempt+1))
    if failures:raise SystemExit('Failed states: '+','.join(failures))
    print('All requested snapshots complete',flush=True)
if __name__=='__main__':main()
