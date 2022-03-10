import {getTransactionsForContracts} from "./index"

async function main()
{
    const transactions = await getTransactionsForContracts(
        "MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T", [
            // dungeon - everything
            {address: "0x938034c188C7671cAbDb80D19cd31b71439516a9",
            shouldIncludeContractCreation: true,
            shouldIncludeFailedTransactions: false},
            // relic - only creation/init/addWhitelistedMinter
            {address: "0x38065291fDce1A752afD725e96FF75E1c38aD6aa",
            shouldIncludeContractCreation: true,
            shouldIncludeFailedTransactions: false,
            functions: new Set<string>([
                "init(string, string, address, string, string, string, string, string, string, uint256, address)",
                "addWhitelistedMinter(address)"
            ])},
            // lootClassification - everything
            {address: "0xC6Df003DC044582A45e712BA219719410013ad63",
            shouldIncludeContractCreation: true,
            shouldIncludeFailedTransactions: false},
            // competition minter - everything
            {address: "0xf5C9100859005FabC9E4Ed884bcB7c8B7e15a898",
            shouldIncludeContractCreation: true,
            shouldIncludeFailedTransactions: false}
        ]);
    
    let totalGas = 0;
    for (const address in transactions)
    {
        for (let i = 0; i < transactions[address].length; ++i)
        {
            totalGas += transactions[address][i].gasUsed;
        }
    }

    console.log(totalGas);
}

main().catch((e) =>
{
    console.error(e);
});