"""Prepare original oAX visual cards and OpenMontage props; no provider calls."""
import json
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist/product-video'
COMPOSER = ROOT / '.tools/openmontage/bacf55796fc6/OpenMontage-main/remotion-composer'
STORY = json.loads((ROOT / 'docs/video/storyboard.json').read_text(encoding='utf8'))
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC = COMPOSER / 'public/oax'
PUBLIC.mkdir(parents=True, exist_ok=True)


def font(size, bold=False, mono=False):
    name = 'consola.ttf' if mono else ('segoeuib.ttf' if bold else 'segoeui.ttf')
    return ImageFont.truetype(str(Path('C:/Windows/Fonts') / name), size)


cuts = []
time = 0
subtitles = []
for i, scene in enumerate(STORY):
    im = Image.new('RGB', (1920, 1080), '#111d31')
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 18, 1080), fill='#7cb8ff')
    d.text((110, 70), 'oAX', font=font(48, True), fill='white')
    d.text((1520, 94), 'PRODUCT OVERVIEW', font=font(20, mono=True), fill='#99b5d8')
    d.text((110, 215), scene['label'], font=font(25, mono=True), fill='#86baff')
    for j, line in enumerate(scene['title']):
        d.text((105, 280 + j*118), line, font=font(94, True), fill='#f5f8ff')
    y = 575
    for line in scene['body']:
        d.text((114, y), line, font=font(34), fill='#b9c9df')
        y += 64
    if scene.get('screenshot'):
        # Unaltered actual app capture, fitted into a presentation layout.
        shot = Image.open(OUT / 'workspace.png').convert('RGB')
        shot.thumbnail((510, 830))
        x, y = 1370, 160
        im.paste(shot, (x, y))
        d.text((x, 1005), 'ACTUAL DEPLOYED APP', font=font(19, mono=True), fill='#99b5d8')
    elif i == 1:
        d.rounded_rectangle((1200, 265, 1810, 755), radius=20, fill='#1c304a')
        for n, text in enumerate(['// ILLUSTRATIVE FIXTURE', 'function add(a, b) {', '  return a + b;', '}', '', 'caller → add', 'test   → caller']):
            d.text((1240, 300+n*56), text, font=font(30, mono=True), fill='#81c7ff' if n in (1,2,3) else '#c9d9ea')
    elif i == 3:
        d.rounded_rectangle((1350, 280, 1800, 775), radius=20, fill='#1c304a')
        for n, text in enumerate(['PLAN', 'APPROVE', 'EDIT', 'TEST', 'REVIEW']):
            d.text((1400, 316+n*85), text, font=font(36, True), fill='#8dddbb' if n==4 else '#d2e3f9')
    d.line((110, 955, 1810, 955), fill='#29415e', width=3)
    d.line((110, 955, 110+int(1700*(time+scene['duration'])/60), 955), fill='#7cb8ff', width=5)
    d.text((110, 991), 'Workflow overview • supported scope and evidence in PROGRESS.md', font=font(23), fill='#8da7c8')
    d.text((1690, 991), f'{i+1:02d} / 08', font=font(23, mono=True), fill='#8da7c8')
    filename = f'scene-{i+1}.png'
    im.save(OUT / filename)
    shutil.copyfile(OUT / filename, PUBLIC / filename)
    cuts.append({'id':f'oax-{i+1}','source':f'oax/{filename}','in_seconds':time,'out_seconds':time+scene['duration'],'animation':'static'})
    def stamp(t):
        return f'00:{t//60:02d}:{t%60:02d},000'
    subtitles.append(f"{i+1}\n{stamp(time)} --> {stamp(time+scene['duration'])}\n{scene['narration']}\n")
    time += scene['duration']
assert time == 60
(OUT / 'oax-60s.srt').write_text('\n'.join(subtitles), encoding='utf8')
(OUT / 'props.json').write_text(json.dumps({'theme':'clean-professional','cuts':cuts,'overlays':[],'captions':[],'audio':{'narration':{'src':'oax/narration.wav','volume':1}}},indent=2),encoding='utf8')
print('Prepared eight original scenes, 60-second timeline, subtitles and OpenMontage props.')
