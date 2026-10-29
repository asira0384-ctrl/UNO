export {createGameServer} from './hub-server.js';
import {createGameServer} from './hub-server.js';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const server=await createGameServer();const address=await server.listen();console.log('PARTY ROOM listening on '+address.port);for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await server.close();process.exit(0);});}
