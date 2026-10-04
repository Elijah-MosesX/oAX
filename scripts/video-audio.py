"""Align offline narration clips to the exact authoring timeline."""
import json
from pathlib import Path
import wave
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist/product-video'
story = json.loads((ROOT / 'docs/video/storyboard.json').read_text(encoding='utf8'))
output = ROOT / '.tools/openmontage/bacf55796fc6/OpenMontage-main/remotion-composer/public/oax/narration.wav'
with wave.open(str(output), 'wb') as result:
    reference = None
    for i, scene in enumerate(story):
        with wave.open(str(OUT / f'voice-{i+1}.wav'), 'rb') as source:
            signature = (source.getnchannels(), source.getsampwidth(), source.getframerate())
            if reference is None:
                reference = signature
                result.setnchannels(signature[0]); result.setsampwidth(signature[1]); result.setframerate(signature[2])
            if signature != reference:
                raise ValueError('Narration formats differ')
            frames = source.getnframes()
            target = scene['duration'] * signature[2]
            if frames > target:
                raise ValueError(f'Scene {i+1} narration exceeds its duration: {frames/signature[2]:.2f}s')
            result.writeframes(source.readframes(frames))
            result.writeframes(bytes((target-frames)*signature[0]*signature[1]))
            print(f'Scene {i+1}: {frames/signature[2]:.2f}s within {scene["duration"]}s')
