
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

class DApp {
    constructor() {
        this.flights = [];
        this.contract = new Contract('localhost', (isAuthorized) => {
            // console.log(isAuthorized)
            if (!isAuthorized)
                return display('Operational Status', 'Check if contract is operational', [{
                    label: 'Operational Status: ',
                    value: 'false'
                }])

            this.contract.isOperational((error, result) => {
               // console.log(error, result);
                display('Operational Status', 'Check if contract is operational', [{
                    label: 'Operational Status: ',
                    error: error,
                    value: result
                }]);
            });

            this.getFlights();
            this.getPurchasedInsurances();
            this.watchFlightStatusUpdate()
            this.getBalance();
        });
    }

    async getFlights() {
        this.flights = await this.contract.getFlights();
        this.flights.forEach((flight) => {
            const {flightCode, timestamp} = flight;
            const option = document.createElement('option')
            option.value = flightCode;
            option.textContent = `${flightCode} on  ${ new Date(timestamp * 1000).toDateString()}`;
            DOM.elid('flights').appendChild(option);
        });
    }

    async purchaseInsurance() {
        await this.contract.purchaseInsurance(DOM.elid('flights').value, +DOM.elid('amount').value)
            .catch(error => console.log(error))
    }

    async getPurchasedInsurances() {
        this.purchasedInsurances = await this.contract.getPassengerInsurances(this.flights)

        let text = '';
        this.purchasedInsurances.forEach((insurance, index) => {
                text += `<li xmlns="http://www.w3.org/1999/html"><div>
                    <p><strong>Flight Code: </strong> : ${insurance.flight.flightCode}</p>
                    <p><strong>Date: </strong> ${new Date(insurance.flight.timestamp * 1000).toDateString()}</strong></p>
                    <p><strong>Amount: </strong> ${insurance.amount} </p>
                    <p><strong>Status Code:</strong> </p>${this.getAirlineStatusNameByCode(insurance.flight.statusCode)}</p>
                </div>`;

            let actionTextField = `<button class="btn btn-info" name="action-button" action="check-status" index="${index}" >Check Flight Status</button>`;
            if (insurance.state === "1") actionTextField = `<h4><strong> Insurance Claimed </strong></h4>`;
            else if (insurance.flight.statusCode === "20") {
                actionTextField = `<button class="btn btn-info" name="action-button" action='claim-insurance' index="${index}" >Claim Insurance</button>`;
            }

            text += `<div>${actionTextField}</div></li><br>`;
        });

        DOM.elid('booked-flights').innerHTML = text;

        DOM.elname('action-button').forEach(button => {
            button.addEventListener('click', () => {
                const index = button.getAttribute('index');
                const action = button.getAttribute('action')
                const flight = this.purchasedInsurances[index].flight;

                if (action === 'check-status') return this.checkFlightStatus(flight.airline, flight.flightCode, flight.timestamp)
                if (action === 'claim-insurance') return this.claimInsurance(flight.airline, flight.flightCode, flight.timestamp)
            })
        })
    }

    getAirlineStatusNameByCode(code){
        switch (code){
            case "0":
              return  "Unknown"
            case "10":
               return  "On Time"
            case "20":
               return  "Late Airline"
            case "30":
              return  "On Time"
            case "40":
               return  "Late Technical"
            case "50":
               return  "Late Other"
        }
    }

    async getBalance() {
        this.contract.getBalance().then((balance) => {
            this.balance = balance;
            DOM.elid('balance').textContent =  `${this.balance} ETH`;
        });
    }

    async claimInsurance(airline, flight, timestamp) {
        this.contract.claimInsurance(airline, flight, timestamp).then(() => {
            this.getPurchasedInsurances();
            this.getBalance();
        })

    }

    async withdraw() {
        this.contract.withdrawBalance().then(() => this.getBalance())
    }

    async checkFlightStatus(airline, flightCode, timestamp) {
        await this.contract.fetchFlightStatus(airline, flightCode, timestamp)
    }

    async watchFlightStatusUpdate() {
        this.contract.flightSuretyApp.events.FlightStatusInfo({fromBlock: 0}, (error, event) => {
            if (error) console.log(error);

            console.log(event)
            if (!!event.returnValues.length){
                this.getPurchasedInsurances();
            }
        })
    }
}

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}

const dApp = new DApp();

DOM.elid('purchase').addEventListener('click', () => {
     dApp.purchaseInsurance().then(() =>  dApp.getPurchasedInsurances());
})

DOM.elid('withdraw').addEventListener('click', () => {
    dApp.withdraw();
})




