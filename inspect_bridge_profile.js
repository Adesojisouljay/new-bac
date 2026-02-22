import { Client } from '@hiveio/dhive';

const client = new Client([
    'https://api.deathwing.me',
    'https://api.hive.blog',
]);

async function inspectBridgeProfile() {
    console.log('--- Inspecting Bridge Profile ---');
    const username = 'adesojisouljay';

    try {
        const result = await client.call('bridge', 'get_profile', { account: username });
        console.log('Result Keys:', Object.keys(result));
        console.log('Stats:', result.stats);
        console.log('Metadata (portion):', JSON.stringify(result.metadata, null, 2).substring(0, 200));
    } catch (error) {
        console.error('Failed:', error.message);
    }
}

inspectBridgeProfile();
