/*jshint esversion: 8 */
(function() {
    'use strict';

    const AppConfig = require('./configurations/appConfig');
    const Hapi = require('@hapi/hapi');
    const Pack = require("./package");
    const amqp = require("amqplib/callback_api");

    const init = async () => {
        const server = Hapi.server({
            port: AppConfig.PORT,
            host: AppConfig.HOST
        });

        server.route({
            method: 'GET',
            path:'/health',
            handler: async (request, h) => {
                var connectToQueue = new Promise((resolve, reject) => {
                    amqp.connect(AppConfig.RABBITMQ_URL, { "credentials": amqp.credentials.plain(AppConfig.RABBITMQ_USER, AppConfig.RABBITMQ_PASS) }, (error0, connection) => {
                        var s = true;
                        if(error0) s = false;
                        if(typeof(connection) != undefined) connection.close();
                        resolve(s);
                    });
                }).then(status => {
                    return { version: Pack.version, timestamp: new Date().toISOString(), connectionStatus: status };
                });
                return connectToQueue;
            }
        });

        await server.start();
        console.info(` [ SERVER ] Health server running on ${server.info.uri}/health`);
    };

    process.on('unhandledRejection', (err) => {
        console.info(err);
        process.exit(1);
    });

    init();
})();