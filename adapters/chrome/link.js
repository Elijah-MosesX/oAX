export const cloudOrigin = 'https://oax1-7mirgx.v2.appdeploy.ai/';

export function cloudApp() {
  const url = new URL(cloudOrigin);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'oax1-7mirgx.v2.appdeploy.ai' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('oAX1 address is not the deployed evidence desk.');
  return url.href;
}

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
