import { Client } from '@hiveio/dhive';

const client = new Client([
    'https://api.deathwing.me',
    'https://api.hive.blog',
]);

async function testCommunityFetch() {
    console.log('--- Testing Bridge Community Fetch ---');
    const name = 'hive-106130'; // SpenfHbd

    try {
        console.log(`Fetching community: ${name}...`);

        // bridge.get_community
        const community = await client.call('bridge', 'get_community', { name, observer: '' });

        if (!community) {
            console.error('Community not found!');
            return;
        }

        console.log('Community Title:', community.title);
        console.log('About:', community.about);
        console.log('Subscribers:', community.subscribers);
        console.log('Pending Rewards:', community.sum_pending);
        console.log('Num Authors:', community.num_authors);
        console.log('Team size:', community.team ? community.team.length : 0);

        // Check for context/settings which might contain styling info
        // Often context is {} or null in bridge, but let's see.
        console.log('Context:', JSON.stringify(community.context, null, 2));

        // We might need to fetch the account profile to get the banner/avatar if not in bridge
        console.log('\nFetching Account Profile (for avatar/banner)...');
        const accounts = await client.database.getAccounts([name]);
        if (accounts.length > 0) {
            const account = accounts[0];
            const metadata = JSON.parse(account.posting_json_metadata || '{}');
            console.log('Profile Image:', metadata.profile?.profile_image);
            console.log('Cover Image:', metadata.profile?.cover_image);
        }

    } catch (error) {
        console.error('ERROR:', error);
    }
}

testCommunityFetch();
