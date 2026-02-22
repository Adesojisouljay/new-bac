import { Client } from '@hiveio/dhive';

const client = new Client([
    'https://api.hive.blog',
    'https://api.openhive.network',
]);

async function testPagination() {
    console.log('--- Testing Bridge API Pagination ---');
    const tag = 'hive-106130'; // SpenfHbd
    const sort = 'created';
    const limit = 5;

    try {
        // Step 1: Fetch Page 1
        console.log(`\nFetching Page 1 (limit: ${limit})...`);
        const params1 = { tag, sort, limit };
        const page1 = await client.call('bridge', 'get_ranked_posts', params1);

        if (!page1 || page1.length === 0) {
            console.error('Page 1 returned no posts!');
            return;
        }

        console.log(`Page 1 received: ${page1.length} posts`);
        const lastPost = page1[page1.length - 1];
        console.log(`Last Post: ${lastPost.author}/${lastPost.permlink}`);

        // Step 2: Fetch Page 2
        console.log(`\nFetching Page 2 (starting from ${lastPost.author}/${lastPost.permlink})...`);
        const params2 = {
            tag,
            sort,
            limit: limit + 1, // +1 because inclusive
            start_author: lastPost.author,
            start_permlink: lastPost.permlink
        };

        console.log('Params for Page 2:', JSON.stringify(params2, null, 2));

        const page2 = await client.call('bridge', 'get_ranked_posts', params2);

        if (!page2 || page2.length === 0) {
            console.error('Page 2 returned no posts!');
            return;
        }

        console.log(`Page 2 received: ${page2.length} posts`);

        // Verify overlap
        const firstPostPage2 = page2[0];
        console.log(`First Post of Page 2: ${firstPostPage2.author}/${firstPostPage2.permlink}`);

        if (firstPostPage2.author === lastPost.author && firstPostPage2.permlink === lastPost.permlink) {
            console.log('SUCCESS: Overlap detected correctly (inclusive pagination).');
            const uniquePage2 = page2.slice(1);
            console.log(`Unique posts in Page 2: ${uniquePage2.length}`);
            if (uniquePage2.length > 0) {
                console.log(`Next post: ${uniquePage2[0].author}/${uniquePage2[0].permlink}`);
            }
        } else {
            console.warn('WARNING: No overlap detected? Check pagination logic.');
            // Dump the first post to see what we got
            console.log('Got instead:', `${firstPostPage2.author}/${firstPostPage2.permlink}`);
        }

    } catch (error) {
        console.error('ERROR:', error);
    }
}

testPagination();
