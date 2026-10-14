"""Create four original, seekable Hyperframes compositions for oAX (1080 square)."""
from pathlib import Path
import html
import json
import math
import shutil
import struct
import wave

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "oax-square-videos"
GSAP = ROOT / ".tools/hyperframes-cli/node_modules/gsap/dist/gsap.min.js"
SCREEN = ROOT / "dist/product-video/workspace.png"

FILMS = [
    ("01-understand", "Understand the code", "A symbol is only the start.",
     "See what connects.", ["Selection", "Context", "Callers"],
     "Explain Selection", "Bounded context. Traceable references.",
     "Your cursor stays yours.", "Selected code → graph evidence → explanation.",
     ["export function add(a, b) {", "  return a + b;", "}"],
     "VS Code · TS/JS semantic graph · Codex consent"),
    ("02-refactor", "Make a reviewed change", "A proposed fix is not permission.",
     "You approve the change.", ["Proposal", "Approval", "Review"],
     "Refactor Selection with Codex Preview", "Inspect the diff before approving writes.",
     "Test it. Then review it.", "Request → exact approval → test → diff review.",
     ["− return a - b;", "+ return a + b;", "  // illustrative selected-range fix"],
     "Saved selection · exact plan · separate test approval"),
    ("03-onboarding", "Find your way in", "New repository. Where do you start?",
     "Follow the evidence.", ["Modules", "Symbols", "History"],
     "Onboard Repository", "Inspect structure and local Git history.",
     "One core. Several entry points.", "Index → inspect relationships → trace history.",
     ["node dist/cli.cjs analyze", "node dist/cli.cjs query callers", "  src/math.ts 0 16"],
     "VS Code · CLI · Vim/Neovim read-only queries"),
    ("04-knowledge", "Keep knowledge shared", "Don't lose the why.",
     "Share what you learned.", ["Finding", "Review", "Team"],
     "Shared repository knowledge", "Publish a reviewed finding with its evidence.",
     "Private rooms. Explicit roles.", "Sign in → invite → publish reviewed evidence.",
     ["Finding: add() has two local callers", "Evidence: source + graph snapshot", "Decision: keep the public signature"],
     "Live two-user, voice and screen checks still pending"),
]

CSS = """
*{box-sizing:border-box}body{margin:0;background:#202c42;color:#f2f4f8;font-family:system-ui,sans-serif}
#root{width:100%;height:100%;position:relative;overflow:hidden;background:#202c42}
.clip{position:absolute;inset:0}.content{position:absolute;inset:0;padding:64px}
.brand{font-size:38px;font-weight:800;letter-spacing:-2px}.edition{position:absolute;right:64px;top:76px;font-size:22px;color:#bcc9df}
.rule{height:3px;background:#7394ff;margin-top:28px;transform-origin:left}
.eyebrow{font-size:24px;color:#b8caff;letter-spacing:2px;margin:52px 0 22px;text-transform:uppercase}
h1{font-size:78px;line-height:1.06;letter-spacing:-3px;margin:0;max-width:930px}
h2{font-size:62px;line-height:1.1;letter-spacing:-2px;margin:0;max-width:940px}
.sub{font-size:30px;line-height:1.4;color:#d7dfed;max-width:860px;margin-top:26px}
.code{position:absolute;left:64px;right:64px;top:456px;background:#f2f4f8;color:#243047;padding:40px;border-radius:16px;box-shadow:0 28px 60px #111a2c;font-family:monospace;font-size:29px;line-height:1.9}
.code .label{font-family:system-ui,sans-serif;font-size:22px;line-height:1;margin-bottom:28px;color:#59677d}
.line{white-space:pre-wrap;overflow-wrap:anywhere}.selected{background:#dce6ff;border-radius:5px;padding:0 8px;margin:0 -8px}
.agent{position:absolute;right:40px;bottom:20px;font:22px system-ui,sans-serif;color:#3158cf}.agent b{display:inline-block;width:14px;height:14px;background:#3158cf;border-radius:50%;margin-right:10px}
.foot{position:absolute;left:64px;bottom:58px;right:64px;color:#c3cee0;font-size:23px;line-height:1.45}
.nodes{position:absolute;left:64px;right:64px;top:466px;height:160px;display:flex;align-items:center;justify-content:space-between}
.node{position:relative;z-index:2;width:250px;padding:35px 10px;background:#f2f4f8;color:#243047;border-radius:16px;text-align:center;font-size:32px;font-weight:700;border:3px solid #92abff}
.edge{position:absolute;top:76px;height:5px;background:#92abff;width:100%;transform-origin:left}
.evidence{position:absolute;left:64px;right:64px;top:706px;border-top:2px solid #7394ff;padding-top:28px;font-size:30px;line-height:1.5}
.evidence small{display:block;font-size:23px;color:#c3cee0;margin-top:18px}
.screen{position:absolute;right:64px;top:248px;width:340px;height:610px;overflow:hidden;border-radius:16px;border:3px solid #8ba7ff;background:#f2f4f8;box-shadow:0 30px 60px #111a2c}
.screen img{display:block;width:100%;height:auto}.closing{position:absolute;left:64px;top:285px;width:530px}.closing h2{font-size:61px}.closing p{font-size:29px;line-height:1.4;color:#d7dfed}
.cta{position:absolute;left:64px;bottom:158px;background:#f2f4f8;color:#243047;border-radius:12px;padding:23px 32px;font-size:28px;font-weight:700}
.progress{position:absolute;bottom:0;left:0;right:0;height:7px;background:#91abff;transform-origin:left}
"""


