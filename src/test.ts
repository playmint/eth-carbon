import {getTransactions} from "./index"

async function main()
{
    const transactions = await getTransactions();
    
    let totalGas = 0;
    for (let i = 0; i < transactions.length; ++i)
    {
        if (!transactions[i].isError)
        {
            totalGas += transactions[i].gasUsed;
        }
    }

    console.log(totalGas);
}

main().catch((e) =>
{
    console.error(e);
});