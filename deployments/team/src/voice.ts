type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
let recognition: Recognition | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
export const Voice = {
  cancel() {
    generation++;
    if (timer) clearTimeout(timer);
    timer = undefined;
    const old = recognition;
    recognition = undefined;
    old?.abort();
    window.speechSynthesis?.cancel();
  },
  stop() {
    recognition?.stop();
  },
  start(
    allowed: boolean,
    draft: (text: string) => void,
    report: (text: string) => void,
  ) {
    if (!allowed) {
      report('Authorize browser speech processing before dictation.');
      return;
    }
    Voice.cancel();
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      report(
        'Speech recognition is unavailable in this browser. Typed input remains available.',
      );
      return;
    }
    const current = ++generation;
    const session = new Constructor();
    recognition = session;
    session.lang = 'en-US';
    session.continuous = false;
    session.interimResults = false;
    session.onresult = (event) => {
      if (current !== generation) return;
      const result = Array.from(event.results)
        .filter((x) => x.isFinal)
        .map((x) => x[0].transcript)
        .join(' ')
        .slice(0, 8000);
      if (result) draft(result);
      report('Transcript is a draft. Review it before publishing.');
    };
    session.onerror = (event) => {
      if (current === generation)
        report(
          `Dictation stopped: ${event.error}. Typed input remains available.`,
        );
    };
    session.onend = () => {
      if (current === generation) {
        recognition = undefined;
        if (timer) clearTimeout(timer);
        timer = undefined;
      }
    };
    try {
      session.start();
      report('Listening. Stop or cancel at any time; maximum 30 seconds.');
      timer = setTimeout(() => {
        if (current === generation) session.stop();
      }, 30000);
    } catch {
      Voice.cancel();
      report('Microphone could not start. Check browser permissions.');
    }
  },
  speak(text: string, report: (text: string) => void) {
    Voice.cancel();
    const voice = window.speechSynthesis
      ?.getVoices()
      .find((v) => v.localService && v.lang.startsWith('en'));
    if (!voice) {
      report(
        'No local English speech voice is available. Text remains readable.',
      );
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 8000));
    utterance.voice = voice;
    utterance.onerror = () =>
      report('Read-aloud could not finish. Text remains readable.');
    window.speechSynthesis.speak(utterance);
    report('Reading aloud with a local voice. Use Stop audio to cancel.');
  },
};
