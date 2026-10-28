"""Rebuild original vector button and install icons. Dev: fontTools, cairosvg."""
from pathlib import Path
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import cairosvg

ROOT=Path(__file__).resolve().parents[1]/'public'
font=TTFont(os.environ.get('UNO_ICON_FONT','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
glyphs=font.getGlyphSet();cmap=font.getBestCmap()
parts=[];advance=0
for letter in 'UNO!':
    name=cmap[ord(letter)];pen=SVGPathPen(glyphs);glyphs[name].draw(pen)
    parts.append(f'<path d="{pen.getCommands()}" transform="translate({advance} 0)"/>')
    advance+=font['hmtx'][name][0]-75
word='<g transform="translate(0 1600) scale(1 -1)">'+''.join(parts)+'</g>'
logo=f'<svg x="32" y="87" width="172" height="69" viewBox="-90 -90 {advance+190} 1870" overflow="visible"><g paint-order="stroke fill" stroke-linejoin="round" fill="#ffe85a" stroke="#fff9e4" stroke-width="200">{word}</g><g paint-order="stroke fill" stroke-linejoin="round" fill="#ffe85a" stroke="#20212a" stroke-width="92">{word}</g></svg>'
button=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs>
<linearGradient id="base" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".55" stop-color="#eafcff"/><stop offset="1" stop-color="#8ac4e2"/></linearGradient>
<linearGradient id="edge" x2="0" y2="1"><stop stop-color="#f24343"/><stop offset="1" stop-color="#ac1027"/></linearGradient>
<radialGradient id="face" cx=".35" cy=".2" r=".9"><stop stop-color="#ff9a8b"/><stop offset=".38" stop-color="#ff4653"/><stop offset=".85" stop-color="#e61e36"/><stop offset="1" stop-color="#c70e28"/></radialGradient>
<filter id="shadow" x="-.3" y="-.3" width="1.6" height="1.8"><feDropShadow dx="0" dy="7" stdDeviation="4" flood-color="#57331e" flood-opacity=".32"/></filter></defs>
<g filter="url(#shadow)"><ellipse cx="120" cy="158" rx="98" ry="62" fill="#80afc8"/><ellipse cx="120" cy="150" rx="98" ry="65" fill="url(#base)" stroke="#d8f5ff" stroke-width="2"/>
<path d="M34 114v26c0 39 38 65 86 65s86-26 86-65v-26Z" fill="url(#edge)"/>
<ellipse cx="120" cy="115" rx="86" ry="77" fill="url(#face)" stroke="#ff9e9f" stroke-width="3"/>
<path d="M50 89c12-30 39-43 68-43" fill="none" stroke="#ffb5a8" stroke-width="6" stroke-linecap="round" opacity=".65"/>
<g transform="rotate(-16 120 114)"><g fill="none" stroke="#fff1e6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M87 64h14v15H87M110 72h19M138 64v6c0 5-2 9-6 12M145 64v16c5-2 9-5 12-10"/></g>{logo}</g></g></svg>'''
(ROOT/'assets/uno-call.svg').write_text(button)
app=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#2174c2"/><stop offset="1" stop-color="#0c326e"/></linearGradient><radialGradient id="shine" cx=".3" cy=".2"><stop stop-color="#ff7973"/><stop offset="1" stop-color="#d81a35"/></radialGradient></defs><rect width="512" height="512" fill="url(#bg)"/><circle cx="440" cy="80" r="180" fill="#45b9dc" opacity=".14"/><g transform="translate(256 256) rotate(-13)"><rect x="-160" y="-171" width="320" height="362" rx="38" fill="#082552" opacity=".4"/><rect x="-158" y="-187" width="316" height="362" rx="35" fill="#fff5dc"/><rect x="-142" y="-171" width="284" height="330" rx="23" fill="url(#shine)"/><ellipse cy="-5" rx="119" ry="145" fill="#af142e" opacity=".6"/><g transform="translate(-240 -230) scale(2)">{logo}</g><text y="108" text-anchor="middle" fill="#fff2ac" font-family="Arial,sans-serif" font-weight="bold" font-size="25" letter-spacing="8">PARTY</text></g></svg>'''
out=ROOT/'assets/app';out.mkdir(exist_ok=True)
(out/'icon.svg').write_text(app)
for size,name in [(192,'icon-192.png'),(512,'icon-512.png'),(180,'apple-touch-icon.png')]:
    cairosvg.svg2png(bytestring=app.encode(),write_to=str(out/name),output_width=size,output_height=size)
# A dedicated maskable variant leaves all essential artwork inside the safe circle.
mask=app.replace('<g transform="translate(256 256) rotate(-13)">','<g transform="translate(256 256) scale(.76) rotate(-13)">')
cairosvg.svg2png(bytestring=mask.encode(),write_to=str(out/'maskable-512.png'),output_width=512,output_height=512)
print('Built original UNO call button and PNG install icons.')
