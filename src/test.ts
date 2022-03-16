import {estimateCO2} from "./index"

async function main()
{
    const report = await estimateCO2(
        "MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T", [
            // dungeon - everything
            {address: "0x938034c188C7671cAbDb80D19cd31b71439516a9"},
            // relic - only creation/init/addWhitelistedMinter
            {address: "0x38065291fDce1A752afD725e96FF75E1c38aD6aa",
            functions: new Set<string>(["init", "addWhitelistedMinter"])},
            // lootClassification - everything
            {address: "0xC6Df003DC044582A45e712BA219719410013ad63"},
            // competition minter - everything
            {address: "0xf5C9100859005FabC9E4Ed884bcB7c8B7e15a898"}
        ]);
    
    report.dailyEmissions.forEach((value, key) => {
        console.log(`${key}| lower:${value.lower}, best:${value.best}, upper:${value.upper}`);
    });
    console.log(`TOTAL| lower:${report.total.lower}, best:${report.total.best}, upper:${report.total.upper}`);
}

main().catch((e) =>
{
    console.error(e);
});