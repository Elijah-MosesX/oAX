export function workbenchLink(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    !/^#[a-f0-9]{64}$/.test(url.hash)
  )
    throw new Error(
      'Use the exact http://127.0.0.1:PORT/#single-use-token link from oAX.',
    );
  return url.href;
}
