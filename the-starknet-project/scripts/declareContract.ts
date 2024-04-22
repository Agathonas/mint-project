import { Account, Contract, json, RpcProvider, constants, cairo, CallData, Calldata } from "starknet";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();
import { readFile, writeFile } from "fs/promises";
import { getAccount } from './utils';

const nodeUrl = "https://starknet-sepolia.infura.io/v3/b7f4083a71864becaa0ab33ba72284a0";
const contracts = `scripts/contracts.json`;

async function main() {
    const provider = new RpcProvider({ nodeUrl: nodeUrl });
    const account = await getAccount(provider)
    let deployments;
    const jsonFile = await readFile(contracts, "utf-8");
    deployments = JSON.parse(jsonFile);

    await declareContract(account, provider, deployments, 'NFTMint')

}

async function declareContract(account: Account, provider: RpcProvider, deployments: any, contractName: string) {
    console.log(' declaring ', contractName);
    const sierraFilePath = `./target/dev/terracon_prestige_card_${contractName}.contract_class.json`;
    const casmFilePath = `./target/dev/terracon_prestige_card_${contractName}.compiled_contract_class.json`;
    const compiledTestSierra = json.parse(fs.readFileSync(sierraFilePath).toString("ascii"));
    const compiledTestCasm = json.parse(fs.readFileSync(casmFilePath).toString("ascii"));
  
    try {
      const declareResponse = await account.declare({ contract: compiledTestSierra, casm: compiledTestCasm });
      console.log(contractName, ' declared with classHash =', declareResponse.class_hash);
      await provider.waitForTransaction(declareResponse.transaction_hash);
      deployments[contractName] = { class_hash: declareResponse.class_hash };
      await writeFile(contracts, JSON.stringify(deployments, null, 2));
    } catch (error) {
      if ((error as Error).message.includes("is already declared")) {
        const confirmRedeclare = await promptUser(`The contract ${contractName} is already declared. Do you want to redeclare it? (y/n)`);
        if (confirmRedeclare.toLowerCase() === 'y') {
          // Redeclare the contract
          const declareResponse = await account.declare({ contract: compiledTestSierra, casm: compiledTestCasm });
          console.log(contractName, ' redeclared with classHash =', declareResponse.class_hash);
          await provider.waitForTransaction(declareResponse.transaction_hash);
          deployments[contractName] = { class_hash: declareResponse.class_hash };
          await writeFile(contracts, JSON.stringify(deployments, null, 2));
        } else {
          console.log(`Skipping redeclaration of ${contractName}.`);
        }
      } else {
        throw error;
      }
    }
  }

  
async function promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdin.resume();
      process.stdout.write(question + ' ');
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }


main()
    .then(() => process.exit(0))
    .catch((error) => { console.error(error); process.exit(1); });