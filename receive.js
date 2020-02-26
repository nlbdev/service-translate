#!/usr/bin/env node
/*jshint esversion: 8 */

//const AirbrakeClient = require("airbrake-js");
const AppConfig = require("./configurations/appConfig");
const amqp = require("amqplib/callback_api");

// Imports the Google Cloud client library
const { TranslationServiceClient } = require('@google-cloud/translate');
const nlbML = {
  projectId: (process.env.NODE_ENV == "production" ? 'nlb-babel-prod' : 'nlb-babel-dev'),
  modelId: (process.env.NODE_ENV == "production" ? 'TRL5131196466458525696': 'TRL5591161762775826432'),
  location: 'us-central1'
};
const mtmML = {
  projectId: '',
  modelId: '',
  location: 'us-central1'
};
const notaML = {
  projectId: '',
  modelId: '',
  location: 'us-central1'
};
const celiaML = {
  projectId: '',
  modelId: '',
  location: 'us-central1'
};
const hbsML = {
  projectId: '',
  modelId: '',
  location: 'us-central1'
};
const dediconML = {
  projectId: '',
  modelId: '',
  location: 'us-central1'
};
const sbsML = {
  projectId: '',
  modelId: '',
  location: 'us-central1'
};

// Override console to enable papertrail
const console = require("./logger");

(() => {
  "use strict";

  var Health = require("./health");

  const PostProcessText = (text, lang) => {
    try {
      const postProcess = require(`./translations/${lang}.json`);
      postProcess.forEach(p => {
        var regexp = new RegExp(p.search, 'g');
        text = text.replace(regexp, p.replace);
        regexp = null;
      });
  
      return text;
    }
    catch (ex) {
      // File not found, just return the text
      return text;
    }
  };

  const GenerateRequest = (inputText, language) => {
    if (language == "no") {
      return {
        parent: `projects/${nlbML.projectId}/locations/${nlbML.location}`,
        contents: inputText,
        mimeType: 'text/plain',
        sourceLanguageCode: "en",
        targetLanguageCode: language,
        model: `projects/${nlbML.projectId}/locations/${nlbML.location}/models/${nlbML.modelId}`,
      };
    }
    else {
      return {
        parent: `projects/${nlbML.projectId}/locations/${nlbML.location}`,
        contents: inputText,
        mimeType: 'text/plain',
        sourceLanguageCode: 'en',
        targetLanguageCode: language,
      };
    }
  };

  const TranslateText = async (inputText, toLanguage) => {
    if (toLanguage == "en") return PostProcessText(inputText.join(" "), toLanguage);
    const translationClient = new TranslationServiceClient();

    // Construct request
    const request = GenerateRequest(inputText, toLanguage);

    try {
      // Run request
      let [t] = await translationClient.translateText(request);

      let translatedArray = [];
      t.translations.forEach(txt => {
        translatedArray.push(txt.translatedText);
      });
      let translatedText = translatedArray.join(" ");
      return PostProcessText(translatedText, toLanguage);
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
              let now = new Date();
              var payload = JSON.parse(msg.content);

              if (payload != undefined) {
                console.info(` [ INFO ] Translated from: "${payload.text.words.join(" ")}"`);
                TranslateText(payload.text.words, payload.to)
                  .then(res => {
                    console.info(` [ INFO ] Translated to: "${res}"`);
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
                    console.info(` [ SUCCESS ] Done in ${new Date() - now} ms`);
                    channel.ack(msg);
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
  }, 1000);
})();