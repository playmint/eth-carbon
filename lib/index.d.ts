export declare type Transaction = {
    hash: string;
    blockNumber: number;
    timeStamp: number;
    input: string;
    gasUsed: bigint;
    isError: boolean;
    selector: string;
    isContractCreation: boolean;
};
export declare type ABIField = {
    name: string;
    type: string;
    components?: ABIField[];
};
export declare type ABIFunction = {
    type: "function" | "constructor" | "receive" | "fallback";
    name: string;
    inputs: ABIField[];
    outputs?: ABIField[];
    stateMutability: "pure" | "view" | "payable" | "nonpayable";
};
export declare type ContractFilter = {
    address: string;
    shouldIncludeContractCreation?: boolean;
    shouldIncludeFailedTransactions?: boolean;
    selectors?: Set<string>;
    functions?: Set<string>;
    abi?: string | readonly ABIFunction[];
    selectorToFunction?: {
        [selector: string]: string;
    };
};
export declare function getTransactionsForContracts(contracts: ContractFilter[], apiKey: string): Promise<{
    [address: string]: Transaction[];
}>;
export declare function populateSelectorsForContractFilter(contractFilter: ContractFilter, apiKey?: string): Promise<void>;
export declare type EmissionsEstimate = {
    txCount: number;
    gas: bigint;
    lower: number;
    best: number;
    upper: number;
};
export declare type EmissionsReport = {
    total: EmissionsEstimate;
    byAddress: {
        [address: string]: EmissionsReportForAddress;
    };
    byDate: {
        [date: string]: EmissionsEstimate;
    };
};
export declare type EmissionsReportForAddress = {
    total: EmissionsEstimate;
    byDate: {
        [date: string]: EmissionsReportForAddressAndDate;
    };
    bySelector: {
        [selector: string]: EmissionsEstimate;
    };
};
export declare type EmissionsReportForAddressAndDate = {
    total: EmissionsEstimate;
    bySelector: {
        [selector: string]: EmissionsEstimate;
    };
};
export declare function estimateCO2(apiKey: string, contracts: ContractFilter[]): Promise<EmissionsReport>;
export declare function reportToString(report: EmissionsReport, contracts: ContractFilter[]): string;
export declare function reportToCSV(report: EmissionsReport, contracts: ContractFilter[]): string;
//# sourceMappingURL=index.d.ts.map