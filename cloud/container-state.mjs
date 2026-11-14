// Print what Cloudflare runs for each container application (no secrets: the
// application config holds the image and sizing; env vars live in the Worker).
const root = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/containers/applications`;
const headers = { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` };
const get = async (path) => {
  const response = await fetch(root + path, { headers });
  const body = await response.json().catch(() => ({}));
  return response.ok && body.success ? body.result : { status: response.status, errors: body.errors };
};
for (const app of await get('')) {
  const { configuration, ...rest } = app;
  console.log(app.name, JSON.stringify({ ...rest, image: configuration?.image }, null, 1));
  console.log('rollouts', JSON.stringify(await get(`/${app.id}/rollouts`), null, 1)?.slice(0, 4000));
  console.log('instances', JSON.stringify(await get(`/${app.id}/instances`), null, 1)?.slice(0, 4000));
}
