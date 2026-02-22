import { Client } from '@hiveio/dhive';

const client = new Client([
    'https://api.deathwing.me',
    'https://api.hive.blog',
]);

async function inspectHistory() {
    console.log('--- Inspecting Account History ---');
    const username = 'adesojisouljay';

    try {
        // get_account_history(account, start, limit)
        // start = -1 means most recent
        // limit = number of transactions to retrieve
        const result = await client.call('condenser_api', 'get_account_history', [username, -1, 5]);

        console.log(`Found ${result.length} transactions`);

        result.forEach((item, index) => {
            const [id, tx] = item;
            const op = tx.op; // [opType, opData]
            const timestamp = tx.timestamp;
            console.log(`\nTx #${id} [${timestamp}]`);
            console.log('Type:', op[0]);
            console.log('Data:', op[1]);
        });

    } catch (error) {
        console.error('Failed:', error.message);
    }
}

inspectHistory();
