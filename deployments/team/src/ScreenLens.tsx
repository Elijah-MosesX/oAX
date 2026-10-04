import { useEffect, useRef, useState } from 'react';
import { api, image } from '@appdeploy/client';
import type { PreparedAiImage } from '@appdeploy/client';
import { Voice } from './voice';
type Analysis = {
  summary: string;
  observations: string[];
  suggestions: string[];
  uncertainty: string;
};
export function ScreenLens({
  roomId,
  accessCode,
  onDraft,
}: {
  roomId: string;
  accessCode?: string;
  onDraft: (text: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<PreparedAiImage | null>(null);
  const [approved, setApproved] = useState(false);
  const [question, setQuestion] = useState(
    'Explain the visible problem and suggest what code or logs to inspect next.',
  );
  const [result, setResult] = useState<Analysis | null>(null);
  const [status, setStatus] = useState(
    'Choose a screen, window or tab. Capture stays here until you authorize analysis.',
  );
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  function discard() {
    ++version.current;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setSnapshot(null);
    setResult(null);
    setApproved(false);
    setBusy(false);
    setStatus('Capture discarded. No background screen capture is running.');
  }
  useEffect(
    () => () => {
      ++version.current;
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function capture() {
    discard();
    const run = version.current;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus(
        'Screen capture is unavailable here. Open the app in a supported desktop browser.',
      );
      return;
    }
    setBusy(true);
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      if (run !== version.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const video = document.createElement('video');
      video.srcObject = media;
      video.muted = true;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          video.play(),
          new Promise<never>((_, reject) => {
            deadline = setTimeout(
              () =>
                reject(new Error('Capture timed out. Try a different window.')),
              10000,
            );
          }),
        ]);
        if (run !== version.current) return;
        const scale = Math.min(
          1,
          1280 / Math.max(video.videoWidth, video.videoHeight),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas
          .getContext('2d')!
          .drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error('Could not create snapshot')),
            'image/jpeg',
            0.7,
          ),
        );
        const prepared = await image.resizeIfNeeded(blob, {
          maxDimension: 1280,
          maxPixels: 1500000,
          mimeType: 'image/jpeg',
          quality: 0.65,
        });
        if (prepared.data.length > 512000)
          throw new Error(
            'Image is too detailed. Choose a smaller window and capture again.',
          );
        if (run === version.current) {
          setSnapshot(prepared);
          setStatus(
            'Capture stopped. Inspect this snapshot for private content before analysis.',
          );
        }
      } finally {
        clearTimeout(deadline);
        video.pause();
        video.srcObject = null;
        media.getTracks().forEach((t) => t.stop());
        stream.current = null;
      }
    } catch (error) {
      if (run === version.current)
        setStatus(
          error instanceof Error
            ? error.message
            : 'Capture was cancelled or unavailable.',
        );
    } finally {
      if (run === version.current) setBusy(false);
    }
  }
  async function analyze() {
    if (!snapshot || !approved) return;
    const run = version.current;
    setBusy(true);
    setResult(null);
    setStatus('Analyzing the reviewed snapshot…');
    try {
      const { data } = await api.post(`/api/rooms/${roomId}/vision`, {
        accessCode: accessCode ?? '',
        image: snapshot.data,
        question,
        approved: true,
      });
      if (run === version.current) {
        setResult(data.analysis);
        setStatus(
          'Analysis ready. It is visual evidence, not a verified code diagnosis.',
        );
      }
    } catch (error) {
      if (run === version.current)
        setStatus(
          error instanceof Error
            ? error.message
            : 'Analysis failed. The provider may have received the approved snapshot. You can retry or discard it.',
        );
    } finally {
      if (run === version.current) setBusy(false);
    }
  }
  return (
    <section className="lens">
      <div className="section-title">
        <div>
          <p className="eyebrow">SPATIAL LENS</p>
          <h2>Bring the problem into view</h2>
        </div>
        <span className="badge">One snapshot</span>
      </div>
      <p>
        Capture any application window, browser tab or entire display you
        choose. oAX stops capture after one frame. Hide secrets and unrelated
        windows first.
      </p>
      <div className="toolbar">
        <button onClick={() => void capture()} disabled={busy}>
          Choose screen or window
        </button>
        <button className="secondary" onClick={discard}>
          Discard capture
        </button>
      </div>
      <p role="status">{status}</p>
      {snapshot && (
        <>
          <img
            className="screen-preview"
            src={`data:image/jpeg;base64,${snapshot.data}`}
            alt="Your captured screen for review before transmission"
          />
          <label>
            What should oAX investigate?
            <textarea
              maxLength={1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            I reviewed this image and authorize sending it and my question to
            this app's backend and AppDeploy's AI provider. Usage may consume
            hosting credits. The image is not posted to the room.
          </label>
          <button
            disabled={busy || !approved || !question.trim()}
            onClick={() => void analyze()}
          >
            Analyze reviewed snapshot
          </button>
        </>
      )}
      {result && (
        <article>
          <h3>{result.summary}</h3>
          <h4>Visible observations</h4>
          <ul>
            {result.observations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
          <h4>Suggested investigation</h4>
          <ul>
            {result.suggestions.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
          <p className="notice">{result.uncertainty}</p>
          <button
            className="secondary"
            onClick={() =>
              Voice.speak(
                result.summary + ' ' + result.observations.join('. '),
                setStatus,
              )
            }
          >
            Read analysis aloud
          </button>
          <button
            onClick={() =>
              onDraft(
                [
                  'Visual observation (unverified):',
                  result.summary,
                  ...result.observations,
                  'Suggested next steps:',
                  ...result.suggestions,
                  result.uncertainty,
                ]
                  .join('\n')
                  .slice(0, 8000),
              )
            }
          >
            Use analysis as a draft
          </button>
        </article>
      )}
    </section>
  );
}
