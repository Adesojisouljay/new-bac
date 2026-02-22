import { Client } from '@hiveio/dhive';

const client = new Client([
    'https://api.deathwing.me',
    'https://api.hive.blog',
]);

async function inspectUserPosts() {
    const username = 'adesojisouljay';
    const communityId = 'hive-106130';

    try {
        const posts = await client.call('bridge', 'get_account_posts', {
            sort: 'posts',
            account: username,
            limit: 10
        });

        console.log(`Inspecting ${posts.length} posts for @${username}...`);
        posts.forEach(post => {
            console.log(`Post: ${post.title}`);
            console.log(`- Category: ${post.category}`);
            console.log(`- Community: ${post.community}`);
            console.log(`- Community Title: ${post.community_title}`);
            console.log('---');
        });

    } catch (error) {
        console.error('ERROR:', error);
    }
}

inspectUserPosts();
