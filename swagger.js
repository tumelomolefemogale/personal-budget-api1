const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

const spec = swaggerJsDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Personal Budget API',
      version: '1.0.0',
      description: 'API for managing envelopes and transactions.'
    },
    servers: [
      { url: 'http://localhost:3000' }
    ]
  },
  apis: ['./server.js'] // where Swagger looks for route comments
});

module.exports = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
};
