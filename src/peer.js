/**
 * @author Icseon
 * @description This map will contain IP addresses and port numbers as keys and will hold their MAC addresses as values
 *              so we can easily retrieve the address information by MAC address.
 * @type {Map<any, any>}
 */
export const PeerMap = new Map();

export class Peer {

    /**
     * @author Icseon
     * @description Peer instance constructor
     * @param ipAddress
     * @param portNumber
     */
    constructor(ipAddress, portNumber)
    {
        this.ipAddress = ipAddress;
        this.portNumber = portNumber;
        this.lastPacket = new Date();
    }

}