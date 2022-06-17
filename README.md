# eth-carbon
[![NPM Package](https://img.shields.io/npm/v/@playmint/eth-carbon.svg?style=flat-square)](https://www.npmjs.com/package/@playmint/eth-carbon)
Small library to estimate the CO2 emissions that Ethereum smart contracts are responsible for.

## Installation
`npm install @playmint/eth-carbon`

## API
```ts
async function estimateCO2(etherscanApiKey: string, contracts: ContractFilter[]): Promise<EmissionsReport>

type EmissionsEstimate = {
    txCount: number;// number of transactions
    gas: bigint;    // amount of gas used for calculation
    lower: number;  // lower bound
    best: number;   // best guess
    upper: number;  // upper bound
};

type EmissionsReport = {
    total: EmissionsEstimate;
    byAddress: { [address: string]: EmissionsReportForAddress };
    byDate: Map<Date, EmissionsEstimate>;
};

type EmissionsReportForAddress = {
    total: EmissionsEstimate;
    byDate: Map<Date, EmissionsReportForAddressAndDate>;
    bySelector: { [selector: string]: EmissionsEstimate };
};

type EmissionsReportForAddressAndDate = {
    total: EmissionsEstimate;
    bySelector: { [selector: string]: EmissionsEstimate };
};

type ContractFilter = {
    // contract address
    address: string;
    // include the contract creation transaction, defaults to true
    shouldIncludeContractCreation?: boolean;
    // include failed transactions, default is false
    shouldIncludeFailedTransactions?: boolean;
    // 4 byte function selectors to include, if both 'selectors' and 'functions' 
    // are undefined, then all transactions will be included
    selectors?: Set<string>;
    // can include either function names or signatures, or both. If any function
    // names are specified then the signature will be looked up from the ABI. If
    // multiple functions have the same name then this will fail.
    functions?: Set<string>;
    // this is only required if any functions are specified just as a function name
    // and not the full function signature. If an ABI is needed but none is given,
    // then an attempt will be made to get the ABI from etherscan, if the contract
    // isn't verified on etherscan then this step will fail. This can be a json
    // string, or an array of objects fitting the ABIFunction type (e.g.
    // ethers.utils.Interface.fragments). This is also used if selectors are
    // specified in the filter rather than the function name, the report will
    // attempt to display the function name in the report along with the selector
    // to make it more readable, however if an abi can't be found then it will
    // still produce the report using just the selectors.
    abi?: string | readonly ABIFunction[];
    // used to convert a selector to a function name, if omitted then it will be
    // automatically generated from the abi
    selectorToFunction?: { [selector: string]: string };
};

type ABIField = {
	name: string;
	type: string;
	components?: ABIField[];
};

type ABIFunction = {
	type: "function" | "constructor" | "receive" | "fallback";
	name: string;
	inputs: ABIField[];
	outputs?: ABIField[];
	stateMutability: "pure" | "view" | "payable" | "nonpayable";
};

async function getTransactionsForContracts(apiKey: string, contracts: ContractFilter[]): Promise<{[address: string]: Transaction[]}>

type Transaction = {
	blockNumber: number;
	timeStamp: number;
	input: string;
	gasUsed: number;
	isError: boolean;
	selector: string;
	isContractCreation: boolean;
};
```

## Examples
Standard emissions report
```ts
import {estimateCO2} from "@playmint/eth-carbon";

async function main() {
    const contracts = [{address: "<contractAddress1>"}, {address: "<contractAddress2>"}];
	const emissionsReport = await estimateCO2("<etherscan API key>", contracts);

    console.log(reportToString(report, contracts));
}

main().catch((e) => {
	console.error(e);
}
```
Filtering by functions and selectors
```ts
const emissionsReport = await estimateCO2(
	"<etherscan API key>", [{
		address: "<contractAddress>",
		selectors: new Set<string>(["12345678", "9abcdef0"]),
		functions: new Set<string>(["func1", "func2", "func3(uint256,string)"])
	}]);
```
Passing ABI from EthersJS object
```ts
let contract = new ethers.Contract(...);
const emissionsReport = await estimateCO2(
	"<etherscan api key>", [{
		address:"<contractAddress>",
		functions:  new  Set<string>(["func1", "func2"]),
		abi:  contract.interface.fragments  as  unknown  as  ABIFunction[]
	}]);
```
Example EmissionsReport object
```json
{
    "total": {
        "txCount": 9,
        "gas": "4314765",
        "lower": 0.6446255524183231,
        "best": 0.905229230287158,
        "upper": 1.2960386267870376
    },
    "byAddress": {
        "0x38065291fDce1A752afD725e96FF75E1c38aD6aa": {
            "total": {
                "txCount": 6,
                "gas": "817602",
                "lower": 0.11491131630982421,
                "best": 0.1639256825215661,
                "upper": 0.23690653735634648
            },
            "byDate": {
                "2022-01-27T00:00:00.000Z": {
                    "total": {
                        "txCount": 3,
                        "gas": "655833",
                        "lower": 0.09163122585960128,
                        "best": 0.13090175122800182,
                        "upper": 0.18980753928060262
                    },
                    "bySelector": {
                        "60806040": {
                            "txCount": 1,
                            "gas": "135596",
                            "lower": 0.01894510904705694,
                            "best": 0.02706444149579563,
                            "upper": 0.03924344016890366
                        },
                        "1acbd301": {
                            "txCount": 1,
                            "gas": "466310",
                            "lower": 0.06515158116561788,
                            "best": 0.09307368737945411,
                            "upper": 0.13495684670020847
                        },
                        "168a35fa": {
                            "txCount": 1,
                            "gas": "53927",
                            "lower": 0.0075345356469264544,
                            "best": 0.010763622352752078,
                            "upper": 0.015607252411490514
                        },
                        "contractCreation": {
                            "txCount": 1,
                            "gas": "135596",
                            "lower": 0.01894510904705694,
                            "best": 0.02706444149579563,
                            "upper": 0.03924344016890366
                        },
                        "init(string,string,address,string,string,string,string,string,string,uint256,address)": {
                            "txCount": 1,
                            "gas": "466310",
                            "lower": 0.06515158116561788,
                            "best": 0.09307368737945411,
                            "upper": 0.13495684670020847
                        },
                        "addWhitelistedMinter(address)": {
                            "txCount": 1,
                            "gas": "53927",
                            "lower": 0.0075345356469264544,
                            "best": 0.010763622352752078,
                            "upper": 0.015607252411490514
                        }
                    }
                },
                "2022-02-09T00:00:00.000Z": {
                    "total": {
                        "txCount": 1,
                        "gas": "53915",
                        "lower": 0.007543440454171489,
                        "best": 0.01077634350595927,
                        "upper": 0.015625698083640942
                    },
                    "bySelector": {
                        "168a35fa": {
                            "txCount": 1,
                            "gas": "53915",
                            "lower": 0.007543440454171489,
                            "best": 0.01077634350595927,
                            "upper": 0.015625698083640942
                        },
                        "addWhitelistedMinter(address)": {
                            "txCount": 1,
                            "gas": "53915",
                            "lower": 0.007543440454171489,
                            "best": 0.01077634350595927,
                            "upper": 0.015625698083640942
                        }
                    }
                },
                "2022-03-03T00:00:00.000Z": {
                    "total": {
                        "txCount": 1,
                        "gas": "53927",
                        "lower": 0.007569722759654204,
                        "best": 0.010813889656648864,
                        "upper": 0.015139445519308408
                    },
                    "bySelector": {
                        "168a35fa": {
                            "txCount": 1,
                            "gas": "53927",
                            "lower": 0.007569722759654204,
                            "best": 0.010813889656648864,
                            "upper": 0.015139445519308408
                        },
                        "addWhitelistedMinter(address)": {
                            "txCount": 1,
                            "gas": "53927",
                            "lower": 0.007569722759654204,
                            "best": 0.010813889656648864,
                            "upper": 0.015139445519308408
                        }
                    }
                },
                "2022-04-14T00:00:00.000Z": {
                    "total": {
                        "txCount": 1,
                        "gas": "53927",
                        "lower": 0.008166927236397246,
                        "best": 0.011433698130956144,
                        "upper": 0.016333854472794493
                    },
                    "bySelector": {
                        "168a35fa": {
                            "txCount": 1,
                            "gas": "53927",
                            "lower": 0.008166927236397246,
                            "best": 0.011433698130956144,
                            "upper": 0.016333854472794493
                        },
                        "addWhitelistedMinter(address)": {
                            "txCount": 1,
                            "gas": "53927",
                            "lower": 0.008166927236397246,
                            "best": 0.011433698130956144,
                            "upper": 0.016333854472794493
                        }
                    }
                }
            },
            "bySelector": {
                "60806040": {
                    "txCount": 1,
                    "gas": "135596",
                    "lower": 0.01894510904705694,
                    "best": 0.02706444149579563,
                    "upper": 0.03924344016890366
                },
                "1acbd301": {
                    "txCount": 1,
                    "gas": "466310",
                    "lower": 0.06515158116561788,
                    "best": 0.09307368737945411,
                    "upper": 0.13495684670020847
                },
                "168a35fa": {
                    "txCount": 4,
                    "gas": "215696",
                    "lower": 0.030814626097149394,
                    "best": 0.043787553646316354,
                    "upper": 0.06270625048723436
                },
                "contractCreation": {
                    "txCount": 1,
                    "gas": "135596",
                    "lower": 0.01894510904705694,
                    "best": 0.02706444149579563,
                    "upper": 0.03924344016890366
                },
                "init(string,string,address,string,string,string,string,string,string,uint256,address)": {
                    "txCount": 1,
                    "gas": "466310",
                    "lower": 0.06515158116561788,
                    "best": 0.09307368737945411,
                    "upper": 0.13495684670020847
                },
                "addWhitelistedMinter(address)": {
                    "txCount": 4,
                    "gas": "215696",
                    "lower": 0.030814626097149394,
                    "best": 0.043787553646316354,
                    "upper": 0.06270625048723436
                }
            }
        },
        "0xe3c37f80077689f660Cd63BD48D81C746dF51363": {
            "total": {
                "txCount": 3,
                "gas": "3497163",
                "lower": 0.5297142361084989,
                "best": 0.7413035477655918,
                "upper": 1.0591320894306913
            },
            "byDate": {
                "2022-04-14T00:00:00.000Z": {
                    "total": {
                        "txCount": 2,
                        "gas": "3468398",
                        "lower": 0.525268494313901,
                        "best": 0.7353758920394613,
                        "upper": 1.050536988627802
                    },
                    "bySelector": {
                        "61028060": {
                            "txCount": 1,
                            "gas": "3422023",
                            "lower": 0.518245273096553,
                            "best": 0.7255433823351742,
                            "upper": 1.036490546193106
                        },
                        "399dde76": {
                            "txCount": 1,
                            "gas": "46375",
                            "lower": 0.007023221217347939,
                            "best": 0.009832509704287114,
                            "upper": 0.014046442434695878
                        },
                        "contractCreation": {
                            "txCount": 1,
                            "gas": "3422023",
                            "lower": 0.518245273096553,
                            "best": 0.7255433823351742,
                            "upper": 1.036490546193106
                        },
                        "setRelayAddress(address,bool)": {
                            "txCount": 1,
                            "gas": "46375",
                            "lower": 0.007023221217347939,
                            "best": 0.009832509704287114,
                            "upper": 0.014046442434695878
                        }
                    }
                },
                "2022-04-21T00:00:00.000Z": {
                    "total": {
                        "txCount": 1,
                        "gas": "28765",
                        "lower": 0.0044457417945978715,
                        "best": 0.0059276557261304956,
                        "upper": 0.008595100802889218
                    },
                    "bySelector": {
                        "d8db091e": {
                            "txCount": 1,
                            "gas": "28765",
                            "lower": 0.0044457417945978715,
                            "best": 0.0059276557261304956,
                            "upper": 0.008595100802889218
                        },
                        "enableXpRewards(bool)": {
                            "txCount": 1,
                            "gas": "28765",
                            "lower": 0.0044457417945978715,
                            "best": 0.0059276557261304956,
                            "upper": 0.008595100802889218
                        }
                    }
                }
            },
            "bySelector": {
                "61028060": {
                    "txCount": 1,
                    "gas": "3422023",
                    "lower": 0.518245273096553,
                    "best": 0.7255433823351742,
                    "upper": 1.036490546193106
                },
                "399dde76": {
                    "txCount": 1,
                    "gas": "46375",
                    "lower": 0.007023221217347939,
                    "best": 0.009832509704287114,
                    "upper": 0.014046442434695878
                },
                "d8db091e": {
                    "txCount": 1,
                    "gas": "28765",
                    "lower": 0.0044457417945978715,
                    "best": 0.0059276557261304956,
                    "upper": 0.008595100802889218
                },
                "contractCreation": {
                    "txCount": 1,
                    "gas": "3422023",
                    "lower": 0.518245273096553,
                    "best": 0.7255433823351742,
                    "upper": 1.036490546193106
                },
                "setRelayAddress(address,bool)": {
                    "txCount": 1,
                    "gas": "46375",
                    "lower": 0.007023221217347939,
                    "best": 0.009832509704287114,
                    "upper": 0.014046442434695878
                },
                "enableXpRewards(bool)": {
                    "txCount": 1,
                    "gas": "28765",
                    "lower": 0.0044457417945978715,
                    "best": 0.0059276557261304956,
                    "upper": 0.008595100802889218
                }
            }
        }
    },
    "byDate": {
        "2022-01-27T00:00:00.000Z": {
            "txCount": 3,
            "gas": "655833",
            "lower": 0.09163122585960128,
            "best": 0.13090175122800182,
            "upper": 0.18980753928060262
        },
        "2022-02-09T00:00:00.000Z": {
            "txCount": 1,
            "gas": "53915",
            "lower": 0.007543440454171489,
            "best": 0.01077634350595927,
            "upper": 0.015625698083640942
        },
        "2022-03-03T00:00:00.000Z": {
            "txCount": 1,
            "gas": "53927",
            "lower": 0.007569722759654204,
            "best": 0.010813889656648864,
            "upper": 0.015139445519308408
        },
        "2022-04-14T00:00:00.000Z": {
            "txCount": 3,
            "gas": "3522325",
            "lower": 0.5334354215502982,
            "best": 0.7468095901704175,
            "upper": 1.0668708431005964
        },
        "2022-04-21T00:00:00.000Z": {
            "txCount": 1,
            "gas": "28765",
            "lower": 0.0044457417945978715,
            "best": 0.0059276557261304956,
            "upper": 0.008595100802889218
        }
    }
}
```
## How it works
Contract transactions are divided into days, and their combined gas cost per day is calculated. Using daily network gas usage data from [https://etherscan.io/chart/gasused](https://etherscan.io/chart/gasused) it calculates the percentage of the daily gas used by the contract. Then using daily CO2 emissions estimates from [https://kylemcdonald.github.io/ethereum-emissions/](https://kylemcdonald.github.io/ethereum-emissions/) it uses the daily gas percentage to estimate emissions for that day. All of the emissions figures across all days can then be added together for a final total figure.  