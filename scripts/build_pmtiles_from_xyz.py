#!/usr/bin/env python3
"""Build PMTiles v3 from an extracted XYZ directory: tiles/{z}/{x}/{y}.png."""
from __future__ import annotations
import argparse, os, sqlite3, tempfile
from pathlib import Path
from build_pmtiles_from_rar import zxy_to_tileid, write_pmtiles

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('tiles_dir',type=Path); ap.add_argument('output',type=Path)
    ap.add_argument('--name',default='Basemap'); ap.add_argument('--description',default='Raster XYZ basemap packaged as PMTiles v3'); ap.add_argument('--attribution',default='')
    a=ap.parse_args(); root=a.tiles_dir
    with tempfile.TemporaryDirectory(prefix='xyz-pmtiles-') as td:
        db=Path(td)/'tiles.sqlite'; con=sqlite3.connect(db)
        con.execute('PRAGMA journal_mode=OFF'); con.execute('PRAGMA synchronous=OFF')
        con.execute('CREATE TABLE tiles(tileid INTEGER PRIMARY KEY,z INTEGER,x INTEGER,y INTEGER,fmt TEXT,data BLOB)')
        ranges={}; formats=set(); count=0
        for p in root.rglob('*'):
            if not p.is_file(): continue
            try:
                rel=p.relative_to(root).as_posix(); parts=rel.split('/')
                if len(parts)!=3: continue
                z=int(parts[0]); x=int(parts[1]); stem,ext=os.path.splitext(parts[2]); y=int(stem); fmt=ext.lower().lstrip('.').replace('jpg','jpeg')
                if fmt not in {'png','jpeg','webp','avif'}: continue
            except Exception: continue
            data=p.read_bytes(); formats.add(fmt); tileid=zxy_to_tileid(z,x,y)
            con.execute('INSERT INTO tiles VALUES(?,?,?,?,?,?)',(tileid,z,x,y,fmt,sqlite3.Binary(data)))
            r=ranges.setdefault(z,[x,x,y,y,0]); r[0]=min(r[0],x);r[1]=max(r[1],x);r[2]=min(r[2],y);r[3]=max(r[3],y);r[4]+=1;count+=1
            if count%10000==0: con.commit(); print(f'{count:,} tiles')
        con.commit(); con.close()
        if not count: raise SystemExit('No z/x/y raster tiles found')
        if len(formats)!=1: raise SystemExit(f'Mixed tile formats: {formats}')
        write_pmtiles(db,a.output,ranges,next(iter(formats)),a.name,a.description,a.attribution)
        print(f'Wrote {a.output} ({a.output.stat().st_size:,} bytes), {count:,} tiles')
if __name__=='__main__': main()
