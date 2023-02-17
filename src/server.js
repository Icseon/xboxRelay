/* Dependencies */
import dgram from 'node:dgram';
import macAddress from 'mac-address';
import { PeerMap, Peer } from './peer.js';
import cron from 'node-cron';

/* Debugging */
import createDebugMessages from 'debug';
const debug = createDebugMessages('icseon.xboxRelay.server');

export default class Server {

    /**
     * @author Icseon
     * @description Server constructor
     * @param port
     */
    constructor(port)
    {
        this.socket = dgram.createSocket('udp4');
        this.port = port;
    }

    /**
     * @author Icseon
     * @description This method will start the server
     */
    start()
    {

        /* Listen for frames */
        this.socket.on('message', (buffer, remoteInfo) => {

            /* If the buffer length is less than 12 bytes, we're going to ignore it - it is invalid */
            if (buffer.length < 12)
            {
                debug('invalid buffer received. ignoring.');
                return;
            }

            /* Read destination and source MAC addresses from the buffer */
            const destinationAddress = macAddress.toString(buffer, 0);
            const sourceAddress = macAddress.toString(buffer, 6);

            /* If our PeerMap does not yet contain our source address, we're going to set it now. */
            if (!PeerMap.has(sourceAddress))
            {

                /* Create a new Peer and add it to the PeerMap */
                const peer = new Peer(remoteInfo.address, remoteInfo.port)
                PeerMap.set(sourceAddress, peer);

                /* Let us know that a new peer has been created */
                debug(`${sourceAddress} => new peer created. ${sourceAddress} => ${peer.ipAddress}:${peer.portNumber}`);
                debug(`${PeerMap.size} client(s) connected`);

            }

            /* Get our own peer from the PeerMap */
            const localPeer = PeerMap.get(sourceAddress);

            /* If the localPeer ipAddress differs from our own, we're going to drop the buffer entirely */
            if (localPeer.ipAddress !== remoteInfo.address)
            {
                debug(`${sourceAddress} => peer address mismatch - ignoring.`);
                return;
            }

            /* In case our localPeer has a different port number than what we have, we'll update it now */
            if (localPeer.portNumber !== remoteInfo.port)
            {
                debug(`${sourceAddress} => updating port from ${localPeer.portNumber} to ${remoteInfo.port}`);
                localPeer.portNumber = remoteInfo.port;
            }

            /*  Update last packet timestamp for the peer. We'll check for timeouts elsewhere. */
            localPeer.lastPacket = new Date();

            switch(destinationAddress)
            {
                /* If our destinationAddress is equal to this, we'll need to broadcast the buffer to everyone */
                case 'ff:ff:ff:ff:ff:ff':

                    for (const [ macAddress, peerInformation ] of PeerMap)
                    {

                        /* If the macAddress is equal to sourceAddress, we're going to be ignoring it */
                        if (macAddress === sourceAddress)
                        {
                            continue;
                        }

                        /* Send the buffer to the peer */
                        this.socket.send(buffer, peerInformation.portNumber, peerInformation.ipAddress);

                    }

                    /* Let us know that the sourceAddress has broadcast - but only if the PeerMap size is greater than 1 */
                    if (PeerMap.size > 1)
                    {
                        debug(`${sourceAddress} => broadcast to ${PeerMap.size - 1} client(s)`);
                    }

                    break;

                /* If we have a valid destinationAddress, we are going to send the buffer to it */
                default:

                    /* Check if the remotePeer exists */
                    if (!PeerMap.has(destinationAddress))
                    {
                        debug(`unable to send to ${destinationAddress} because it is unknown`);
                        return;
                    }

                    /* If sourceAddress matches the destinationAddress, we're going to drop the buffer */
                    if (sourceAddress === destinationAddress)
                    {
                        debug(`unable to send to ${destinationAddress} because the source address is the same`);
                        return;
                    }

                    /* Fetch the remotePeer */
                    const remotePeer = PeerMap.get(destinationAddress);

                    /* Send the buffer to the peer */
                    this.socket.send(buffer, remotePeer.portNumber, remotePeer.ipAddress);

                    /* Let us know that we have sent the buffer successfully */
                    debug(`${sourceAddress} => sent to ${destinationAddress}`);

                    break;
            }

        });

        /* Once we've started the server, we'll want some information */
        this.socket.on('listening', () => {

            /* Retrieve server address information */
            const addressInformation = this.socket.address();
            debug(`server listening on ${addressInformation.address}:${addressInformation.port}`);

        });

        /* Start listening */
        this.socket.bind(this.port);

    }

    /**
     * @author Icseon
     * @description This method will setup the cron jobs
     */
    cron()
    {

        /* Tell ourselves about the fact we are setting up the cron jobs */
        debug('setting up cron jobs');

        /* Setup a job for checking timeouts for peers */
        cron.schedule('*/10 * * * * *', () => {

            /* Go through every single Peer */
            for (const [ macAddress, Peer ] of PeerMap)
            {

                /* Calculate the amount of seconds that have elapsed since we got the last packet */
                const secondsSinceLastPacket = Math.round((new Date() - Peer.lastPacket) / 1000);

                /* If 90 seconds have elapsed, we're going to remove the Peer */
                if (secondsSinceLastPacket > 90)
                {
                    PeerMap.delete(macAddress);
                    debug(`${macAddress} => disconnected`);
                }

            }

        });

    }

}