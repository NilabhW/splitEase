const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { errorHandler } = require('../src/middleware/errorHandler');

const appThrowing = (err) => {
  const app = express();
  app.get('/', () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
};

it('turns Mongoose validation errors into 400 with the field message', async () => {
  const err = new mongoose.Error.ValidationError();
  err.addError('splits', new mongoose.Error.ValidatorError({ message: 'Splits must add up to the total amount' }));
  const res = await request(appThrowing(err)).get('/');
  expect(res.status).toBe(400);
  expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Splits must add up to the total amount' });
});

it('hides internals of unexpected errors', async () => {
  const res = await request(appThrowing(new Error('db password is hunter2'))).get('/');
  expect(res.status).toBe(500);
  expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
});
