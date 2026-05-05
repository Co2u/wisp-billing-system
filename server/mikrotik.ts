import { RouterOSAPI } from 'node-routeros';
import db from './db.ts';

async function getRouterConnection(routerId: number) {
  const router = db.prepare('SELECT * FROM mikrotik_routers WHERE id = ?').get(routerId) as any;
  if (!router) throw new Error('Router not found');

  const conn = new RouterOSAPI({
    host: router.host,
    user: router.username,
    password: router.password,
    port: router.port,
    timeout: 30,
  });

  await conn.connect();
  return conn;
}

export async function getRouterStatus(routerId: number): Promise<any> {
  const router = db.prepare('SELECT * FROM mikrotik_routers WHERE id = ?').get(routerId) as any;
  if (!router) return { connected: false };

  try {
    const conn = new RouterOSAPI({
      host: router.host,
      user: router.username,
      password: router.password,
      port: router.port,
      timeout: 3,
    });

    await conn.connect();
    const resources = await conn.write('/system/resource/print');
    conn.close();

    if (resources && resources.length > 0) {
      const res = resources[0];
      return {
        connected: true,
        cpuLoad: res['cpu-load'],
        freeMemory: parseInt(res['free-memory'], 10),
        totalMemory: parseInt(res['total-memory'], 10),
        uptime: res.uptime,
        version: res.version,
        boardName: res['board-name'],
      };
    }
    return { connected: true };
  } catch {
    return { connected: false };
  }
}

export async function addPlanToMikrotik(
  plan: { name: string; mikrotik_profile_name: string; speed_limit: string },
  routerId: number,
) {
  try {
    const conn = await getRouterConnection(routerId);
    try {
      await conn.write('/ppp/profile/add', [
        `=name=${plan.mikrotik_profile_name}`,
        `=rate-limit=${plan.speed_limit || '1M/1M'}`,
        '=local-address=192.168.5.1',
      ]);
    } catch (error: any) {
      console.error('Failed to add plan to MikroTik:', error);
      throw new Error(error.message || 'Failed to add plan to MikroTik');
    } finally {
      conn.close();
    }
  } catch (error) {
    console.error('Failed to connect to MikroTik for plan creation', error);
  }
}

export async function updatePlanToMikrotik(
  plan: { name: string; mikrotik_profile_name: string; speed_limit: string; old_mikrotik_profile_name?: string },
  routerId: number,
) {
  try {
    const conn = await getRouterConnection(routerId);
    try {
      if (plan.old_mikrotik_profile_name && plan.old_mikrotik_profile_name !== plan.mikrotik_profile_name) {
        const profiles = await conn.write('/ppp/profile/print');
        const oldProfileExists = profiles.some((p: any) => p.name === plan.old_mikrotik_profile_name);

        if (oldProfileExists) {
          await conn.write('/ppp/profile/remove', [`=numbers=${plan.old_mikrotik_profile_name}`]);
        }

        await conn.write('/ppp/profile/add', [
          `=name=${plan.mikrotik_profile_name}`,
          `=rate-limit=${plan.speed_limit || '1M/1M'}`,
          '=local-address=192.168.5.1',
        ]);
      } else {
        const profiles = await conn.write('/ppp/profile/print');
        const profileExists = profiles.some((p: any) => p.name === plan.mikrotik_profile_name);

        if (profileExists) {
          await conn.write('/ppp/profile/set', [
            `=numbers=${plan.mikrotik_profile_name}`,
            `=rate-limit=${plan.speed_limit || '1M/1M'}`,
            '=local-address=192.168.5.1',
          ]);
        } else {
          await conn.write('/ppp/profile/add', [
            `=name=${plan.mikrotik_profile_name}`,
            `=rate-limit=${plan.speed_limit || '1M/1M'}`,
            '=local-address=192.168.5.1',
          ]);
        }
      }
    } catch (error: any) {
      console.error('Failed to update plan on MikroTik:', error);
      throw new Error(error.message || 'Failed to update plan on MikroTik');
    } finally {
      conn.close();
    }
  } catch (error) {
    console.error('Failed to connect to MikroTik for plan update', error);
  }
}

export async function removePlanFromMikrotik(mikrotik_profile_name: string, routerId: number) {
  try {
    const conn = await getRouterConnection(routerId);
    try {
      const profiles = await conn.write('/ppp/profile/print');
      const profileExists = profiles.some((p: any) => p.name === mikrotik_profile_name);

      if (profileExists) {
        await conn.write('/ppp/profile/remove', [`=numbers=${mikrotik_profile_name}`]);
      } else {
        console.log(`Profile ${mikrotik_profile_name} does not exist on MikroTik, skipping removal`);
      }
    } catch (error: any) {
      console.error('Failed to remove plan from MikroTik:', error);
      throw new Error(error.message || 'Failed to remove plan from MikroTik');
    } finally {
      conn.close();
    }
  } catch (error) {
    console.error('Failed to connect to MikroTik for plan removal', error);
  }
}

