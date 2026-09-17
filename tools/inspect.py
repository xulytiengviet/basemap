#!/usr/bin/env python3
import argparse,gzip,io,json
from pathlib import Path

class Entry:
    __slots__=('tile_id','offset','length','run_length')
    def __init__(self,tile_id,offset,length,run_length): self.tile_id=tile_id; self.offset=offset; self.length=length; self.run_length=run_length

def rv(b):
    shift=0; out=0
    while True:
        x=b.read(1)
        if not x: raise EOFError
        v=x[0]; out|=(v&127)<<shift
        if not v&128:return out
        shift+=7

def deser(data):
    b=io.BytesIO(gzip.decompress(data)); n=rv(b); es=[]; last=0
    for _ in range(n): last+=rv(b); es.append(Entry(last,0,0,0))
    for e in es:e.run_length=rv(b)
    for e in es:e.length=rv(b)
    for i,e in enumerate(es):
        x=rv(b); e.offset=(es[i-1].offset+es[i-1].length) if i>0 and x==0 else x-1
    return es

def find(es,tid):
    lo,hi=0,len(es)-1
    while lo<=hi:
        m=(lo+hi)//2
        if es[m].tile_id<tid:lo=m+1
        elif es[m].tile_id>tid:hi=m-1
        else:return es[m]
    if hi>=0 and (es[hi].run_length==0 or tid-es[hi].tile_id<es[hi].run_length): return es[hi]
    return None

def rotate(n,x,y,rx,ry):
    if ry==0:
        if rx:x=n-1-x;y=n-1-y
        x,y=y,x
    return x,y

def tid(z,x,y):
    a=((1<<(z*2))-1)//3
    for k in range(z-1,-1,-1):
        s=1<<k;rx=s&x;ry=s&y;a+=((3*rx)^ry)<<k;x,y=rotate(s,x,y,rx,ry)
    return a

def header(buf):
    if buf[:7]!=b'PMTiles' or buf[7]!=3: raise ValueError('not PMTiles v3')
    u64=lambda p:int.from_bytes(buf[p:p+8],'little'); i32=lambda p:int.from_bytes(buf[p:p+4],'little',signed=True)
    ks=['root_offset','root_length','metadata_offset','metadata_length','leaf_directory_offset','leaf_directory_length','tile_data_offset','tile_data_length','addressed_tiles_count','tile_entries_count','tile_contents_count']
    h={k:u64(8+i*8) for i,k in enumerate(ks)}
    h.update(version=3,clustered=bool(buf[96]),internal_compression=buf[97],tile_compression=buf[98],tile_type=buf[99],min_zoom=buf[100],max_zoom=buf[101],min_lon=i32(102)/1e7,min_lat=i32(106)/1e7,max_lon=i32(110)/1e7,max_lat=i32(114)/1e7,center_zoom=buf[118],center_lon=i32(119)/1e7,center_lat=i32(123)/1e7)
    return h

def get_tile(path,z,x,y):
    with open(path,'rb') as f:
        h=header(f.read(127)); target=tid(z,x,y)
        f.seek(h['root_offset']); root=deser(f.read(h['root_length'])); e=find(root,target)
        if not e:return None
        if e.run_length==0:
            f.seek(h['leaf_directory_offset']+e.offset); leaf=deser(f.read(e.length)); e=find(leaf,target)
            if not e:return None
        f.seek(h['tile_data_offset']+e.offset); return f.read(e.length)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('file',type=Path);ap.add_argument('--tile',nargs=3,type=int);a=ap.parse_args()
    with a.file.open('rb') as f:
        h=header(f.read(127));f.seek(h['metadata_offset']);meta=json.loads(gzip.decompress(f.read(h['metadata_length'])))
    print(json.dumps({'file':str(a.file),'size':a.file.stat().st_size,'header':h,'metadata':meta},indent=2,ensure_ascii=False))
    if a.tile:
        d=get_tile(a.file,*a.tile);print('tile_bytes',None if d is None else len(d))
        if d is not None: print('signature',d[:16].hex())
if __name__=='__main__':main()
