
const Test = require('../config/testConfig.js');
const BigNumber = require('bignumber.js');

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
  const passenger = accounts[6];

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
    let errorMessage;

    // ACT
    try {
          await config.flightSuretyApp.registerAirline('Airline 2', secondAirline, {from: firstAirline});
    }
    catch(e) {
        errorMessage = e.message
    }

    // ASSERT
        assert.equal(errorMessage.slice(-("This airline needs to fund their account to operate.").length), "This airline needs to fund their account to operate.")
  });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

        // ARRANGE
        let errorMessage;

        // ACT
        try {
            await config.flightSuretyApp.registerAirline('Airline 2', secondAirline, {from: firstAirline});
        }
        catch(e) {
            errorMessage = e.message
        }

        // ASSERT
        assert.equal(errorMessage, "Returned error: VM Exception while processing transaction: revert This airline needs to fund their account to operate.")
    });

    it('(airline) can fund their account and pay airline dues', async () => {

        // ARRANGE
        let fundingAmount = web3.utils.toWei('12', 'ether');
        let initialBalance, balanceAfterFunding, balanceAfterPayingAirlineDue, airlineFundingAmount, submitAirlineFunding;
        let isAirlineFunded = false;

        // ACT
        try {

            // Check initial balance
            initialBalance = await config.flightSuretyData.getAirlineBalance(firstAirline);
            console.log("initial balance", BigNumber(initialBalance) + "\n")

            // Fund and check new balance
            await config.flightSuretyApp.fund({from: firstAirline, value: fundingAmount});
            balanceAfterFunding = await config.flightSuretyData.getAirlineBalance(firstAirline);
            console.log("after funding", BigNumber(balanceAfterFunding) + "\n")

            //get Airline Funding Amount
            airlineFundingAmount = await config.flightSuretyApp.AIRLINE_FUNDING_AMOUNT.call();

            // Pay AirlineFunding Amount
            submitAirlineFunding = await config.flightSuretyApp.submitAirlineFunding({from: firstAirline, value: airlineFundingAmount});

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

    it('can (airline) create airline after paying airline dues ', async () => {

        // ARRANGE
        let airlineRegistration, isAirlineRegistered;
        // ACT
        try {
            airlineRegistration = await config.flightSuretyApp.registerAirline('Airline 2', secondAirline, {from: firstAirline});
            isAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(secondAirline);
        }
        catch(e) {
            console.log(e.message)
        }

        // ASSERT
        assert.equal(isAirlineRegistered, true, "Second airline should be registered.");
        assert.equal(airlineRegistration.logs[0].event, "AirlineRegistered", 'AirlineRegistered event should be emitted.');

    });

    it('can create airlines up to 4 before it requires multiparty consensus ', async () => {

        // ARRANGE
        let thirdAirlineRegistration, isThirdAirlineRegistered, fourthAirlineRegistration, isFourthAirlineRegistered,
            fifthAirlineRegistration, isFifthAirlineRegistered;
        // ACT
        try {
            thirdAirlineRegistration = await config.flightSuretyApp.registerAirline('Airline 3', thirdAirline, {from: firstAirline});
            isThirdAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(thirdAirline);

            fourthAirlineRegistration = await config.flightSuretyApp.registerAirline('Airline 4', fourthAirline, {from: firstAirline});
            isFourthAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(fourthAirline);

            fifthAirlineRegistration = await config.flightSuretyApp.registerAirline('Airline 5', fifthAirline, {from: firstAirline});
            isFifthAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(fifthAirline);

        }
        catch(e) {
            console.log(e.message)
        }

        // ASSERT
        assert.equal(isThirdAirlineRegistered, true, "Third airline should be registered.");
        assert.equal(thirdAirlineRegistration.logs[0].event, "AirlineRegistered", 'AirlineRegistered event should be emitted');

        assert.equal(isFourthAirlineRegistered, true, "Fourth airline should be registered.");
        assert.equal(fourthAirlineRegistration.logs[0].event, "AirlineRegistered", 'AirlineRegistered event should be emitted');

        assert.equal(isFifthAirlineRegistered, false, "Fifth airline should not be registered.");
        assert.equal(fifthAirlineRegistration.logs[0].event, "AirlineVoted", "AirlineVoted event should be emitted.");
        assert.equal(fifthAirlineRegistration.logs[0].args.name, "Airline 5", "Fifth Airline name should be Airline 5.");
        assert.equal(BigNumber(fifthAirlineRegistration.logs[0].args.voteCount), 1, "Fifth airline voteCount should be 1");
    });

    it('requires 50% multiparty consensus for the fifth and subsequent airlines ', async () => {

        // ARRANGE
        let fifthAirlineRegistration, isFifthAirlineRegistered;
        const fundingAmount = web3.utils.toWei('11', 'ether');

        // ACT
        try {
            // 2nd Airline should fund to be able to participate in voting
            await config.flightSuretyApp.fund({from: secondAirline, value: fundingAmount});
            await config.flightSuretyApp.submitAirlineFunding({from: secondAirline});

            // second airline registers the fifth airline and count as second vote
            fifthAirlineRegistration = await config.flightSuretyApp.registerAirline('Airline 5', fifthAirline, {from: secondAirline});
            isFifthAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(fifthAirline);

        }
        catch(e) {
            console.log(e.message)
        }

        // ASSERT
        assert.equal(fifthAirlineRegistration.logs[0].event, "AirlineVoted", "Airline voted.");
        assert.equal(fifthAirlineRegistration.logs[1].event, "AirlineRegistered", "Fifth airline should be emitted.");
        assert.equal(isFifthAirlineRegistered, true, "Fifth airline should be registered.");
        assert.equal(fifthAirlineRegistration.logs[0].args.name, "Airline 5", "Fifth Airline name should be Airline 5.");
        assert.equal(BigNumber(fifthAirlineRegistration.logs[0].args.voteCount), 2, "Fifth airline voteCount should be 2");
    });


    //Insurance

    it('can (passenger) buy insurance for flight', async function () {

        let flight, purchaseInsurance;
        const value = web3.utils.toWei('0.5', 'ether');

        try {
            flight = await config.flightSuretyApp.getFlightByIndex(0);
            purchaseInsurance = await config.flightSuretyApp.purchaseInsurance(flight.flightCode, { from: passenger, value});
        }
        catch (e){
            console.log(e.message);
        }
        assert.equal(purchaseInsurance.logs[0].event, "InsurancePurchased", "InsurancePurchased event should be emitted.");
        assert.equal(purchaseInsurance.logs[0].args.passenger, passenger);
        assert.equal(purchaseInsurance.logs[0].args.flightCode, flight.flightCode);
        assert.equal(purchaseInsurance.logs[0].args.amount, value);
        assert.equal(purchaseInsurance.logs[0].args.insuranceValue, 1.5 * value);
    });

    it('cannot (passenger) buy more than 1 ether of insurance', async function () {

        let flight, errorMessage;

        try {
            flight = await config.flightSuretyApp.getFlightByIndex(0);
            await config.flightSuretyApp.purchaseInsurance(flight.flightCode, {from: passenger, value: web3.utils.toWei('1.5', 'ether')});
        } catch (e) {
            errorMessage = e.message
        }

        assert.equal(errorMessage.slice(-("Max amount of insurance is 1 ether").length), "Max amount of insurance is 1 ether");
    });
});
