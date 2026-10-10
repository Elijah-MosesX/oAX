"""Bake selected posters, decode every delivered frame, and record square-video evidence."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist/oax-square-videos'
encoders = list((ROOT / '.tools/video-python/imageio_ffmpeg/binaries').glob('ffmpeg*.exe'))
if len(encoders) != 1:
    raise SystemExit('Install imageio-ffmpeg==0.6.0 in .tools/video-python')
ffmpeg = encoders[0]
ffprobe = ROOT / '.tools/openmontage/bacf55796fc6/OpenMontage-main/remotion-composer/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'


def run(*args):
    return subprocess.run([str(a) for a in args], check=True, capture_output=True, text=True, timeout=180)


receipts = []
for slug in ['01-understand', '02-refactor', '03-onboarding', '04-knowledge']:
    folder = OUT / slug
    source = folder / 'brag.mp4'
    poster = folder / 'brag.jpg'
    # Scene 1 at 3 seconds is the inspected, settled hook/code composition.
    run(ffmpeg, '-v', 'error', '-ss', '3', '-i', source, '-frames:v', '1', '-y', poster)
    rendered = folder / 'brag.poster.mp4'
    run(ffmpeg, '-v', 'error', '-i', source, '-i', poster,
        '-filter_complex', "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",
        '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '18',
        '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'copy',
        '-movflags', '+faststart', '-y', rendered)
    data = json.loads(run(ffprobe, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', rendered).stdout)
    video = next(s for s in data['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in data['streams'] if s['codec_type'] == 'audio')
    assert (video['width'], video['height']) == (1080, 1080)
    assert video['r_frame_rate'] == '30/1' and int(video['nb_frames']) == 600
    assert abs(float(video['duration']) - 20) < .04
    assert video['codec_name'] == 'h264' and audio['codec_name'] == 'aac'
    run(ffmpeg, '-v', 'error', '-i', rendered, '-f', 'null', '-')
    rendered.replace(source)
    receipts.append({'file': str(source.relative_to(ROOT)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                     'width': 1080, 'height': 1080, 'fps': 30, 'frames': 600, 'seconds': 20,
                     'audio': 'original score / AAC', 'decode': 'passed', 'posterTime': 3})
(OUT / 'verification.json').write_text(json.dumps(receipts, indent=2) + '\n', encoding='utf8')
print(json.dumps(receipts, indent=2))
