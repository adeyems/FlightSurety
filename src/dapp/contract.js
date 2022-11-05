import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        this.config = Config[network];
        this.owner = null;
        this.web3Provider = null;
        this.configWeb3Provider()
            .then(() => this.web3 = new Web3(this.web3Provider))
            .then(() => {
                this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, this.config.appAddress);
                this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, this.config.dataAddress);
                return this.web3.eth.getAccounts((err, accounts) => this.owner = accounts[0]);
            })
            .then(() => this.authorizeAppContract(callback))
            .catch((e) => {
                console.log(e);
                callback(false)
            })
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {

            this.owner = accts[0];

            let counter = 1;

            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(airline, flightCode, timestamp) {
        return new Promise((resolve, reject) => {
            this.flightSuretyApp.methods
                .fetchFlightStatus(airline, flightCode, timestamp)
                .send(
                    { from: this.owner },
                    (err, res) => {
                        if (err) reject(err);
                        resolve(res);
                    }
                );
        })
    }

    getFlights() {
        return new Promise((resolve, reject) => {
            this.flightSuretyApp.methods
                .getFlightsCount()
                .call({ from: this.owner }, async (err, flightsCount) => {
                    const flights = [];
                    for (var i = 0; i < flightsCount; i++) {
                        const res = await this.flightSuretyApp.methods.getFlightByIndex(i).call({ from: this.owner });
                        flights.push(res);
                    }
                    resolve(flights);
                });
        });
    }

    purchaseInsurance(code, amount) {
        return new Promise((resolve, reject) => {
            this.flightSuretyApp.methods.purchaseInsurance(code)
                .send({from: this.owner, value: this.web3.utils.toWei(amount.toString(), 'ether')},
                    (err, res) =>  err ? reject(err) : resolve(res))
        });
    }


    getPassengerInsurances(flights) {
        const passengerInsurances = [];

        return Promise.all(flights.map(async (flight) => {
                let insurance = await this.flightSuretyApp.methods.getInsurance(flight.flightCode).call({ from: this.owner });
                if (insurance.amount !== "0") {
                    passengerInsurances.push({
                        flight,
                        amount: this.web3.utils.fromWei(insurance.amount, 'ether'),
                        insuranceValue: this.web3.utils.fromWei(insurance.insuranceValue, 'ether'),
                        state: insurance.state,
                    });
                }
            }))
            .then(() => {
                return passengerInsurances
            })
    }

    claimInsurance(airline, flight, timestamp) {
        return new Promise((resolve, reject) => {
            this.flightSuretyApp.methods
                .claimInsurance(airline, flight, timestamp)
                .send({ from: this.owner }, (err, res) => err ? reject(err) :resolve(res));
        });
    }

    getBalance() {
        return new Promise((resolve, reject) => {
            this.flightSuretyApp.methods.getBalance().call({ from: this.owner }, async (err, balance) => {
                if (err) return  reject(err)
                resolve(this.web3.utils.fromWei(balance, 'ether'));
            });
        });
    }

    withdrawBalance() {
        return new Promise((resolve, reject) => {
            this.flightSuretyApp.methods.withdrawBalance()
                .send({ from: this.owner },
                    (err, res) => err ? reject(err) : resolve(res));
        });
    }

    async configWeb3Provider() {
        if (window.ethereum){
            this.web3Provider = window.ethereum;
            try {
                await window.ethereum.enable();
                console.log("Connected to web via ethereum")
            }
            catch (e){
                console.error("Access denied")
            }
        }
        else if (window.web3) {
            this.web3Provider = window.web3.currentProvider;
            console.log("connected to web3 via web3 currentProvider")
        }
        else {
            console.log("connected to web3 websocket provider")
            this.web3Provider = new Web3.providers.WebsocketProvider(this.config.url.replace('http', 'ws'))
        }
    }

    authorizeAppContract(callback) {
        this.flightSuretyData.methods.isCallerAuthorized(this.config.appAddress)
            .call({from: this.owner}, (err, isAuthorized) => {
                if (!!isAuthorized) return callback(isAuthorized)

                this.flightSuretyData.methods.authorizeCaller(this.config.appAddress)
                    .send({from: this.owner}, () => callback(true))
            })
    }
}
