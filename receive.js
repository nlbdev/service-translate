#!/usr/bin/env node
/*jshint esversion: 8 */

//const AirbrakeClient = require("airbrake-js");
const AppConfig = require("./configurations/appConfig");
const amqp = require("amqplib/callback_api");

// Override console to enable papertrail
const console = require("./logger");

(() => {
  "use strict";

  var Health = require("./health");

  // Give the MQ 10 seconds to get started
  setTimeout(() => {
    amqp.connect(AppConfig.RABBITMQ_URL, { "credentials": amqp.credentials.plain(AppConfig.RABBITMQ_USER, AppConfig.RABBITMQ_PASS) }, (error0, connection) => {
      if (error0) {
        throw error0;
      }
      connection.createChannel((error1, channel) => {
        if (error1) {
          throw error1;
        }

        try {
          var queue = "q.nlb.translate";

          channel.assertQueue(queue, {
            durable: true
          });
          channel.prefetch(AppConfig.PARALLEL_REQUESTS);
          console.info(` [ SERVER ] Listening for updates to queue ${queue}`);

          channel.consume(
            queue,
            (msg) => {
              var payload = JSON.parse(msg.content);

              // Return data
              channel.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify(payload)),
                {
                  expiration: 10000,
                  contentType: "application/json",
                  correlationId: msg.properties.correlationId
                }
              );
            },
            {
              noAck: false
            }
          );
        }
        catch(ex) {
          throw ex;
        }
      });
    });
  }, (process.env.NODE_ENV == "development" ? 1000 : 10000));

  /*var airbrake = new AirbrakeClient({
    projectId: process.env.AIRBRAKE_PROJECT_ID,
    projectKey: process.env.AIRBRAKE_PROJECT_KEY,
    environment: process.env.NODE_ENV || "development"
  });*/
})();