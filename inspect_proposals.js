import dhive from '@hiveio/dhive';
const client = new dhive.Client(['https://api.hive.blog', 'https://api.deathwing.me']);

async function inspectProposals() {
    try {
        const proposalData = await client.call('database_api', 'list_proposals', {
            start: [],
            limit: 1,
            order: 'by_total_votes',
            order_direction: 'descending',
            status: 'active'
        });
        console.log('Proposal Structure:', JSON.stringify(proposalData.proposals[0], null, 2));

        const username = 'adesojisouljay';
        const votes = await client.call('database_api', 'list_proposal_votes', {
            start: [username, 0],
            limit: 5,
            order: 'by_voter_proposal',
            order_direction: 'descending',
            status: 'all'
        });
        console.log('Proposal Votes Structure:', JSON.stringify(votes.proposal_votes[0] || 'No votes found', null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

inspectProposals();