export async function addSubscriberToMikrotik(subscriber: any) {
  if (!subscriber.router_id) return;
  const conn = await getRouterConnection(subscriber.router_id);
  try {
    const plan = db.prepare('SELECT mikrotik_profile_name FROM plans WHERE id = ?').get(subscriber.plan_id) as any;

    const params = [
      `=name=${subscriber.username}`,
      `=password=${subscriber.password}`,
      `=profile=${plan && plan.mikrotik_profile_name ? plan.mikrotik_profile_name : 'default'}`,
      '=service=pppoe',
    ];

    if (subscriber.remote_address) {
      params.push(`=remote-address=${subscriber.remote_address}`);
    }

    if (subscriber.local_address) {
      params.push(`=local-address=${subscriber.local_address}`);
    } else {
      params.push('=local-address=192.168.5.1');
    }

    await conn.write('/ppp/secret/add', params);
  } catch (error: any) {
    console.error('Failed to add subscriber to MikroTik:', error);
    throw new Error(error.message || JSON.stringify(error) || 'Failed to add subscriber to MikroTik');
  } finally {
    conn.close();
  }
}

export async function removeSubscriberFromMikrotik(subscriber: any) {
  if (!subscriber.router_id) return;
  const conn = await getRouterConnection(subscriber.router_id);
  try {
    const allSecrets = await conn.write('/ppp/secret/print');

    for (const secret of allSecrets) {
      if (secret.name === subscriber.username && secret['.id']) {
        await conn.write('/ppp/secret/remove', [`=.id=${secret['.id']}`]);
        console.log(`Removed PPP secret for ${subscriber.username} from MikroTik`);
      }
    }
  } catch (error: any) {
    console.error('Failed to remove subscriber from MikroTik:', error);
  } finally {
    conn.close();
  }
}

export async function updateSubscriberOnMikrotik(oldSubscriber: any, newSubscriber: any) {
  if (!newSubscriber.router_id) return;
  const conn = await getRouterConnection(newSubscriber.router_id);
  try {
    const allSecrets = await conn.write('/ppp/secret/print');
    const oldSecret = allSecrets.find((s: any) => s.name === oldSubscriber.username);

    if (oldSecret && oldSecret['.id']) {
      if (oldSubscriber.username !== newSubscriber.username) {
        await conn.write('/ppp/secret/remove', [`=.id=${oldSecret['.id']}`]);
      } else {
        const newPlan = db.prepare('SELECT mikrotik_profile_name FROM plans WHERE id = ?').get(newSubscriber.plan_id) as any;

        await conn.write('/ppp/secret/set', [
          `=.id=${oldSecret['.id']}`,
          `=password=${newSubscriber.password}`,
          `=profile=${newPlan && newPlan.mikrotik_profile_name ? newPlan.mikrotik_profile_name : 'default'}`,
          `=remote-address=${newSubscriber.remote_address}`,
          `=local-address=${newSubscriber.local_address || '192.168.5.1'}`,
        ]);
        console.log(`Updated PPP secret for ${newSubscriber.username} on MikroTik`);
        return;
      }
    }

    const newPlan = db.prepare('SELECT mikrotik_profile_name FROM plans WHERE id = ?').get(newSubscriber.plan_id) as any;

    await conn.write('/ppp/secret/add', [
      `=name=${newSubscriber.username}`,
      `=password=${newSubscriber.password}`,
      `=profile=${newPlan && newPlan.mikrotik_profile_name ? newPlan.mikrotik_profile_name : 'default'}`,
      '=service=pppoe',
      `=remote-address=${newSubscriber.remote_address}`,
      `=local-address=${newSubscriber.local_address || '192.168.5.1'}`,
    ]);
    console.log(`Updated/re-added PPP secret for ${newSubscriber.username} on MikroTik`);
  } catch (error: any) {
    console.error('Failed to update subscriber on MikroTik:', error);
    throw new Error(error.message || 'Failed to update subscriber on MikroTik');
  } finally {
    conn.close();
  }
}

