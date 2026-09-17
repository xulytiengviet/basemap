#!/usr/bin/env python3
"""Build a clustered PMTiles v3 raster archive directly from a RAR containing z/x/y images.

No Python package dependencies. On Linux this uses libarchive.so via ctypes.
Designed for large XYZ tile trees without extracting hundreds of thousands of files.
"""
from __future__ import annotations
import argparse, ctypes, gzip, hashlib, io, json, math, os, re, shutil, sqlite3, tempfile, time
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path

class Compression(IntEnum):
    UNKNOWN=0; NONE=1; GZIP=2; BROTLI=3; ZSTD=4
class TileType(IntEnum):
    UNKNOWN=0; MVT=1; PNG=2; JPEG=3; WEBP=4; AVIF=5; MLT=6

@dataclass
class Entry:
    tile_id:int; offset:int; length:int; run_length:int

def rotate(n,x,y,rx,ry):
    if ry == 0:
        if rx != 0:
            x=n-1-x; y=n-1-y
        x,y=y,x
    return x,y

def zxy_to_tileid(z:int,x:int,y:int)->int:
    if z>31: raise OverflowError('zoom > 31')
    if x<0 or y<0 or x>(1<<z)-1 or y>(1<<z)-1: raise ValueError((z,x,y))
    acc=((1<<(z*2))-1)//3
    a=z-1
    while a>=0:
        s=1<<a; rx=s & x; ry=s & y
        acc += ((3*rx)^ry) << a
        x,y=rotate(s,x,y,rx,ry); a-=1
    return acc

def tileid_to_zxy(tile_id:int):
    z=((3*tile_id+1).bit_length()-1)//2
    acc=((1<<(z*2))-1)//3; pos=tile_id-acc; x=y=0; s=1; n=1<<z
    while s<n:
        rx=(pos//2)&s; ry=(pos^rx)&s
        x,y=rotate(s,x,y,rx,ry); x+=rx; y+=ry; pos >>= 1; s <<= 1
    return z,x,y

def write_varint(b:io.BytesIO,i:int):
    while True:
        c=i & 0x7f; i >>= 7
        if i: b.write(bytes([c|0x80]))
        else: b.write(bytes([c])); return

def serialize_directory(entries:list[Entry])->bytes:
    b=io.BytesIO(); write_varint(b,len(entries)); last=0
    for e in entries: write_varint(b,e.tile_id-last); last=e.tile_id
    for e in entries: write_varint(b,e.run_length)
    for e in entries: write_varint(b,e.length)
    for i,e in enumerate(entries):
        if i>0 and e.offset==entries[i-1].offset+entries[i-1].length: write_varint(b,0)
        else: write_varint(b,e.offset+1)
    return gzip.compress(b.getvalue(),mtime=0)

def build_roots_leaves(entries:list[Entry],leaf_size:int):
    roots=[]; leaves=bytearray(); i=0
    while i<len(entries):
        part=serialize_directory(entries[i:i+leaf_size])
        roots.append(Entry(entries[i].tile_id,len(leaves),len(part),0))
        leaves.extend(part); i+=leaf_size
    return serialize_directory(roots),bytes(leaves)

def optimize_directories(entries:list[Entry],target:int=16384-127):
    root=serialize_directory(entries)
    if len(root)<target: return root,b''
    leaf_size=4096
    while True:
        root,leaves=build_roots_leaves(entries,leaf_size)
        if len(root)<target: return root,leaves
        leaf_size*=2

def serialize_header(h:dict)->bytes:
    out=io.BytesIO(); out.write(b'PMTiles'); out.write(b'\x03')
    u64=lambda i: out.write(int(i).to_bytes(8,'little',signed=False))
    i32=lambda i: out.write(int(i).to_bytes(4,'little',signed=True))
    u8=lambda i: out.write(int(i).to_bytes(1,'little',signed=False))
    for k in ['root_offset','root_length','metadata_offset','metadata_length','leaf_directory_offset','leaf_directory_length','tile_data_offset','tile_data_length','addressed_tiles_count','tile_entries_count','tile_contents_count']:
        u64(h.get(k,0))
    u8(1 if h.get('clustered',True) else 0); u8(h['internal_compression']); u8(h['tile_compression']); u8(h['tile_type']); u8(h['min_zoom']); u8(h['max_zoom'])
    i32(h['min_lon_e7']); i32(h['min_lat_e7']); i32(h['max_lon_e7']); i32(h['max_lat_e7']); u8(h['center_zoom']); i32(h['center_lon_e7']); i32(h['center_lat_e7'])
    data=out.getvalue(); assert len(data)==127, len(data); return data

def lon_edge(x,z): return x/(1<<z)*360.0-180.0
def lat_edge(y,z): return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/(1<<z)))))

