import { Client } from '@hiveio/dhive';

const client = new Client([
    'https://api.deathwing.me',
    'https://api.hive.blog',
]);

async function inspectUserFeed() {
    console.log('--- Inspecting User Feed (Hive Bridge) ---');
    const username = 'adesojisouljay'; // Using the user from the screenshot context, or a known active user like 'hiveio'

    const types = ['blog', 'posts', 'comments', 'replies'];

    for (const type of types) {
        console.log(`\nFetching ${type}...`);
        try {
            const result = await client.call('bridge', 'get_account_posts', {
                sort: type,
                account: username,
                limit: 3
            });

            if (result && result.length > 0) {
                console.log(`Code: ${type} [Success] - Found ${result.length} items`);
                const first = result[0];
                console.log('Sample Item Keys:', Object.keys(first));
                console.log('Title:', first.title);
                console.log('Body Preview:', first.body.substring(0, 50).replace(/\n/g, ' '));
            } else {
                console.log(`Code: ${type} [Empty]`);
            }
        } catch (error) {
            console.error(`Code: ${type} [Failed]`, error.message);
        }
    }
}

inspectUserFeed();
