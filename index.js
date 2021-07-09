#!/usr/bin/env node
/*jshint esversion: 8 */

const AppConfig = require("./configurations/appConfig");
const Hapi = require('@hapi/hapi');
const Pack = require("./package.json");
const Joi = require("@hapi/joi");

(() => {
    'use strict';

    /**
     * Post-processing of text
     * @param {String} text The English text as string
     * @param {String} lang The language to translate to
     * @returns {String} The translated text
     */
    const PostProcessText = (text, lang) => {
        try {
            const postProcess = require(`./translations/${lang}.json`);

            postProcess.forEach(p => {
                var regexString = `\\b(${p.search})\\b`;
                var re = new RegExp(regexString, "g");
                text = text.replace(re, p.replace);
            });

            // Fixes punctuation errors
            const punctuations = require(`./translations/all.json`);
            punctuations.forEach(s => {
                text = text.split(s.search).join(s.replace);
            });

            return text;
        }
        catch (ex) {
            // File not found, just return the text
            console.error(ex);
            return text;
        }
    };

    /**
     * Translates the text array from English to a specified language
     * @param {Array<String>} inputText The English text as array
     * @param {String} toLanguage The language to translate to
     * @returns {String} The translated text
     */
    const TranslateText = async (inputText, toLanguage) => PostProcessText(inputText.join(" "), toLanguage);

    const init = async () => {
        const server = Hapi.server({
            port: AppConfig.PORT,
            host: AppConfig.HOST
        });
        server.validator(Joi);

        server.route({
            method: 'GET',
            path: '/health',
            handler: async (request, h) => {
                return { timestamp: new Date().toISOString() };
            }
        });
        console.info(`${Pack.name} health service is running on ${server.info.uri}/health`);

        server.route({
            method: 'POST',
            path: '/',
            options: {
                validate: {
                    payload: {
                        text: {
                            words: Joi.array().items(Joi.string()).required()
                        },
                        to: Joi.string().required()
                    }
                }
            },
            handler: async (request, h)  => {
                return TranslateText(request.payload.text.words, request.payload.to).then(res => res).catch(err => err);
            }
        });

        await server.start();
        console.info(`${Pack.name} running on ${server.info.uri}/`);
    };

    process.on('unhandledRejection', (err) => {
        console.info(err);
        process.exit(1);
    });

    init();
})();