export async function suspendSubscriber(subscriberId: number) {
  const subscriber = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(subscriberId) as any;
  if (!subscriber || !subscriber.router_id) return;

  try {
    const conn = await getRouterConnection(subscriber.router_id);
    try {
      const allList = await conn.write('/ip/firewall/address-list/print');
      const existing = allList.find((item: any) => item.list === 'EXPIRED' && item.address === subscriber.remote_address);

      if (!existing) {
        await conn.write('/ip/firewall/address-list/add', [
          '=list=EXPIRED',
          `=address=${subscriber.remote_address}`,
          `=comment=ppp-${subscriber.username}`,
        ]);
        console.log(`Suspended subscriber ${subscriber.username} on MikroTik`);
      }
    } finally {
      conn.close();
    }

    db.prepare("UPDATE subscribers SET status = 'SUSPENDED' WHERE id = ?").run(subscriberId);
  } catch (error) {
    console.error('Failed to suspend subscriber:', error);
    throw error;
  }
}

export async function restoreSubscriber(subscriberId: number) {
  const subscriber = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(subscriberId) as any;
  if (!subscriber || !subscriber.router_id) return;

  try {
    const conn = await getRouterConnection(subscriber.router_id);
    try {
      const allList = await conn.write('/ip/firewall/address-list/print');

      for (const item of allList) {
        if (item.list === 'EXPIRED' && item.address === subscriber.remote_address && item['.id']) {
          await conn.write('/ip/firewall/address-list/remove', [`=.id=${item['.id']}`]);
          console.log(`Restored subscriber ${subscriber.username} on MikroTik`);
        }
      }
    } finally {
      conn.close();
    }

    db.prepare("UPDATE subscribers SET status = 'ACTIVE' WHERE id = ?").run(subscriberId);
  } catch (error) {
    console.error('Failed to restore subscriber:', error);
    throw error;
  }
}

export async function syncRouterData(routerId: number) {
  const router = db.prepare('SELECT * FROM mikrotik_routers WHERE id = ?').get(routerId) as any;
  if (!router) throw new Error('Router not found');

  const conn = await getRouterConnection(routerId);

  try {
    const profiles = await conn.write('/ppp/profile/print');
    const existingPlans = db.prepare('SELECT * FROM plans').all() as any[];

    for (const profile of profiles) {
      if (profile.name === 'default' || profile.name === 'default-encryption' || profile.name === 'EXPIRED') continue;

      const planExists = existingPlans.find((p) => p.mikrotik_profile_name === profile.name);
      if (!planExists) {
        const rateLimit = profile['rate-limit'] || '';
        const speedMatch = rateLimit.match(/^(\d+[kM]\/\d+[kM])/);
        const speed = speedMatch ? speedMatch[1] : 'Unknown';

        db.prepare('INSERT INTO plans (name, mikrotik_profile_name, speed_limit, price) VALUES (?, ?, ?, ?)')
          .run(profile.name, profile.name, speed, 0);
      }
    }

    const updatedPlans = db.prepare('SELECT * FROM plans').all() as any[];
    const secrets = await conn.write('/ppp/secret/print');
    const existingSubscribers = db.prepare('SELECT * FROM subscribers').all() as any[];
    let importedCount = 0;

    for (const secret of secrets) {
      const subExists = existingSubscribers.find((s) => s.username === secret.name);

      if (!subExists) {
        const plan = updatedPlans.find((p) => p.mikrotik_profile_name === secret.profile);
        const planId = plan ? plan.id : null;
        const status = secret.disabled === 'true' ? 'SUSPENDED' : 'ACTIVE';

        db.prepare(`
          INSERT INTO subscribers (full_name, username, password, plan_id, remote_address, local_address, router_id, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          secret.name,
          secret.name,
          secret.password || 'imported',
          planId,
          secret['remote-address'] || '',
          secret['local-address'] || '192.168.5.1',
          routerId,
          status,
        );
        importedCount++;
      }
    }

    db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(1, 'Router Sync', `Synced router ${router.name}. Imported ${importedCount} new subscribers.`);
  } finally {
    conn.close();
  }
}

export async function syncMikrotikState(routerId: number) {
  try {
    const conn = await getRouterConnection(routerId);
    const expiredList = await conn.write('/ip/firewall/address-list/print', ['?list=EXPIRED']);
    const expiredIps = expiredList.map((item: any) => item.address);

    if (expiredIps.length > 0) {
      const placeholders = expiredIps.map(() => '?').join(',');
      db.prepare(`UPDATE subscribers SET status = 'SUSPENDED' WHERE router_id = ? AND remote_address IN (${placeholders})`)
        .run(routerId, ...expiredIps);
    }

    conn.close();
  } catch (error) {
    console.error('Failed to sync MikroTik state:', error);
  }
}
