require("dotenv").config();

module.exports = {
    retryOnError: false,
    HOST: process.env.HOST || "0.0.0.0",
    PORT: process.env.PORT || 443,
    RABBITMQ_USER: process.env.RABBITMQ_USER || "guest",
    RABBITMQ_PASS: process.env.RABBITMQ_PASS || "guest",
    RABBITMQ_URL: process.env.RABBITMQ_URL || "amqp://0.0.0.0",
    PARALLEL_REQUESTS: parseInt(process.env.PARALLEL_REQUESTS) || 10,
    DATABASE_CONNECTION_LIMIT: parseInt(process.env.DATABASE_CONNECTION_LIMIT) || 5,
    JWT_SECRET: process.env.JWT_SECRET || "localhost",
};
