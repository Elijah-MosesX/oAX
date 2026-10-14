import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { api, auth, invitesClient, ws } from '@appdeploy/client';
import type { AuthUser, WsConnection } from '@appdeploy/client';
import { parseEvidence } from '../shared/validate';
import { Voice } from './voice';
import { ScreenLens } from './ScreenLens';

type RoomRef = {
  roomId: string;
  repository: string;
  role: string;
  accessCode?: string;
};
type Entry = {
  id: string;
  title?: string;
  text?: string;
  kind?: string;
  path?: string;
  author?: string;
  authorName?: string;
  createdAt: string;
  retracted?: boolean;
  evidence?: ReturnType<typeof parseEvidence>;
};
export default function Workspace() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rooms, setRooms] = useState<RoomRef[]>([]);
  const [roomsNext, setRoomsNext] = useState<string | undefined>();
  const [page, setPage] = useState(window.location.hash);
  const [room, setRoom] = useState<RoomRef | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [status, setStatus] = useState(
    'Sign in to create or join a private repository room.',
  );
  const [connection, setConnection] = useState('Disconnected');
  const [pending, setPending] = useState(
    () => invitesClient.getPendingCode() ?? '',
  );
  const [inviteStatus, setInviteStatus] = useState('');
  const [invite, setInvite] = useState('');
  const [invitationRows, setInvitationRows] = useState<
    { code: string; email: string; role: string }[]
  >([]);
  const [invitationsNext, setInvitationsNext] = useState<string | undefined>();
  const [signingIn, setSigningIn] = useState(false);
  const [repository, setRepository] = useState('');
  const [kind, setKind] = useState('finding');
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [reference, setReference] = useState('');
  const [evidence, setEvidence] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('reader');
  const [token, setToken] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState('knowledge');
  const [search, setSearch] = useState('');
  const current = useRef<RoomRef | null>(null);
  const socket = useRef<WsConnection | null>(null);
  const generation = useRef(0);
  const fetchGeneration = useRef(0);
  const identityGeneration = useRef(0);
  const subscription = useRef<{ roomId: string; id: string } | null>(null);
  const payload = (r: RoomRef) => ({ accessCode: r.accessCode ?? '' });
  const fail = (error: unknown) =>
    setStatus(
      error instanceof Error
        ? error.message
        : 'Operation failed. Please retry.',
    );
  async function loadRooms(nextPage?: string) {
    const identity = identityGeneration.current;
    const { data } = await api.get(
      '/api/rooms',
      nextPage ? { next: nextPage } : {},
    );
    if (identity !== identityGeneration.current) return;
    setRooms((old) => (nextPage ? [...old, ...data.items] : data.items));
    setRoomsNext(data.nextToken);
  }
  async function refresh(r: RoomRef, page?: string) {
    const request = ++fetchGeneration.current;
    try {
      const { data } = await api.post(`/api/rooms/${r.roomId}/read`, {
        ...payload(r),
        ...(page ? { next: page } : {}),
      });
      if (
        current.current?.roomId !== r.roomId ||
        request !== fetchGeneration.current
      )
        return;
      setRoom({ ...r, role: data.role });
      setEntries((old) =>
        page
          ? [
              ...old,
              ...data.entries.items.filter(
                (item: Entry) => !old.some((x) => x.id === item.id),
              ),
            ]
          : data.entries.items,
      );
      setNext(data.entries.nextToken);
    } catch (error) {
      if (
        current.current?.roomId === r.roomId &&
        request === fetchGeneration.current
      ) {
        setEntries([]);
        setNext(undefined);
        fail(error);
      }
    }
  }
  async function unsubscribe() {
    const old = subscription.current;
    subscription.current = null;
    if (old)
      await api
        .post(`/api/rooms/${old.roomId}/unsubscribe`, {
          subscriptionId: old.id,
        })
        .catch(() => {});
  }
  async function subscribe(r: RoomRef, conn: WsConnection, version: number) {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        conn.ready,
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () =>
              reject(
                new Error(
                  'Live updates could not connect. Your saved knowledge is still available through Refresh.',
                ),
              ),
            12000,
          );
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
    if (version !== generation.current || !conn.connectionId) return;
    await unsubscribe();
    const { data } = await api.post(`/api/rooms/${r.roomId}/subscribe`, {
      ...payload(r),
      entity_type: 'room',
      entity_id: r.roomId,
      connection_id: conn.connectionId,
    });
    if (version !== generation.current) {
      await api.post(`/api/rooms/${r.roomId}/unsubscribe`, {
        subscriptionId: data.id,
      });
      return;
    }
    subscription.current = { roomId: r.roomId, id: data.id };
    setConnection('Live updates connected');
    await refresh(r); // Close the initial-load/subscribe race.
  }
  async function openRoom(r: RoomRef) {
    Voice.cancel();
    setPanel('knowledge');
    setSearch('');
    setDraft('');
    setEvidence('');
    setToken('');
    setConsent(false);
    setInvite('');
    setInvitationRows([]);
    setInvitationsNext(undefined);
    const version = ++generation.current;
    current.current = r;
    setRoom(r);
    setEntries([]);
    setNext(undefined);
    await unsubscribe();
    await refresh(r);
    if (socket.current)
      await subscribe(r, socket.current, version).catch(() =>
        setConnection('Live updates unavailable; use Refresh or reconnect'),
      );
  }
  async function loadInvitations(r: RoomRef, nextPage?: string) {
    const { data } = await api.post(`/api/rooms/${r.roomId}/invitations`, {
      ...payload(r),
      ...(nextPage ? { next: nextPage } : {}),
    });
    if (current.current?.roomId !== r.roomId) return;
    setInvitationRows((old) =>
      nextPage ? [...old, ...data.items] : data.items,
    );
    setInvitationsNext(data.nextToken);
  }
  useEffect(() => {
    const identity = identityGeneration.current;
    auth
      .getUser()
      .then((value) => {
        if (identity === identityGeneration.current) setUser(value);
      })
      .catch(fail);
    return () => Voice.cancel();
  }, []);
  useEffect(() => {
    const changed = () => {
      Voice.cancel();
      setPage(window.location.hash);
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    if (!pending) {
      setInviteStatus('');
      return;
    }
    let active = true;
    api
      .get(`/api/invites/${encodeURIComponent(pending)}`)
      .then(({ data }) => {
        if (active)
          setInviteStatus(
            `Invitation ${data.status}; sign-in and matching identity required.`,
          );
      })
      .catch(() => {
        if (active)
          setInviteStatus(
            'Invitation unavailable. Ask the owner for a new link.',
          );
      });
    return () => {
      active = false;
    };
  }, [pending]);
  useEffect(() => {
    if (!user) return;
    void loadRooms().catch(fail);
    const conn = ws.connect();
    socket.current = conn;
    conn.onMessage((message) => {
      const r = current.current;
      if (
        r &&
        message.type === 'entity.update' &&
        message.payload?.entity_type === 'room' &&
        message.payload.entity_id === r.roomId
      )
        void refresh(r);
    });
    conn.onClose(() =>
      setConnection('Live updates disconnected; reconnect to refresh'),
    );
    conn.onError(() =>
      setConnection('Live updates unavailable; use Refresh or reconnect'),
    );
    conn.onOpen(() => {
      if (current.current)
        void subscribe(current.current, conn, ++generation.current).catch(fail);
    });
    conn.ready.catch(fail);
    // Renew the bounded subscription lease, not a data polling loop.
    const lease = setInterval(() => {
      if (current.current)
        void subscribe(current.current, conn, ++generation.current).catch(fail);
    }, 3000000);
    return () => {
      clearInterval(lease);
      ++generation.current;
      void unsubscribe();
      conn.disconnect();
      socket.current = null;
    };
  }, [user?.userId]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    Voice.cancel();
    ++identityGeneration.current;
    await unsubscribe();
    ++generation.current;
    ++fetchGeneration.current;
    current.current = null;
    setRoom(null);
    setRooms([]);
    setEntries([]);
    setDraft('');
    setEvidence('');
    setToken('');
    setInvite('');
    setInvitationRows([]);
    setInvitationsNext(undefined);
    await auth.signOut();
    setUser(null);
    setStatus('Signed out. Private content cleared.');
  }
  const legal = page;
  if (legal === '#/terms' || legal === '#/privacy')
    return <Legal privacy={legal === '#/privacy'} />;
  return (
    <div className={`shell ${user ? 'signed-in' : 'signed-out'}`}>
      <header>
        <a className="brand" href="#/">
          oAX <span>REPOSITORY WORKSPACE</span>
        </a>
        <div>
          {user ? (
            <>
              <span>{user.email ?? user.name ?? 'Signed in'}</span>
              <button onClick={() => void action(signOut)}>Sign out</button>
            </>
          ) : (
            <button
              disabled={signingIn}
              onClick={() =>
                void action(async () => {
                  setSigningIn(true);
                  ++identityGeneration.current;
                  setStatus(
                    'Complete sign-in in the popup. If no popup appears, open this app in Chrome or Edge and allow its sign-in popup.',
                  );
                  try {
                    const result = await auth.signIn();
                    setUser(result.user);
                    setStatus('Signed in. Create or join a repository room.');
                  } finally {
                    setSigningIn(false);
                  }
                })
              }
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">CODE · CONTEXT · PEOPLE</p>
          <h1>
            {user
              ? 'Your team’s working knowledge'
              : 'Keep the context. Move the work forward.'}
          </h1>
          <p>
            A place for the findings, questions and decisions behind your code.
            Bring evidence from your editor. Investigate what is on screen.
            Share what the next person needs to know.
          </p>
          <p className="status" role="status">
            {status}
          </p>
        </section>
        {!user && (
          <section className="start-guide">
            <div className="guide-title">
              <span className="badge">LOCAL TO SHARED</span>
              <h2>
                Start in your code.
                <br />
                Keep everyone in context.
              </h2>
              <p>Private by default. Deliberate when shared.</p>
            </div>
            <ol>
              <li>
                <strong>Understand a change</strong>
                <span>
                  Use the local IDE or CLI to inspect a symbol, its callers and
                  its history.
                </span>
              </li>
              <li>
                <strong>Bring the evidence</strong>
                <span>
                  Create a repository room. Publish a reviewed finding or
                  captured ContextSlice.
                </span>
              </li>
              <li>
                <strong>Make it useful to the team</strong>
                <span>
                  Invite readers and contributors. Discuss decisions without
                  sharing machine credentials.
                </span>
              </li>
            </ol>
            <p className="guide-boundary">
              Rooms share only content you explicitly publish. This service does
              not clone repositories, execute code, or share your local
              approvals.
            </p>
          </section>
        )}
        {pending && (
          <section>
            <h2>Join an invitation</h2>
            <p>{inviteStatus}</p>
            <button
              disabled={!user || busy}
              onClick={() =>
                void action(async () => {
                  const { data } = await api.post(
                    `/api/invites/${encodeURIComponent(pending)}/join`,
                    {},
                  );
                  invitesClient.clearPendingCode();
                  setPending('');
                  await loadRooms();
                  await openRoom(data);
                  setStatus(
                    'Joined. Access expires with the invitation and can be revoked by its owner.',
                  );
                })
              }
            >
              Join room
            </button>
            <button
              onClick={() => {
                invitesClient.clearPendingCode();
                setPending('');
              }}
            >
              Dismiss invitation
            </button>
          </section>
        )}
        {user && (
          <div className="layout">
            <aside>
              <h2>Your repositories</h2>
              {rooms.map((r, i) => (
                <button
                  className={`room ${room?.roomId === r.roomId ? 'selected' : ''}`}
                  key={`${r.roomId}-${i}`}
                  disabled={busy}
                  onClick={() => void action(() => openRoom(r))}
                >
                  {r.repository}
                  <small>{r.role}</small>
                </button>
              ))}
              {roomsNext && (
                <button
                  disabled={busy}
                  onClick={() => void action(() => loadRooms(roomsNext))}
                >
                  Load more rooms
                </button>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    const { data } = await api.post('/api/rooms', {
                      repository,
                    });
                    const r = {
                      roomId: data.id,
                      repository: data.repository,
                      role: 'owner',
                    };
                    await loadRooms();
                    await openRoom(r);
                    setStatus(`Room created. Save its ID: ${data.id}`);
                  });
                }}
              >
                <label>
                  GitHub repository
                  <input
                    required
                    maxLength={200}
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    placeholder="owner/repository"
                  />
                </label>
                <button disabled={busy}>Create private room</button>
              </form>
              <p>
                A room label does not grant GitHub access. Invitations authorize
                shared knowledge only.
              </p>
            </aside>
            <div>
              {room ? (
                <>
                  <section>
                    <div className="heading">
                      <div>
                        <p className="eyebrow">{room.role.toUpperCase()}</p>
                        <h2>{room.repository}</h2>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => void action(() => refresh(room))}
                      >
                        Refresh
                      </button>
                    </div>
                    <p className="connection">
                      <span
                        className={
                          connection === 'Live updates connected'
                            ? 'signal live'
                            : 'signal'
                        }
                      />{' '}
                      {connection}
                    </p>
                    <p className="mono">Room ID: {room.roomId}</p>
                    <button
                      onClick={() =>
                        void action(async () => {
                          if (socket.current)
                            await subscribe(
                              room,
                              socket.current,
                              ++generation.current,
                            );
                        })
                      }
                    >
                      Reconnect subscription
                    </button>
                  </section>
                  <nav className="workspace-tabs" aria-label="Repository views">
                    {['knowledge', 'capture', 'access', 'github']
                      .filter((v) => v !== 'access' || room.role === 'owner')
                      .map((v) => (
                        <button
                          key={v}
                          aria-current={panel === v ? 'page' : undefined}
                          onClick={() => {
                            Voice.cancel();
                            setPanel(v);
                          }}
                        >
                          {
                            {
                              knowledge: 'Knowledge',
                              capture: 'Screen lens',
                              access: 'Team access',
                              github: 'GitHub connection',
                            }[v]
                          }
                        </button>
                      ))}
                  </nav>
                  {panel === 'capture' && (
                    <ScreenLens
                      key={room.roomId}
                      roomId={room.roomId}
                      accessCode={room.accessCode}
                      onDraft={(text) => {
                        setDraft(text);
                        setPanel('knowledge');
                        setConsent(false);
                        setStatus(
                          'Visual analysis added to your draft. Review it before publishing.',
                        );
                      }}
                    />
                  )}
                  {panel === 'access' && room.role === 'owner' && (
                    <section>
                      <h2>Invite a teammate</h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void action(async () => {
                            const { data } = await api.post(
                              `/api/rooms/${room.roomId}/invites`,
                              { ...payload(room), email, role },
                            );
                            setInvite(data.code);
                            await loadInvitations(room);
                            setStatus(
                              'Invitation created for the specified identity, valid for 24 hours. Share it yourself.',
                            );
                          });
                        }}
                      >
                        <label>
                          Teammate email
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </label>
                        <label>
                          Access
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                          >
                            <option value="reader">Reader</option>
                            <option value="contributor">Contributor</option>
                          </select>
                        </label>
                        <button disabled={busy}>Create invitation</button>
                      </form>
                      <button
                        disabled={busy}
                        onClick={() => void action(() => loadInvitations(room))}
                      >
                        Manage saved invitations
                      </button>
                      {invitationRows.map((item) => (
                        <div key={item.code}>
                          <span>
                            {item.email} · {item.role}
                          </span>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action(async () => {
                                await api.post(
                                  `/api/invites/${encodeURIComponent(item.code)}/revoke`,
                                  {},
                                );
                                setStatus(
                                  'Invitation revoked. The saved record is retained; it grants no access.',
                                );
                                if (invite === item.code) setInvite('');
                              })
                            }
                          >
                            Revoke access for {item.email}
                          </button>
                        </div>
                      ))}
                      {invitationsNext && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(() =>
                              loadInvitations(room, invitationsNext),
                            )
                          }
                        >
                          More invitations
                        </button>
                      )}
                      {invite && (
                        <>
                          <label>
                            Invitation link
                            <input
                              readOnly
                              value={invitesClient.buildJoinUrl(invite, {
                                path: '#/join',
                              })}
                            />
                          </label>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action(async () => {
                                await api.post(
                                  `/api/invites/${encodeURIComponent(invite)}/revoke`,
                                  {},
                                );
                                setInvite('');
                                setStatus(
                                  'Invitation revoked. It can no longer authorize reads or writes.',
                                );
                              })
                            }
                          >
                            Revoke this invitation
                          </button>
                        </>
                      )}
                    </section>
                  )}
                  {panel === 'knowledge' && (
                    <>
                      <section className="composer">
                        <h2>Publish reviewed knowledge</h2>
                        {room.role === 'reader' ? (
                          <p>Your reader invitation allows viewing only.</p>
                        ) : (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void action(async () => {
                                if (!consent)
                                  throw new Error(
                                    'Confirm the sharing scope first.',
                                  );
                                if (evidence) parseEvidence(evidence);
                                const { data } = await api.post(
                                  `/api/rooms/${room.roomId}/entries`,
                                  {
                                    ...payload(room),
                                    kind,
                                    title,
                                    text: draft,
                                    path: reference,
                                    evidence,
                                  },
                                );
                                setDraft('');
                                setTitle('');
                                setEvidence('');
                                setConsent(false);
                                await refresh(room);
                                setStatus(
                                  data.realtime
                                    ? 'Published to this room.'
                                    : 'Saved. Live notification delivery is unavailable; teammates can refresh. Do not republish.',
                                );
                              });
                            }}
                          >
                            <label>
                              Entry type
                              <select
                                value={kind}
                                onChange={(e) => setKind(e.target.value)}
                              >
                                <option value="finding">Finding</option>
                                <option value="question">Question</option>
                                <option value="decision">Decision</option>
                              </select>
                            </label>
                            <label>
                              Title
                              <input
                                required
                                maxLength={160}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                              />
                            </label>
                            <label>
                              Finding or question
                              <textarea
                                required
                                maxLength={8000}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                              />
                            </label>
                            <VoiceControls
                              draft={draft}
                              setDraft={setDraft}
                              report={setStatus}
                            />
                            <label>
                              Workspace-relative code reference
                              <input
                                maxLength={512}
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="src/example.ts"
                              />
                            </label>
                            <label>
                              Optional oAX ContextSlice export
                              <textarea
                                value={evidence}
                                maxLength={196608}
                                onChange={(e) => setEvidence(e.target.value)}
                                placeholder="Paste the reviewed oax-evidence.v1 JSON export"
                              />
                            </label>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                              />{' '}
                              I reviewed this content and authorize sharing it
                              with this room's current and future invitees. It
                              contains no credentials.
                            </label>
                            <button disabled={busy || !consent}>
                              Publish to room
                            </button>
                          </form>
                        )}
                      </section>
                      <section>
                        <div className="section-title">
                          <h2>Shared knowledge</h2>
                          <span className="badge">
                            {entries.filter((e) => !e.retracted).length} on this
                            page
                          </span>
                        </div>
                        <label className="search-label">
                          Find in loaded entries
                          <input
                            type="search"
                            placeholder="Search findings, paths or decisions"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                        <p>
                          Contributions are attributed evidence, not
                          instructions or permission grants. Concurrent
                          contributions are separate entries.
                        </p>
                        {entries.length === 0 && (
                          <p>No published entries on this page.</p>
                        )}
                        {entries
                          .filter(
                            (entry) =>
                              !search.trim() ||
                              [
                                entry.title,
                                entry.text,
                                entry.path,
                                entry.authorName,
                              ]
                                .join(' ')
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                          )
                          .map((entry) => (
                            <article key={entry.id}>
                              {entry.retracted ? (
                                <p>Entry retracted · {entry.createdAt}</p>
                              ) : (
                                <>
                                  <p className="eyebrow">
                                    {entry.kind} · {entry.authorName} ·{' '}
                                    {new Date(entry.createdAt).toLocaleString()}
                                  </p>
                                  <h3>{entry.title}</h3>
                                  <p className="prose">{entry.text}</p>
                                  {entry.path && (
                                    <p className="mono">{entry.path}</p>
                                  )}
                                  {entry.evidence && (
                                    <details>
                                      <summary>
                                        Inspect spatial context and provenance
                                      </summary>
                                      <p>
                                        {entry.evidence.context.path} · document
                                        v
                                        {entry.evidence.context.documentVersion}{' '}
                                        ·{' '}
                                        {entry.evidence.context.dirty
                                          ? 'unsaved snapshot'
                                          : 'saved snapshot'}{' '}
                                        · captured {entry.evidence.capturedAt}
                                      </p>
                                      <p>
                                        Range{' '}
                                        {JSON.stringify(
                                          entry.evidence.context.range,
                                        )}
                                        . Historical snapshot; not verified
                                        against your current checkout.
                                      </p>
                                      <pre>
                                        {entry.evidence.context.excerpt}
                                      </pre>
                                      <pre>
                                        {JSON.stringify(
                                          entry.evidence.context.related ?? [],
                                          null,
                                          2,
                                        )}
                                      </pre>
                                      <h4>Historical evidence</h4>
                                      <pre>
                                        {JSON.stringify(
                                          entry.evidence.context.historical ??
                                            [],
                                          null,
                                          2,
                                        )}
                                      </pre>
                                      <h4>Reviewed source-linked notes</h4>
                                      <p>
                                        Untrusted claims from the exported
                                        snapshot. Eligibility dates and source
                                        hashes are shown below; this service
                                        does not recheck your checkout or
                                        authorize actions.
                                      </p>
                                      <pre>
                                        {JSON.stringify(
                                          entry.evidence.context.memory ?? [],
                                          null,
                                          2,
                                        )}
                                      </pre>
                                      <h4>Context limitations</h4>
                                      <pre>
                                        {JSON.stringify(
                                          entry.evidence.context.limitations ??
                                            [],
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </details>
                                  )}
                                  <button
                                    onClick={() =>
                                      Voice.speak(
                                        `${entry.title}. ${entry.text}`,
                                        setStatus,
                                      )
                                    }
                                  >
                                    Read aloud locally
                                  </button>
                                  {(room.role === 'owner' ||
                                    entry.author === user.userId) && (
                                    <button
                                      disabled={busy}
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            'Retract this entry from the shared room? Previously downloaded copies cannot be recalled.',
                                          )
                                        )
                                          void action(async () => {
                                            await api.post(
                                              `/api/rooms/${room.roomId}/entries/${entry.id}/retract`,
                                              payload(room),
                                            );
                                            await refresh(room);
                                            setStatus('Entry retracted.');
                                          });
                                      }}
                                    >
                                      Retract entry
                                    </button>
                                  )}
                                </>
                              )}
                            </article>
                          ))}
                        {next && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action(() => refresh(room, next))
                            }
                          >
                            Load more entries
                          </button>
                        )}
                      </section>
                    </>
                  )}
                  {panel === 'github' && (
                    <section>
                      <h2>Verify your GitHub access</h2>
                      <p>
                        Optional read-only check for {room.repository}. The
                        token travels over HTTPS to this app's backend and then
                        GitHub. It is used for this request only and is not
                        stored or shared with room members. Use a fine-grained
                        token restricted to this repository with Metadata read
                        permission.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void action(async () => {
                            const supplied = token;
                            setToken('');
                            const { data } = await api.post(
                              `/api/rooms/${room.roomId}/github`,
                              { ...payload(room), token: supplied },
                            );
                            setStatus(
                              `GitHub verified ${data.repository} (${data.private ? 'private' : 'public'}), branch ${data.defaultBranch}. Credential not retained.`,
                            );
                          });
                        }}
                      >
                        <label>
                          Repository-scoped GitHub token
                          <input
                            type="password"
                            autoComplete="off"
                            required
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                          />
                        </label>
                        <button disabled={busy}>
                          Authorize metadata check
                        </button>
                      </form>
                    </section>
                  )}
                </>
              ) : (
                <section>
                  <h2>Choose a repository room</h2>
                  <p>
                    Create a room or follow an invitation link from its owner.
                    Developers, project managers and new teammates can share
                    findings without sharing machine credentials.
                  </p>
                  <div className="empty-route">
                    <span>Repository</span>
                    <span>Reviewed evidence</span>
                    <span>Shared understanding</span>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
      <footer>
        <a href="#/terms">Terms</a>
        <a href="#/privacy">Privacy</a>
        <a href="https://github.com/Elijah-MosesX/oAX/tree/codex/local-intelligence-preview">
          Install local oAX
        </a>
        <button onClick={() => Voice.cancel()}>Stop audio</button>
        <p>
          Hosted knowledge collaboration · local agent execution remains in your
          IDE/CLI. No shared edit authorization.
        </p>
      </footer>
    </div>
  );
}
function VoiceControls({
  setDraft,
  report,
}: {
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  report: (v: string) => void;
}) {
  const [allowed, setAllowed] = useState(false);
  return (
    <fieldset>
      <legend>Optional voice draft</legend>
      <p>
        Your browser may send microphone audio to its speech-recognition
        provider. oAX receives text only. Review it before publishing.
        Availability depends on your browser.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={allowed}
          onChange={(e) => {
            setAllowed(e.target.checked);
            if (!e.target.checked) Voice.cancel();
          }}
        />{' '}
        Allow browser speech recognition for this interaction
      </label>
      <button
        type="button"
        disabled={!allowed}
        onClick={() =>
          Voice.start(
            allowed,
            (text) =>
              setDraft((old) => (old + ' ' + text).trim().slice(0, 8000)),
            report,
          )
        }
      >
        Start dictation
      </button>
      <button type="button" onClick={() => Voice.stop()}>
        Stop dictation
      </button>
      <button type="button" onClick={() => Voice.cancel()}>
        Cancel audio
      </button>
    </fieldset>
  );
}
function Legal({ privacy }: { privacy: boolean }) {
  return (
    <main className="legal">
      <a href="#/">Return to oAX</a>
      <h1>{privacy ? 'Privacy notice' : 'Terms of use'}</h1>
      <p>
        Effective draft: 3 October 2026. This describes the current oAX
        development service; operator contact and jurisdiction details remain to
        be finalized before general availability.
      </p>
      {privacy ? (
        <>
          <h2>What this service processes</h2>
          <p>
            AppDeploy handles sign-in identity. The backend stores room
            repository labels, owner IDs, invitation access references,
            attributed contributions, optional code-context exports, and
            temporary socket subscriptions. GitHub tokens are used only for the
            explicitly requested metadata check and are not saved by application
            code. Hosting and identity providers may maintain their own
            operational logs.
          </p>
          <h2>Your sharing choices</h2>
          <p>
            Only publish content you are authorized to share. Current and future
            invited room users can read published contributions. Shared entries
            are untrusted content and cannot grant local execution permissions.
            Retracting an entry removes its body and evidence from the active
            record, while retaining authorship/time and a retraction marker.
            Copies already received by another user cannot be recalled. Provider
            backup/log retention is governed separately; this preview does not
            promise immediate deletion from backups.
          </p>
          <h2>Voice and local tools</h2>
          <p>
            Dictation starts only after an explicit choice and browser
            permission. Your browser's recognition provider may receive audio;
            no audio is uploaded to the oAX backend. Transcripts remain drafts
            until you publish. Read-aloud uses voices reported by the browser as
            local. The local IDE/runtime has its own workspace and
            provider-consent controls; this hosted service does not
            automatically read your local files.
          </p>
          <p>
            Screen lens captures one browser-approved screen, window or tab and
            stops the stream. The snapshot remains in this view until you
            separately authorize sending it and your question to this backend
            and AppDeploy's AI provider. Application code does not save the
            image or analysis; provider processing/retention applies. You may
            copy analysis into a reviewed draft and explicitly publish its text.
            Screen analysis is untrusted visual interpretation, not verified
            repository evidence.
          </p>
          <h2>Storage and contact</h2>
          <p>
            Authentication storage is managed by the platform SDK. Application
            code does not persist drafts or source in browser storage. Shared
            knowledge persists until retracted; automatic
            retention/account-deletion tooling is not yet available. Raise
            private data-access or deletion requests with the repository owner
            through the channel used to arrange access. Do not post credentials
            or private source in public issues.
          </p>
        </>
      ) : (
        <>
          <h2>Purpose and supported use</h2>
          <p>
            oAX helps people understand code and collaborate around evidence.
            The hosted service provides repository knowledge rooms; local
            IDE/CLI tools separately provide code analysis and authorized agent
            workflows. Availability is limited to documented implementations.
            Universal IDE compatibility, comprehensive correctness, and
            uninterrupted operation are not promised.
          </p>
          <h2>Your responsibilities</h2>
          <p>
            Use only repositories and content you have permission to access and
            share. Do not publish credentials, unauthorized personal data or
            confidential information without the required consent. Review agent
            output, code changes and test results. Room membership does not
            grant GitHub rights, permission to run commands on another machine,
            or ownership of another person's work.
          </p>
          <h2>Access and content</h2>
          <p>
            Room owners choose invitees and reader/contributor access.
            Invitations expire and can be revoked. Contributions remain
            attributed to their authors; you retain your rights and authorize
            this service to store and show content to your selected room
            participants. Do not rely on a retraction to remove copies already
            received by others.
          </p>
          <h2>Development-service limits</h2>
          <p>
            This is development software with documented security and
            compatibility limitations. Keep independent backups and avoid
            depending on it as the sole source of project records. Service
            behavior and terms may change as features mature. Open-source code
            retains its MIT license; these service terms do not replace
            third-party provider terms. Operator/legal contact and support
            commitments must be established before a supported public release.
          </p>
        </>
      )}
      <p>
        <a href="https://github.com/Elijah-MosesX/oAX">Project repository</a>
      </p>
    </main>
  );
}
