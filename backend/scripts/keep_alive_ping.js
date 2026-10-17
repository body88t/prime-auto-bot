const TARGET_URL = process.env.CLOUD_HEALTH_URL || 'https://primeautobot-1480cm0m.b4a.run/health';
const B4A_COOKIE =
  process.env.B4A_SESSION_COOKIE ||
  'connect.sid=s%3A4wI4qDfGabcN_MQxzQQWaeTfPQvDJBqs.H48lW%2B9OSl07XkOOiknoT%2BzbN1t1AW5SwltXHpn%2FXhw';
const SERVICE_ENV_ID = '5db65208-53fd-4bae-8e40-c7e872ef26b8';

async function triggerB4ARedeploy() {
  try {
    const res = await fetch('https://api.containers.back4app.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: B4A_COOKIE,
        Origin: 'https://containers.back4app.com',
        Referer: 'https://containers.back4app.com/',
      },
      body: JSON.stringify({
        query: `mutation { triggerManualDeployment(serviceEnvironmentId: "${SERVICE_ENV_ID}") { id status } }`,
      }),
    });
    const data = await res.json();
    console.log(`[${new Date().toISOString()}] Triggered Back4App Redeploy:`, JSON.stringify(data));
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Redeploy error:`, err.message);
  }
}

async function runKeepAlive() {
  if (process.argv.includes('--redeploy')) {
    await triggerB4ARedeploy();
    return;
  }

  try {
    const res = await fetch(TARGET_URL);
    const text = await res.text();
    console.log(`[${new Date().toISOString()}] Keep-Alive Status: ${res.status} -> ${text}`);

    if (res.status !== 200) {
      console.log(`[${new Date().toISOString()}] Non-200 status (${res.status}), triggering redeploy...`);
      await triggerB4ARedeploy();
      return;
    }

    try {
      const json = JSON.parse(text);
      // Renew container proactively after 48 minutes (2880s) of uptime so 60-min window never expires
      if (json.uptime && json.uptime > 2880) {
        console.log(`[${new Date().toISOString()}] Uptime is ${json.uptime}s (>2880s), proactively renewing deployment...`);
        await triggerB4ARedeploy();
      }
    } catch {}
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Keep-Alive Fetch Error: ${err.message}, triggering redeploy...`);
    await triggerB4ARedeploy();
  }
}

runKeepAlive();
