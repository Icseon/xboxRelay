import Server from './server.js';

/* Start the server */
const server = new Server(9938);
server.start();

/* Start cron jobs (for checking if peers have disconnected) */
server.cron();