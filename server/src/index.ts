import 'dotenv/config';
import { createApp } from './app.js';
import { createWsServer } from './realtime/ws-server.js';
import { config } from './config.js';

const app = createApp();

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Clawlive server running on port ${config.PORT}`);
  console.log(`  Environment: ${config.NODE_ENV}`);
  console.log(`  CORS origin: ${config.CORS_ORIGIN}`);
});

createWsServer(server);
