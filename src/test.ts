import { estimateCO2, reportToCSV, reportToString } from "./index";
import fs from "fs";

async function main() {
    const contracts = [
        // dungeon - everything
        { address: "0x938034c188C7671cAbDb80D19cd31b71439516a9" },
        // relic - only creation/init/addWhitelistedMinter
        {
            address: "0x38065291fDce1A752afD725e96FF75E1c38aD6aa",
            functions: new Set<string>(["init", "addWhitelistedMinter"])
        },
        // lootClassification - everything
        { address: "0xC6Df003DC044582A45e712BA219719410013ad63" },
        // competition minter - everything
        { address: "0xf5C9100859005FabC9E4Ed884bcB7c8B7e15a898" },
        // lootHelper - everything
        { address: "0x877144B0440fb5C2e6DC7Cd5e419b1c3a79Bf8B6" },
        // dungeon2 - everything
        { address: "0x8D0CD328dd41C3934A2Be66578B63CffEb3E555D" },
        // dungeon3minter - everything
        { address: "0xe3c37f80077689f660Cd63BD48D81C746dF51363" }
    ];

    const report = await estimateCO2(fs.readFileSync("apiKey.txt").toString(), contracts);

    console.log(reportToString(report, contracts));

    fs.writeFileSync("out.csv", reportToCSV(report, contracts));
}

main().catch((e) => {
    console.error(e);
});