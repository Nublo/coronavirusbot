CREATE TABLE subscriptions (
  chat_id BIGINT NOT NULL,
  target INT NOT NULL
);

CREATE TABLE users (
  chat_id BIGINT PRIMARY KEY
);