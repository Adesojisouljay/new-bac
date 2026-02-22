import dhive from '@hiveio/dhive';
const client = new dhive.Client(['https://api.hive.blog', 'https://api.deathwing.me']);

async function inspectNotifications() {
    const username = 'adesojisouljay';
    try {
        // Correct bridge method name is bridge.account_notifications
        const notifications = await client.call('bridge', 'account_notifications', { account: username, limit: 10 });
        console.log('Notifications Result:', JSON.stringify(notifications, null, 2));
    } catch (err) {
        console.error('Error fetching notifications:', err);
    }
}

inspectNotifications();
