pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    //FLightSuretyData Object
    FlightSuretyData flightSuretyData;
    address flightSuretyDataContractAddress;

    // Account used to deploy contract
    address private contractOwner;

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;


    struct Flight {
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
        string flightCode;
    }

    mapping(bytes32 => Flight) private flights;
    mapping(string => uint8) private flightCodes;
    bytes32[] private flightsKeyList;


    uint8 private constant NO_OF_AIRLINES_REQUIRED_FOR_CONSENSUS_VOTING = 4;
    uint256 public constant AIRLINE_FUNDING_AMOUNT = 10 ether;
    uint256 private constant INSURANCE_PRICE_LIMIT = 1 ether;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event AirlineRegistered(address airlineAddress);
    event AirlinePaid(address airlineAddress);
    event AirlineVoted(string name, address airlineAddress, uint256 voteCount);

    event InsurancePurchased(address passenger, string flightCode, uint256 amount);
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
         // Modify to call data contract's status
        require(flightSuretyData.isOperational(), "Contract is currently not operational");
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
    * @dev Modifier that requires the airline to be registered.
    */
    modifier onlyRegisteredAirlines()
    {
        require(flightSuretyData.isAirlineRegistered(msg.sender), "This airline needs to be registered to operate");
        _;
    }

    /**
    * @dev Modifier that requires the airline to have funded its account with 10 ether.
    */
    modifier onlyFundedAirlines()
    {
        require(flightSuretyData.isAirlineFunded(msg.sender), "This airline needs to fund their account to operate.");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address contractData) public
    {
        contractOwner = msg.sender;
        flightSuretyDataContractAddress = contractData;
        flightSuretyData = FlightSuretyData(contractData);

        // Initialize flights

        uint256 initialTime = now;

        bytes32 flightKey1 = getFlightKey(contractOwner, "FlightA", initialTime);
        flights[flightKey1] = Flight(STATUS_CODE_UNKNOWN, initialTime, contractOwner, "FlightA");
        flightCodes["FlightA"] = 1;
        flightsKeyList.push(flightKey1);

        bytes32 flightKey2 = getFlightKey(contractOwner, "FlightB", initialTime + 1 days);
        flights[flightKey2] = Flight(STATUS_CODE_UNKNOWN, initialTime + 1 days, contractOwner, "FlightB");
        flightCodes["FlightB"] = 1;
        flightsKeyList.push(flightKey2);

        bytes32 flightKey3 = getFlightKey(contractOwner, "FlightC", initialTime + 2 days);
        flights[flightKey3] = Flight(STATUS_CODE_UNKNOWN, initialTime + 2 days, contractOwner, "FlightC");
        flightCodes["FlightC"] = 1;
        flightsKeyList.push(flightKey3);

        bytes32 flightKey4 = getFlightKey(contractOwner, "FlightD", initialTime + 3 days);
        flights[flightKey4] = Flight(STATUS_CODE_UNKNOWN, initialTime + 3 days, contractOwner, "FlightD");
        flightCodes["FlightD"] = 1;
        flightsKeyList.push(flightKey4);

        bytes32 flightKey5 = getFlightKey(contractOwner, "FlightE", initialTime + 4 days);
        flights[flightKey5] = Flight(STATUS_CODE_UNKNOWN, initialTime + 4 days, contractOwner, "FlightE");
        flightCodes["FlightE"] = 1;
        flightsKeyList.push(flightKey5);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool)
    {
        return flightSuretyData.isOperational();  // Modify to call data contract's status
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/


    function registerAirline(string name, address airline) external
    requireIsOperational
    onlyFundedAirlines
    {
        flightSuretyData.saveAndPendAirlineRegistration(name, airline);
        if (flightSuretyData.getNoOfRegisteredAirline() < NO_OF_AIRLINES_REQUIRED_FOR_CONSENSUS_VOTING) {
            flightSuretyData.registerAirline(airline);
            emit AirlineRegistered(airline);
        } else {
            uint256 votesCount = flightSuretyData.voteAirline(airline, msg.sender);
            emit AirlineVoted(name, airline, votesCount);
            if (votesCount >= flightSuretyData.getNoOfRegisteredAirline().div(2)){
                flightSuretyData.registerAirline(airline);
                emit AirlineRegistered(airline);
            }
        }
    }

    function fund()
    public
    payable
    requireIsOperational
    onlyRegisteredAirlines
    returns (uint256)
    {
        return flightSuretyData.fund.value(msg.value)(msg.sender);
    }

    function submitAirlineFunding()
    public
    payable
    requireIsOperational
    {
        require(flightSuretyData.getAirlineBalance(msg.sender) >= AIRLINE_FUNDING_AMOUNT);
        flightSuretyData.submitAirlineFunding(msg.sender, AIRLINE_FUNDING_AMOUNT);

        // flightSuretyDataContractAddress.transfer(msg.value);

        emit AirlinePaid(msg.sender);
    }

    function isAirlineRegistered(address airline) public view returns (bool) {
        return flightSuretyData.isAirlineRegistered(airline);
    }

    function isAirlineFunded(address airline) public view returns (bool) {
        return flightSuretyData.isAirlineFunded(airline);
    }

   /**
    * @dev Register a future flight for insuring.
    *
    */
    function registerFlight(string flightCode, uint256 timestamp, uint8 statusCode)
    external
    onlyFundedAirlines
    {
        bytes32 flightKey = getFlightKey(msg.sender, flightCode, timestamp);

        flights[flightKey] = Flight(statusCode, timestamp, msg.sender, flightCode);
        flightsKeyList.push(flightKey);
    }

    function getFlightsCount() external view returns(uint256 count)
    {
        return flightsKeyList.length;
    }

    function getFlightByIndex(uint256 index) external view returns(address airline, string flightCode, uint256 timestamp, uint8 statusCode)
    {
        airline = flights[ flightsKeyList[index] ].airline;
        flightCode = flights[ flightsKeyList[index] ].flightCode;
        timestamp = flights[ flightsKeyList[index] ].updatedTimestamp;
        statusCode = flights[ flightsKeyList[index] ].statusCode;
    }

    // Flight

   /**
    * @dev Called after oracle has updated flight status
    *
    */
    function processFlightStatus(address airline, string memory flightCode, uint256 timestamp, uint8 statusCode)
    internal
    {
        bytes32 flightKey = getFlightKey(airline, flightCode, timestamp);
        flights[flightKey].statusCode = statusCode;

        emit FlightStatusProcessed(airline, flightCode, timestamp, statusCode);
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    }


    // Insurance

    function purchaseInsurance(string flightCode)
    external
    payable
    {
        require(flightCodes[flightCode] == 1, "Flight does not exist");
        require(msg.value <= INSURANCE_PRICE_LIMIT, "Max amount of insurance is 1 ether");

        // flightSuretyDataContractAddress.transfer(msg.value);

        uint256 insuranceValue = msg.value.mul(3).div(2);

        flightSuretyData.createInsurance(msg.sender, flightCode, msg.value, insuranceValue);

        emit InsurancePurchased(msg.sender, flightCode, msg.value);
    }


    function getInsurance(string flightCode)
    external
    view
    returns (uint256 amount, uint256 payoutAmount, uint256 state)
    {
        return flightSuretyData.getInsurance(msg.sender, flightCode);
    }

    function claimInsurance(address airline, string flightCode, uint256 timestamp)
    external
    {
        bytes32 flightKey = getFlightKey(airline, flightCode, timestamp);
        require(flights[flightKey].statusCode == STATUS_CODE_LATE_AIRLINE, "Flight was not delayed.");

        flightSuretyData.claimInsurance(msg.sender, flightCode);
    }

    function getBalance()
    external
    view
    returns (uint256 balance)
    {
        return flightSuretyData.getPassengerBalance(msg.sender);
    }

    function withdrawBalance() external
    {
        flightSuretyData.withdrawToPassengerWallet(msg.sender);
    }

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 public constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    event FlightStatusProcessed(address airline, string flightCode, uint256 timestamp, uint8 statusCode);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (
                                address account
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}

/********************************************************************************************/
/*                               DATA CONTRACT STUBS                                     */
/********************************************************************************************/
contract FlightSuretyData {
    function isOperational() external view returns(bool);
    function isAirlineRegistered(address airlineAddress) external view returns(bool);
    function isAirlineFunded(address airlineAddress) external view returns(bool);
    function registerAirline(address airlineAddress) external;
    function saveAndPendAirlineRegistration(string name, address airlineAddress) external;
    function voteAirline(address airlineAddress, address voter) external view returns (uint256);
    function getNoOfRegisteredAirline() external view returns (uint);
    function getAirlineBalance(address airline) external view returns (uint);
    function fund(address airline) public payable returns(uint256);
    function submitAirlineFunding(address airline, uint256 amount) public;
    function createInsurance(address passenger, string flightCode, uint256 amount, uint256 insuranceValue) external;
    function claimInsurance(address passenger, string flightCode) external;
    function getPassengerBalance(address passenger) external view returns (uint256);
    function getInsurance(address passenger, string flightCode) external view returns (uint256 amount, uint256 insuranceValue, uint state);
    function withdrawToPassengerWallet(address passenger) external;
}