def archive_reader(rar_path:Path):
    lib=ctypes.CDLL('libarchive.so')
    lib.archive_read_new.restype=ctypes.c_void_p
    for fn in ['archive_read_support_format_all','archive_read_support_filter_all','archive_read_free']:
        getattr(lib,fn).argtypes=[ctypes.c_void_p]
    lib.archive_read_open_filename.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_size_t]
    lib.archive_read_next_header.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_void_p)]
    lib.archive_entry_pathname.argtypes=[ctypes.c_void_p]; lib.archive_entry_pathname.restype=ctypes.c_char_p
    lib.archive_entry_size.argtypes=[ctypes.c_void_p]; lib.archive_entry_size.restype=ctypes.c_longlong
    lib.archive_read_data.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_size_t]; lib.archive_read_data.restype=ctypes.c_ssize_t
    lib.archive_read_data_skip.argtypes=[ctypes.c_void_p]; lib.archive_read_data_skip.restype=ctypes.c_int
    lib.archive_error_string.argtypes=[ctypes.c_void_p]; lib.archive_error_string.restype=ctypes.c_char_p
    a=lib.archive_read_new(); lib.archive_read_support_filter_all(a); lib.archive_read_support_format_all(a)
    r=lib.archive_read_open_filename(a,os.fsencode(rar_path),1024*1024)
    if r!=0:
        err=lib.archive_error_string(a); raise RuntimeError(err.decode() if err else f'libarchive open error {r}')
    entry=ctypes.c_void_p()
    try:
        while True:
            r=lib.archive_read_next_header(a,ctypes.byref(entry))
            if r==1: break
            if r!=0:
                err=lib.archive_error_string(a); raise RuntimeError(err.decode() if err else f'libarchive header error {r}')
            name=lib.archive_entry_pathname(entry).decode('utf-8','replace')
            size=lib.archive_entry_size(entry)
            yield lib,a,entry,name,size
    finally:
        lib.archive_read_free(a)

def read_entry_data(lib,a,size:int)->bytes:
    if size<=0: return b''
    out=bytearray(size); view=(ctypes.c_char*size).from_buffer(out); pos=0
    while pos<size:
        ptr=ctypes.cast(ctypes.byref(view,pos),ctypes.c_void_p)
        n=lib.archive_read_data(a,ptr,size-pos)
        if n<0: raise RuntimeError('archive_read_data failed')
        if n==0: break
        pos+=n
    return bytes(out[:pos])

def stage_rar(rar:Path,db_path:Path):
    pat=re.compile(r'(?:^|/)tiles/(\d+)/(\d+)/(\d+)\.(png|jpe?g|webp|avif)$',re.I)
    con=sqlite3.connect(db_path)
    con.execute('PRAGMA journal_mode=OFF'); con.execute('PRAGMA synchronous=OFF'); con.execute('PRAGMA temp_store=MEMORY')
    con.execute('CREATE TABLE tiles(tileid INTEGER PRIMARY KEY,z INTEGER,x INTEGER,y INTEGER,fmt TEXT,data BLOB)')
    ranges={}; count=0; total=0; formats=set(); t=time.time()
    con.execute('BEGIN')
    for lib,a,entry,name,size in archive_reader(rar):
        m=pat.search(name)
        if not m:
            lib.archive_read_data_skip(a); continue
        z,x,y=map(int,m.group(1,2,3)); fmt=m.group(4).lower().replace('jpg','jpeg'); formats.add(fmt)
        data=read_entry_data(lib,a,size)
        if len(data)!=size: raise RuntimeError(f'short read {name}: {len(data)}/{size}')
        tileid=zxy_to_tileid(z,x,y)
        con.execute('INSERT INTO tiles VALUES(?,?,?,?,?,?)',(tileid,z,x,y,fmt,sqlite3.Binary(data)))
        r=ranges.setdefault(z,[x,x,y,y,0]); r[0]=min(r[0],x); r[1]=max(r[1],x); r[2]=min(r[2],y); r[3]=max(r[3],y); r[4]+=1
        count+=1; total+=size
        if count%10000==0:
            con.commit(); con.execute('BEGIN'); print(f'[stage] {count:,} tiles, {total/1e6:.1f} MB, {time.time()-t:.1f}s',flush=True)
    con.commit(); con.execute('CREATE INDEX tiles_z_idx ON tiles(z)'); con.commit(); con.close()
    if not count: raise RuntimeError('No tiles/{z}/{x}/{y}.png-like entries found')
    if len(formats)!=1: raise RuntimeError(f'Mixed formats not supported: {formats}')
    return count,total,ranges,next(iter(formats))

