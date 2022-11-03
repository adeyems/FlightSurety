
var Test = require('../config/testConfig.js');
const BigNumber = require("bignumber.js");

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 10;
  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
  });

  let oracles = [];
  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;


  it('can register oracles', async () => {

    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call({from: accounts[1]});

    // ACT
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {
      await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
      let indexes = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
      console.log(`Oracle Registered: ${indexes[0]}, ${indexes[1]}, ${indexes[2]}`);
      oracles.push({address: accounts[a], indexes});
    }
  });

  it('can request flight status', async () => {

    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    let oracleRequest = await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    // ACT
    const eventLogs = oracleRequest.logs[0];
    let indexGenerated =  eventLogs.args.index;
    let matchingOracles = [];

    console.log("index generated", BigNumber(indexGenerated));

    oracles.forEach((oracle) => {
      if (BigNumber(oracle.indexes[0]).isEqualTo(indexGenerated)) matchingOracles.push(oracle)
      if (BigNumber(oracle.indexes[1]).isEqualTo(indexGenerated)) matchingOracles.push(oracle)
      if (BigNumber(oracle.indexes[2]).isEqualTo(indexGenerated)) matchingOracles.push(oracle)
    })

    console.log("matching oracles", matchingOracles);

    const minimumOracleResponses = await config.flightSuretyApp.MIN_RESPONSES.call();
    const matchingOraclesLength = matchingOracles.length;
    const isOraclesResponseEnough = matchingOraclesLength >= minimumOracleResponses;

    if (!isOraclesResponseEnough){
      console.warn("The minimum number of oracles response must be greater than or equals " + minimumOracleResponses);
    }

    // test for each matching oracles since they have the generatedIndex;
      let oracleResponse;
      for (let i = 0; i < matchingOraclesLength; i++ ){

        try {
          // Submit a response...it will only be accepted if there is an Index match
          oracleResponse = await config.flightSuretyApp.submitOracleResponse(indexGenerated, config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: matchingOracles[i].address });
        }
        catch(e) {
          // Enable this when debugging
          console.log(e.message);
        }
        assert.equal(oracleResponse.logs[0].event, "OracleReport", "OracleReport event should be emitted")
        assert.equal(oracleResponse.logs[0].args.airline, config.firstAirline)
        assert.equal(oracleResponse.logs[0].args.flight, flight)
        assert.equal(BigNumber(oracleResponse.logs[0].args.status).toNumber(), STATUS_CODE_ON_TIME)
        assert.equal(BigNumber(oracleRequest.logs[0].args.timestamp), timestamp)

        // confirm if other events are emitted if minimum number of oracles has responded
        if (isOraclesResponseEnough && (i === (matchingOraclesLength - 1))){
          assert.equal(oracleResponse.logs[1].event, "FlightStatusInfo", "FlightStatusInfo event should be emitted")
          assert.equal(oracleResponse.logs[2].event, "FlightStatusProcessed", "FlightStatusProcessed event should be emitted")
        }
      }

        assert.equal(oracleRequest.logs[0].event, "OracleRequest", "OracleRequest event should be emitted")
        assert.equal(oracleRequest.logs[0].args.airline, config.firstAirline)
        assert.equal(oracleRequest.logs[0].args.index, indexGenerated)
        assert.equal(oracleRequest.logs[0].args.flight, flight)
        assert.equal(BigNumber(oracleRequest.logs[0].args.timestamp), timestamp)
  });
});
