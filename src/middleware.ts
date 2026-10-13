import { defineMiddleware } from 'astro:middleware';

const PROD_HOST = 'worldradiostations.org';

// One host, one scheme: http:// copies of the server-rendered country and
// listen pages were being indexed alongside the https:// ones. Prerendered
// pages never reach the worker (the asset layer serves them), and at build
// time the URL is already https://, so this only acts on live requests.
export const onRequest = defineMiddleware((context, next) => {
  const url = context.url;
  const isProdHost = url.hostname === PROD_HOST || url.hostname === `www.${PROD_HOST}`;
  if (isProdHost && (url.protocol === 'http:' || url.hostname !== PROD_HOST)) {
    const target = new URL(url);
    target.protocol = 'https:';
    target.hostname = PROD_HOST;
    target.port = '';
    return context.redirect(target.toString(), 301);
  }
  return next();
});