def write_pmtiles(db_path:Path,out_path:Path,ranges:dict,fmt:str,name:str,description:str,attribution:str):
    tile_type={'png':TileType.PNG,'jpeg':TileType.JPEG,'webp':TileType.WEBP,'avif':TileType.AVIF}[fmt]
    minz=min(ranges); maxz=max(ranges); xmin,xmax,ymin,ymax,_=ranges[maxz]
    bounds=[lon_edge(xmin,maxz),lat_edge(ymax+1,maxz),lon_edge(xmax+1,maxz),lat_edge(ymin,maxz)]
    center=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2,min(7,maxz)]
    metadata={'name':name,'description':description,'format':fmt,'scheme':'xyz','type':'baselayer','version':'1.0.0','minzoom':minz,'maxzoom':maxz,'bounds':','.join(f'{v:.8f}' for v in bounds),'center':f'{center[0]:.8f},{center[1]:.8f},{center[2]}','generator':'basemap xyz->PMTiles builder'}
    if attribution: metadata['attribution']=attribution
    con=sqlite3.connect(db_path)
    tmp=tempfile.TemporaryFile(); entries=[]; digest_to={}; offset=0; addressed=0; t=time.time()
    for tileid,data in con.execute('SELECT tileid,data FROM tiles ORDER BY tileid'):
        data=bytes(data); digest=hashlib.sha256(data).digest()
        found=digest_to.get(digest)
        if found is None:
            found=(offset,len(data)); digest_to[digest]=found; tmp.write(data); offset+=len(data)
        off,length=found
        if entries and tileid==entries[-1].tile_id+entries[-1].run_length and off==entries[-1].offset and length==entries[-1].length:
            entries[-1].run_length+=1
        else: entries.append(Entry(tileid,off,length,1))
        addressed+=1
        if addressed%25000==0: print(f'[pack] {addressed:,} tiles, unique {len(digest_to):,}, data {offset/1e6:.1f} MB, {time.time()-t:.1f}s',flush=True)
    con.close()
    root,leaves=optimize_directories(entries)
    meta_gz=gzip.compress(json.dumps(metadata,separators=(',',':'),ensure_ascii=False).encode('utf-8'),mtime=0)
    header={'root_offset':127,'root_length':len(root),'metadata_offset':127+len(root),'metadata_length':len(meta_gz),'leaf_directory_offset':127+len(root)+len(meta_gz),'leaf_directory_length':len(leaves),'tile_data_offset':127+len(root)+len(meta_gz)+len(leaves),'tile_data_length':offset,'addressed_tiles_count':addressed,'tile_entries_count':len(entries),'tile_contents_count':len(digest_to),'clustered':True,'internal_compression':Compression.GZIP,'tile_compression':Compression.NONE,'tile_type':tile_type,'min_zoom':minz,'max_zoom':maxz,'min_lon_e7':round(bounds[0]*1e7),'min_lat_e7':round(bounds[1]*1e7),'max_lon_e7':round(bounds[2]*1e7),'max_lat_e7':round(bounds[3]*1e7),'center_zoom':center[2],'center_lon_e7':round(center[0]*1e7),'center_lat_e7':round(center[1]*1e7)}
    out_path.parent.mkdir(parents=True,exist_ok=True)
    with out_path.open('wb') as f:
        f.write(serialize_header(header)); f.write(root); f.write(meta_gz); f.write(leaves); tmp.seek(0); shutil.copyfileobj(tmp,f,8*1024*1024)
    tmp.close()
    return header,metadata

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('rar',type=Path); ap.add_argument('output',type=Path)
    ap.add_argument('--name',default='Basemap'); ap.add_argument('--description',default='Raster XYZ basemap packaged as PMTiles v3')
    ap.add_argument('--attribution',default=''); ap.add_argument('--keep-db',action='store_true')
    args=ap.parse_args()
    with tempfile.TemporaryDirectory(prefix='basemap-pmtiles-') as td:
        db=Path(td)/'tiles.sqlite'; count,total,ranges,fmt=stage_rar(args.rar,db)
        print('[stage] done',count,total,fmt,ranges,flush=True)
        header,metadata=write_pmtiles(db,args.output,ranges,fmt,args.name,args.description,args.attribution)
        if args.keep_db: shutil.copy2(db,args.output.with_suffix('.sqlite'))
    print(json.dumps({'output':str(args.output),'size':args.output.stat().st_size,'header':{k:(int(v) if isinstance(v,IntEnum) else v) for k,v in header.items()},'metadata':metadata},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
