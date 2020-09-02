/*jshint esversion: 8 */
if(process.env.NODE_ENV == "production") { // Only post to papertrail from production server
    const Pack = require("./package");
    const papertrail = require('pino-papertrail');
    const pinoms = require('pino-multi-stream');
    
    // create the papertrail destination stream
    const writeStream = papertrail.createWriteStream({
        appname: Pack.name,
        host: "logs5.papertrailapp.com",
        port: 17600,
        echo: false,
        "message-only": true
    }, Pack.name);
    
    // create pino loggger
    const logger = pinoms({ streams: [writeStream] });
    
    module.exports = logger;
}
else {
    module.exports = console;
}
