import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import BigNumber from "bignumber.js";

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
const NO_OF_ORACLES = 25;

let oracles = [];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const registerOracles = async accounts => {
    const fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    const statusCodes = [0, 10, 20, 30, 40, 50];

    for (let i = 0; i < NO_OF_ORACLES; i++) {
        const randomIndex = Math.floor(Math.random() * statusCodes.length)
        const randomStatusCode = statusCodes[randomIndex];
        const address = accounts[i];

        await flightSuretyApp.methods.registerOracle().send({from: address, value: fee, gas: 2000000});

        const indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: address });

        oracles.push({ address, indexes, statusCode: randomStatusCode });
    }
    console.log("Oracles", oracles)
}

const updateFlightStatusRequest = (index, airline, flightCode, timestamp) => {
    if (!oracles.length)
        return

    let matchingOracles = [];

    oracles.forEach((oracle) => {
        if (BigNumber(oracle.indexes[0]).isEqualTo(index))
            matchingOracles.push(oracle)
        if (BigNumber(oracle.indexes[1]).isEqualTo(index))
            matchingOracles.push(oracle)
        if (BigNumber(oracle.indexes[2]).isEqualTo(index))
            matchingOracles.push(oracle)
    })

    console.log("matching Oracles", matchingOracles);

    matchingOracles.forEach((oracle) => {
        flightSuretyApp.methods.submitOracleResponse(index, airline, flightCode, timestamp, oracle.statusCode)
            .send({ from: oracle.address, gas: 1000000 })
    });
}


const deployOracles = async () => {
    try {
        const accounts = await web3.eth.getAccounts((error, accounts) => console.log(accounts));
        await registerOracles(accounts);

        flightSuretyApp.events.OracleRequest({
            fromBlock: 0
        }, function (error, event) {
            console.log(event);
        })
            .on('data', function (event) {
                console.log(event.returnValues); // same results as the optional callback above
                updateFlightStatusRequest (event.returnValues.index, event.returnValues.airline, event.returnValues.flight, event.returnValues.timestamp)
            })
            /*.on('changed', function (event) {
                // remove event from local database
            })*/
            .on('error', console.error);

    }
    catch (e){
        console.log(e)
    }
}

deployOracles();

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;
