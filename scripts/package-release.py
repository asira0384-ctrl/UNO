"""Create a clean GitHub/Railway archive, excluding all local QA and account data."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=set('index.html game.html hub.js hub-ui.js hub.css account.js account.css reversi.js reversi.css shogi.js shogi.css shell.js shell.css viewport.js install.js audio.js cards.js layout.js numerals.js themes.js voice-clips.js variations.js styles.css fonts.css sw.js offline.html offline.css manifest.webmanifest icon.svg credits.html'.split())
DIRECT=set('package.json package-lock.json server.js hub-server.js Dockerfile railway.json README.md SETUP.md ASSETS.md .dockerignore .gitignore'.split())
SRC=set('core.js uno.js boards.js cards-games.js poker.js games.js auth.js accounts.js social.js'.split())
SCRIPTS=set('check.mjs package-release.py make-hub-music.py make-voice-calls.py make-shogi-music.py make-shogi-check.py'.split())
def allowed(rel):
 parts=rel.parts
 if any(p.startswith('qa-') for p in parts):return False
 if len(parts)==1:return parts[0] in DIRECT
 if parts[0]=='src':return len(parts)==2 and parts[1] in SRC
 if parts[0]=='scripts':return len(parts)==2 and parts[1] in SCRIPTS
 if parts[0]=='tests':return len(parts)==2 and parts[1].endswith('.test.js')
 if parts[0]=='public':return len(parts)==2 and parts[1] in PUBLIC or len(parts)==3 and parts[1]=='licenses'
 if parts[0] in ['public1','public2']:return True
 return False
def main():
 files=[p for p in ROOT.rglob('*') if p.is_file() and allowed(p.relative_to(ROOT))]
 counts={r:sum(p.relative_to(ROOT).parts[0]==r for p in files) for r in ['public','public1','public2']}
 assert all(n<90 for n in counts.values()),counts
 assert len([p for p in files if p.relative_to(ROOT).parts[0] not in counts])<90
 for p in files:assert not any(part in ['node_modules','data','.env','.git'] for part in p.relative_to(ROOT).parts)
 target=ROOT.parent/'PARTY-ROOM-v2.2.zip'
 with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(files):z.write(p,p.relative_to(ROOT).as_posix())
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
  assert json.loads(z.read('package.json'))['version']=='2.2.0'
  assert json.loads(z.read('package.json'))['scripts']['dev']=='node --watch hub-server.js'
  assert len([f for f in z.namelist() if f.startswith('public2/assets/audio/voice/') and f.endswith('.mp3')])==40
 print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'files':len(files),'folders':counts,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
if __name__=='__main__':main()
