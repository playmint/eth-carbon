"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const fs_1 = __importDefault(require("fs"));
async function main() {
    const contracts = [
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
    ];
    const report = await (0, index_1.estimateCO2)(fs_1.default.readFileSync("apiKey.txt").toString(), contracts);
    console.log(`Total - ${estimateStr(report.total)}`);
    for (const address in report.byAddress) {
        const byAddress = report.byAddress[address];
        console.log(`${address} - ${estimateStr(byAddress.total)}`);
        for (const selector in byAddress.bySelector) {
            console.log(`${selector} - ${estimateStr(byAddress.bySelector[selector])}`);
        }
    }
}
function estimateStr(est) {
    return `best:${est.best}, lower:${est.lower}, upper:${est.upper}`;
}
main().catch((e) => {
    console.error(e);
});
//# sourceMappingURL=test.js.map