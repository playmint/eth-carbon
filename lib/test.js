"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
async function main() {
    await (0, index_1.default)();
}
main().catch((e) => {
    console.error(e);
});
//# sourceMappingURL=test.js.map