#!/usr/bin/env node
/*jshint esversion: 8 */

//const AirbrakeClient = require("airbrake-js");
const AppConfig = require("./configurations/appConfig");
const amqp = require("amqplib/callback_api");

// Imports the Google Cloud client library
const { TranslationServiceClient } = require('@google-cloud/translate');
const location = 'us-central1';
const projectId = (process.env.NODE_ENV == "production" ? 'nlb-babel-prod' : 'nlb-babel-dev');
const modelId = 'nlb-math';

// Override console to enable papertrail
const console = require("./logger");

(() => {
  "use strict";

  var Health = require("./health");

  const translateText = async (inputText, toLanguage) => {
    const translationClient = new TranslationServiceClient();

    // Construct request
    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [inputText],
      mimeType: 'text/plain',
      sourceLanguageCode: 'en',
      targetLanguageCode: toLanguage,
      model: `projects/${projectId}/locations/${location}/models/${modelId}`,
    };

    try {
      // Run request
      const [translations] = await translationClient.translateText(request);
      return translations;
    } catch (error) {
      return error;
    }
  };

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

              console.log(msg);
              if(payload != undefined) {
                translateText(payload.text, payload.to)
                .then(res => {
                  console.log(`Translated: ${res}`);
                  // Return data
                  channel.sendToQueue(
                    msg.properties.replyTo,
                    Buffer.from(JSON.stringify(res)),
                    {
                      expiration: 10000,
                      contentType: "application/json",
                      correlationId: msg.properties.correlationId
                    }
                  );
                })
                .catch(err => err);
              }
            },
            {
              noAck: false
            }
          );
        }
        catch (ex) {
          throw ex;
        }
      });
    });
  }, 10000);

  /*var airbrake = new AirbrakeClient({
    projectId: process.env.AIRBRAKE_PROJECT_ID,
    projectKey: process.env.AIRBRAKE_PROJECT_KEY,
    environment: process.env.NODE_ENV || "development"
  });*/
})();