pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Global Variables
    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping (address => bool) private authorizedContracts;              // Authorized caller of contracts

    enum AirlineState {
        PENDING,
        REGISTERED,
        FUNDED
    }

    enum InsuranceState {
        PURCHASED,
        CLAIMED
    }

    struct Airline {
        string name;
        address airlineAddress;
        AirlineState airlineState;
        uint256 voteCount;
        mapping(address => bool) voters;
        uint256 balance;
    }

    struct Insurance {
        string flightCode;
        uint256 amount;
        uint256 insuranceValue;
        InsuranceState state;
    }

    mapping (address => Airline) private airlines;
    uint256 internal noOfRegisteredAirlines;

    mapping(address => mapping(string => Insurance)) private insurances;
    mapping(address => uint256) private passengerCredits;

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address airline) public
    {
        contractOwner = msg.sender;
        airlines[airline] = Airline({name: 'Airline A',  airlineState: AirlineState.REGISTERED, voteCount: 0, balance: 0, airlineAddress: msg.sender});
        noOfRegisteredAirlines = 1;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }


    /**
    * @dev Modifier that requires the calling App contract account to be authorized
    */
    modifier requireIsCallerAuthorized()
    {
        require(authorizedContracts[msg.sender] == true, "Caller is not authorized to call this contract");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool)
    {
        return operational;
    }

    function isCallerAuthorized(address contractAddress) external view returns(bool)
    {
        return(authorizedContracts[contractAddress] == true);
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner
    {
        operational = mode;
    }

    function authorizeCaller(address contractAddress) external requireContractOwner
    {
        require(authorizedContracts[contractAddress] != true, 'Contract is already authorized.');
        authorizedContracts[contractAddress] = true;
    }

    function deAuthorizeCaller(address contractAddress) external
    requireContractOwner
    {
        require(authorizedContracts[contractAddress] == true, 'Contract not authorized.');
        delete authorizedContracts[contractAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/


            /**************************************************************************/
            /*                           AIRLINE FUNCTIONS                            */
            /*************************************************************************/


    function isAirlineFunded(address airline) public view returns(bool) {
        return getAirlineState(airline) == AirlineState.FUNDED;
    }

    function isAirlineRegistered ( address airline) public view returns(bool) {
        return getAirlineState(airline) == AirlineState.REGISTERED;
    }

    function airlineExists(address airlineAddress) internal view returns (bool)
    {
        return airlines[airlineAddress].airlineAddress == airlineAddress;
    }

    function getAirlineState(address airlineAddress) internal view returns (AirlineState)
    {
        return airlines[airlineAddress].airlineState;
    }

    function getNoOfRegisteredAirline() external view returns (uint)
    {
        return noOfRegisteredAirlines;
    }

    function getAirlineBalance(address airline) external view returns (uint256)
    {
        return airlines[airline].balance;
    }

    function getAirline(address airline) external view returns (address)
    {
        return airlines[airline].airlineAddress;
    }

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */


    function saveAndPendAirlineRegistration(string name, address airlineAddress)
    external
    requireIsOperational
    requireIsCallerAuthorized
    {
        airlines[airlineAddress].name = name;
        airlines[airlineAddress].airlineAddress = airlineAddress;
        airlines[airlineAddress].airlineState = AirlineState.PENDING;
    }

    function registerAirline(address airlineAddress)
    external
    requireIsOperational
    requireIsCallerAuthorized
    {
        require((airlines[airlineAddress].airlineState != AirlineState.REGISTERED), 'This airline is already registered.');
        airlines[airlineAddress].airlineState = AirlineState.REGISTERED;
        noOfRegisteredAirlines = noOfRegisteredAirlines.add(1);
    }

    function voteAirline(address airlineAddress, address voter)
    external
    requireIsOperational
    requireIsCallerAuthorized
    returns (uint256)
    {
        require(!(airlines[airlineAddress].airlineState == AirlineState.REGISTERED), 'This airline is already registered.');
        require(!airlines[airlineAddress].voters[voter], "You have already voted for this airline.");
        airlines[airlineAddress].voters[voter] = true;
        airlines[airlineAddress].voteCount = airlines[airlineAddress].voteCount.add(1);

        return airlines[airlineAddress].voteCount;
    }


    function fund(address airline)
    public
    payable
    requireIsOperational
    requireIsCallerAuthorized
    returns(uint256)
    {
        require(msg.value > 0, "No fund sent");
        airlines[airline].balance = airlines[airline].balance.add(msg.value);
        return airlines[airline].balance;
    }

    function submitAirlineFunding(address airline, uint256 amount)
    public
    requireIsOperational
    requireIsCallerAuthorized
    {

        airlines[airline].balance = airlines[airline].balance.sub(amount);
        airlines[airline].airlineState = AirlineState.FUNDED;
    }

    /**************************************************************************/
    /*                           PASSENGER FUNCTIONS                            */
    /*************************************************************************/

    function createInsurance(address passenger, string flightCode, uint256 amount, uint256 insuranceValue)
    external
    requireIsCallerAuthorized
    {
        require(insurances[passenger][flightCode].amount != amount, "Insurance already exists");

        insurances[passenger][flightCode] = Insurance(flightCode, amount, insuranceValue, InsuranceState.PURCHASED);
    }


    function getInsurance(address passenger, string flightCode)
    external
    view
    requireIsCallerAuthorized
    returns (uint256 amount, uint256 insuranceValue, InsuranceState state)
    {
        amount = insurances[passenger][flightCode].amount;
        insuranceValue = insurances[passenger][flightCode].insuranceValue;
        state = insurances[passenger][flightCode].state;
    }

    function claimInsurance(address passenger, string flightCode)
    external
    requireIsCallerAuthorized
    {
        require(insurances[passenger][flightCode].state == InsuranceState.PURCHASED, "Insurance already claimed");

        insurances[passenger][flightCode].state = InsuranceState.CLAIMED;

        passengerCredits[passenger] = passengerCredits[passenger].add(insurances[passenger][flightCode].insuranceValue);
    }

    function getPassengerBalance(address passenger)
    external
    view
    requireIsCallerAuthorized
    returns (uint256)
    {
        return passengerCredits[passenger];
    }

    function withdrawToPassengerWallet(address passenger)
    external
    requireIsCallerAuthorized
    {
        require(passengerCredits[passenger] > 0, "Withdrawal amount is greater than passenger credit");

        passengerCredits[passenger] = 0;

        passenger.transfer(passengerCredits[passenger]);
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function()
                            external
                            payable
    {
        fund(msg.sender);
    }


}

