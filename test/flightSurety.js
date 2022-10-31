
const Test = require('../config/testConfig.js');
const BigNumber = require('bignumber.js');
const truffleAssert = require('truffle-assertions')

contract('Flight Surety Tests', async (accounts) => {
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  const firstAirline = accounts[1];
  const secondAirline = accounts[2];
  const thirdAirline = accounts[3];
  const fourthAirline = accounts[4];
  const fifthAirline = accounts[5];

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

    it('(airline) registers first airline when the contract is deployed.', async () => {

        // ARRANGE
        let firstAirline = accounts[1];
        let isAirlineRegistered

        // ACT
        try {
            isAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(firstAirline);
        }
        catch(e) {
            console.log(e)
        }

        // ASSERT
        assert.equal(isAirlineRegistered, true, "First airline should be registered when contract is deployed.");
    });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

    // ARRANGE
    let firstAirline = accounts[1];
    let newAirline = accounts[2];
    let errorMessage;

    // ACT
    try {
          await config.flightSuretyApp.registerAirline('Airline 2', newAirline, {from: firstAirline});
    }
    catch(e) {
        errorMessage = e.message
    }

    // ASSERT
        assert.equal(errorMessage, "Returned error: VM Exception while processing transaction: revert This airline needs to fund their account to operate.")
  });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

        // ARRANGE
        let firstAirline = accounts[1];
        let newAirline = accounts[2];
        let errorMessage;

        // ACT
        try {
            await config.flightSuretyApp.registerAirline('Airline 2', newAirline, {from: firstAirline});
        }
        catch(e) {
            errorMessage = e.message
        }

        // ASSERT
        assert.equal(errorMessage, "Returned error: VM Exception while processing transaction: revert This airline needs to fund their account to operate.")
    });

    it('(airline) can fund their account and pay airline dues', async () => {

        // ARRANGE
        let firstAirline = accounts[1];
        let fundingAmount = web3.utils.toWei('12', 'ether');
        let initialBalance, balanceAfterFunding, balanceAfterPayingAirlineDue, airlineFundingAmount, submitAirlineFunding;
        let isAirlineFunded = false;

        // ACT
        try {

            // Check initial balance
            initialBalance = await config.flightSuretyData.getAirlineBalance(firstAirline);
            // console.log("initial balance", BigNumber(initialBalance) + "\n")

            // Fund and check new balance
            await config.flightSuretyApp.fund({from: firstAirline, value: fundingAmount});
            balanceAfterFunding = await config.flightSuretyData.getAirlineBalance(firstAirline);
            // console.log("after funding", BigNumber(balanceAfterFunding) + "\n")

            //get Airline Funding Amount
            airlineFundingAmount = await config.flightSuretyApp.AIRLINE_FUNDING_AMOUNT.call();

            // Pay AirlineFunding Amount
            submitAirlineFunding = await config.flightSuretyApp.submitAirlineFunding({from: firstAirline});

            balanceAfterPayingAirlineDue = await config.flightSuretyData.getAirlineBalance(firstAirline);
            // console.log("after paying dues", BigNumber(balanceAfterPayingAirlineDue) + "\n")

            // check if airline state changed to PAID
            isAirlineFunded = await config.flightSuretyApp.isAirlineFunded(firstAirline);

        }
        catch(e) {
             console.log(e)
        }

        // ASSERT
           assert.equal(0, BigNumber(initialBalance), 'initial balance must be 0');
           assert.equal(balanceAfterFunding, fundingAmount, 'new balance should be equal to the funding amount');
           assert.equal(balanceAfterPayingAirlineDue, balanceAfterFunding - airlineFundingAmount, 'new balance should be equal to the funding amount less airlineFunding amount');
           assert.equal(isAirlineFunded, true, 'Airline state should be changed to funded');
           assert.equal(submitAirlineFunding.logs[0].event, "AirlinePaid", 'AirlinePaid event should be emitted');

    });

    // try register with second Airline and get non-existing

    it('can (airline) create airline after paying airline dues ', function () {

    });
});