def soundtrack(path):
    """Original restrained plucked triads; no third-party music license dependency."""
    rate = 44100
    chords = [(220, 277.18, 329.63), (196, 246.94, 293.66), (174.61, 220, 261.63), (196, 246.94, 293.66)]
    samples = bytearray()
    for i in range(20 * rate):
        t = i / rate
        chord = chords[int(t / 5) % 4]
        beat = t % .5
        note = chord[int(t * 2) % 3]
        v = .085 * math.sin(2 * math.pi * note * t) * math.exp(-beat * 8)
        v += .035 * math.sin(2 * math.pi * chord[0] / 2 * t)
        v *= min(1, t / .3, (20 - t) / 1.5)
        samples.extend(struct.pack('<h', int(v * 32767)))
    with wave.open(str(path), 'wb') as stream:
        stream.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        stream.writeframes(samples)


def prepare():
    if not GSAP.is_file() or not SCREEN.is_file():
        raise SystemExit("Install pinned GSAP and capture the public oAX landing page first")
    OUT.mkdir(parents=True, exist_ok=True)
    soundtrack(OUT / 'original-score.wav')
    for number, film in enumerate(FILMS, 1):
        slug, title, hook, relationship, nodes, command, detail, ending, flow, code, limitation = film
        destination = OUT / slug
        project = destination / 'composition'
        assets = project / 'assets'
        assets.mkdir(parents=True, exist_ok=True)
        for source, name in [(GSAP, 'gsap.min.js'), (SCREEN, 'workspace.png'), (OUT / 'original-score.wav', 'score.wav')]:
            shutil.copyfile(source, assets / name)
        header = f'<div class="brand">oAX<span style="color:#91abff">.</span></div><div class="edition">FIELD NOTES / 0{number}</div><div class="rule"></div>'
        sections = f'''<section class="clip" id="hook" data-start="0" data-duration="7" data-track-index="1"><div class="content" id="hook-content">{header}
<p class="eyebrow">{html.escape(title)}</p><h1>{html.escape(hook)}</h1>
<div class="code"><div class="label">ILLUSTRATIVE WORKFLOW · SAMPLE CODE / DATA</div>{''.join(f'<div class="line {"selected" if n == 1 else ""}">{html.escape(line)}</div>' for n,line in enumerate(code))}<div class="agent"><b></b>oAX · investigating</div></div>
<div class="foot">{html.escape(limitation)}</div></div></section>
<section class="clip" id="proof" data-start="7" data-duration="7" data-track-index="1"><div class="content" id="proof-content">{header.replace('class="rule"','class="rule second-rule"')}
<p class="eyebrow">From context to action</p><h2>{html.escape(relationship)}</h2><div class="nodes"><div class="edge"></div>{''.join(f'<div class="node">{n}</div>' for n in nodes)}</div>
<div class="evidence">{html.escape(command)}<small>{html.escape(detail)}</small></div><div class="foot">{html.escape(flow)}</div></div></section>
<section class="clip" id="outro" data-start="14" data-duration="6" data-track-index="1"><div class="content" id="outro-content">{header}
<div class="closing"><p class="eyebrow">Built around your code</p><h2>{html.escape(ending)}</h2><p>{html.escape(detail)}</p></div>
<div class="screen"><img src="assets/workspace.png" alt="Actual public oAX shared knowledge landing page"></div><div class="cta">Explore oAX · local + web</div><div class="foot">Actual public app screen · workflow illustrations<br>See the usage guide for supported scope.</div></div></section>'''
        animation = """const tl=gsap.timeline({paused:true});
tl.fromTo('#hook-content .rule',{scaleX:0},{scaleX:1,duration:.7,ease:'power3.out'},0);
tl.fromTo('#hook-content h1',{y:44,opacity:0},{y:0,opacity:1,duration:.7,ease:'power3.out'},.1);
tl.fromTo('.code',{y:110,rotation:2,opacity:0},{y:0,rotation:0,opacity:1,duration:1,ease:'power3.out'},.6);
tl.fromTo('.line',{x:22,opacity:0},{x:0,opacity:1,stagger:.32,duration:.5,ease:'power2.out'},1.4);
tl.fromTo('.agent',{x:80,opacity:0},{x:0,opacity:1,duration:.7,ease:'power2.out'},2.5);
tl.to('.code',{y:-14,duration:3,ease:'sine.inOut'},3.2);
tl.to('#hook-content',{x:-80,opacity:0,duration:.35,ease:'power2.in'},6.65);
tl.fromTo('#proof-content',{x:90,opacity:0},{x:0,opacity:1,duration:.55,ease:'power3.out'},7);
tl.fromTo('.edge',{scaleX:0},{scaleX:1,duration:1.9,ease:'power2.inOut'},7.6);
tl.fromTo('.node',{y:65,opacity:0},{y:0,opacity:1,stagger:.6,duration:.6,ease:'back.out(1.2)'},7.5);
tl.fromTo('.evidence',{y:25,opacity:0},{y:0,opacity:1,duration:.6,ease:'power2.out'},9.5);
tl.to('#proof-content',{y:-55,opacity:0,duration:.35,ease:'power2.in'},13.65);
tl.fromTo('#outro-content',{opacity:0},{opacity:1,duration:.4},14);
tl.fromTo('.screen',{x:90,rotation:3},{x:0,rotation:0,duration:1,ease:'power3.out'},14);
tl.fromTo('.closing',{y:35,opacity:0},{y:0,opacity:1,duration:.7,ease:'power2.out'},14.25);
tl.fromTo('.cta',{x:-35,opacity:0},{x:0,opacity:1,duration:.6,ease:'power2.out'},15);
tl.fromTo('.progress',{scaleX:0},{scaleX:1,duration:20,ease:'none'},0);
window.__timelines['main']=tl;"""
        document = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1080, height=1080"><title>oAX — {html.escape(title)}</title><script src="assets/gsap.min.js"></script><style>{CSS}</style></head><body><div id="root" data-composition-id="main" data-width="1080" data-height="1080" data-start="0" data-duration="20" data-fps="30">{sections}<div class="progress"></div><audio id="score" src="assets/score.wav" data-start="0" data-duration="20" data-track-index="3" data-volume="1"></audio></div><script>{animation}</script></body></html>'''
        (project / 'index.html').write_text(document, encoding='utf8')
        plan = f'''# Brag plan: {title}

oAX helps developers understand code and make reviewed changes.
Angle: {hook} Tone: polished, precise engineering field notes.
Strongest visual: selected code becomes related evidence without taking over the developer cursor.
Real product material: command names from README.md and actual public landing-page screenshot.
User flow: {flow}
Format: 1080 × 1080, 30 fps, 20 seconds. This is the shortest readable four-film series.
Palette: #202c42 / #f2f4f8 / #3158cf; brighter #91abff for contrast on navy. System sans + monospace.
Audio: original local synthesized plucked triads, restrained level, smooth ending. No narration or third-party music.
Audio-reactivity: none; preserve reading stability. No invented beat-detection claim.
Share copy: {flow} oAX keeps evidence and approval visible.

| Time | Story | Motion |
| --- | --- | --- |
| 0–7 | {hook} Sample code/data, clearly labeled illustrative. | Code enters, lines reveal, independent agent marker appears. |
| 7–14 | {relationship} {detail} | Connections draw left to right; three nodes arrive in order. |
| 14–20 | {ending} Actual public app screen. | Screen settles beside headline; readable closing hold. |

Scope: {limitation}. No private content, identities or credentials. No simulated click is presented as acceptance.
'''
        (destination / 'brag-plan.md').write_text(plan, encoding='utf8')
        (destination / 'composition-brief.md').write_text(plan + '\nImplementation: one paused GSAP timeline, timed clips, local assets, Hyperframes 0.8.116. Check and inspect before render.\n', encoding='utf8')
        (destination / 'share-copy.txt').write_text(f'{flow} oAX keeps evidence and approval visible.\n', encoding='utf8')
    print(f'Prepared {len(FILMS)} original compositions in {OUT}')


if __name__ == '__main__':
    prepare()
