/*jshint esversion: 8 */
import * as Hapi from "@hapi/hapi";
import * as Joi from "@hapi/joi";
import * as uuid from "uuid";

// Imports the Google Cloud client library
import { TranslationServiceClient } from '@google-cloud/translate';

(() => {
  "use strict";

  const Pack = { name: "service-translate", version: "2.0.0" };
  const identifier: string = uuid.v4();

  const PostProcessText = (text:string, lang:string) => {
    try {
      const postProcess = require(`./translations/${lang}.json`);
      postProcess.forEach((p:{search:string; replace:string;}) => {
        const regexp = new RegExp(p.search, 'g');
        text = text.replace(regexp, p.replace);
      });

      return text;
    }
    catch (ex) {
      // File not found, just return the text
      return text;
    }
  };

  const GenerateRequest = ({ inputText, language }: { inputText: string[]; language: string; }): GoogleRequest => {
    if (language === "no") {
      return {
        parent: `projects/${process.env.GOOGLE_PROJECT_ID}/locations/us-central1`,
        contents: inputText,
        mimeType: 'text/plain',
        sourceLanguageCode: "en",
        targetLanguageCode: language,
        model: `projects/${process.env.GOOGLE_PROJECT_ID}/locations/us-central1/models/${process.env.GOOGLE_MODEL_ID}`,
      };
    }
    else {
      return {
        parent: `projects/${process.env.GOOGLE_PROJECT_ID}/locations/us-central1`,
        contents: inputText,
        mimeType: 'text/plain',
        sourceLanguageCode: 'en',
        targetLanguageCode: language,
      };
    }
  };

  const TranslateText = async (inputText:string[], toLanguage:string):Promise<string> => {
    if (toLanguage === "en") return PostProcessText(inputText.join(" "), toLanguage);
    const translationClient = new TranslationServiceClient();

    // Construct request for ML translation
    const request: GoogleRequest = GenerateRequest({ inputText, language: toLanguage });

    try {
      // Run request
      const [t] = await translationClient.translateText(request);

      // tslint:disable-next-line: prefer-const
      let translatedArray: string[] = [];

      if(t.translations) {
        for(const txt of t.translations) {
          if(txt.translatedText) translatedArray.push(txt.translatedText);
        }
      }
      const translatedText = translatedArray.join(" ");
      // Run rule-based translation
      return PostProcessText(translatedText, toLanguage);
    } catch (error) {
      return error;
    }
  };

  process.on('SIGINT', () => {
    console.info(` | ${new Date().toISOString()}\t| ${identifier}\t| ${Pack.name}\t| Server stopped`);
    process.exit(1);
  });

  process.on('unhandledRejection', (err: Error) => {
    console.error(err);
    process.exit(1);
  });

  const init = async () => {
    const _server = Hapi.server({
      port: process.env.PORT || 443,
      host: process.env.HOST || "0.0.0.0"
    });

    // Healthcheck
    _server.route({
      method: 'GET',
      path: '/health',
      handler: async (request: Request, h: Event) => {
        return { name: Pack.name, version: Pack.version, instance: identifier, timestamp: new Date().toISOString() };
      }
    });
    // Routes
    _server.route({
      method: 'POST',
      path: '/{to}',
      options: {
        cors: true,
        handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => HandleRequest(request, h),
        validate: {
          payload: {
            words: Joi.array().items(Joi.string()).required().description("The text to translate as a string or array.")
          },
          params: {
            to: Joi.string()
              .min(2)
              .max(5)
              .required()
              .default('en')
              .description("Two-letter or five-letter identification of the language to translate to.")
          }
        }
      }
    });

    // Starting service
    await _server.start();
    console.info(` | ${new Date().toISOString()}\t| ${identifier}\t| ${Pack.name}\t\t| Server started, listening to ${_server.info.uri}/`);
  }

  const HandleRequest = async (request: Hapi.Request, h: Hapi.ResponseToolkit) => {
    const ident = request.headers["nlb-uuid"] || uuid.v1();
    console.info(` | ${new Date().toISOString()}\t| ${ident}\t| ${Pack.name}\t\t| Received HTTP ${request.method.toUpperCase()} with the payload: ${JSON.stringify(request.payload)}`);
    const payload:Payload = {words: request.payload.words}; // Ignore this error
    return await TranslateText(payload.words, request.params.to);
  };

  init();
})();