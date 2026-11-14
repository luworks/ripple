// cf deploy updates the application image; explicitly replace an already-running
// web instance so that a successful CI deployment serves the new image.
const root = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/containers/applications`;
const headers = { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' };
async function api(path, options = {}) {
  const response = await fetch(root + path, { ...options, headers });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(`Cloudflare container API ${response.status}: ${JSON.stringify(body.errors)}`);
  return body.result;
}
const apps = await api('?name=brain0-web');
const app = apps.find((item) => item.name === 'brain0-web');
if (!app?.configuration?.image || app.scheduling_policy !== 'default') throw new Error('Web container application not ready for rollout');
const rollout = await api(`/${app.id}/rollouts`, {
  method: 'POST',
  body: JSON.stringify({ description: 'Deploy current web image', kind: 'full_auto', strategy: 'rolling', step_percentage: 100,
    target_configuration: { image: app.configuration.image, instance_type: 'basic' } }),
});
console.log(`Web rollout started: ${rollout.id}`);
const deadline = Date.now() + 300_000;
while (Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const current = await api(`/${app.id}`);
  if (!current.active_rollout_id) {
    if (current.configuration.image !== app.configuration.image || current.health?.errors?.length) throw new Error('Web rollout did not reach the expected healthy configuration');
    console.log('Web rollout finished');
    process.exit(0);
  }
}
throw new Error('Web rollout did not finish within five minutes');
