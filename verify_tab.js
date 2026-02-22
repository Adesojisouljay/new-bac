import { UnifiedDataService } from './src/services/unified.js';

async function verifyCommunityFiltering() {
    const username = 'adesojisouljay';
    const communityId = 'hive-106130';

    console.log(`Verifying community filtering for @${username} in ${communityId}...`);

    try {
        const posts = await UnifiedDataService.getUserCommunityPosts(username, communityId, 5);
        console.log(`Found ${posts.length} posts.`);

        posts.forEach(post => {
            console.log(`- ${post.title} (Community: ${post.community})`);
        });

        if (posts.every(p => p.community === communityId)) {
            console.log('✅ All posts belong to the correct community.');
        } else {
            console.log('❌ Some posts belong to different communities.');
        }

    } catch (e) {
        console.error('Verification failed:', e);
    }
}

// Note: This script needs to be run in an environment where hiveClient and imports work.
// Since it's TS and uses ESM, I'll just rely on the manual verification via browser/UI.
// But I can check if there are any lint errors or obvious logic flaws.
