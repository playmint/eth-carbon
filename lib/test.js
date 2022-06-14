"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function main() {
    const report = await (0, index_1.estimateCO2)("MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T", [
        // dungeon - everything
        { address: "0x938034c188C7671cAbDb80D19cd31b71439516a9" },
        // relic - only creation/init/addWhitelistedMinter
        {
            address: "0x38065291fDce1A752afD725e96FF75E1c38aD6aa",
            functions: new Set(["init", "addWhitelistedMinter"])
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
    ]);
    for (const address in report.byAddress) {
        const byAddress = report.byAddress[address];
        console.log(`${address}| gas:${byAddress.total.gas}, lower:${byAddress.total.lower}, best:${byAddress.total.best}, upper:${byAddress.total.upper}`);
        for (const selector in byAddress.bySelector) {
            const bySelector = byAddress.bySelector[selector];
            console.log(`${selector}| gas:${bySelector.gas}, lower:${bySelector.lower}, best:${bySelector.best}, upper:${bySelector.upper}`);
        }
    }
    console.log(`TOTAL| gas:${report.total.gas}, lower:${report.total.lower}, best:${report.total.best}, upper:${report.total.upper}`);
}
main().catch((e) => {
    console.error(e);
});
//# sourceMappingURL=test.js.map